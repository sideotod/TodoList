'use client';

import type { DraftInput, PendingDraft, CalendarItem, ProposedCalendarItem, ItemView, RepositoryError } from '../domain/items';
import { getDateStartMs, getTimingBounds } from '../domain/time';
import { validateCanonicalItem, validateProposedItem } from '../domain/validation';
import { makeRepositoryError } from './errors';
import type { JournalSnapshot, RemoteSnapshot } from './storage/contracts';
import { createSyncEngine, prepareDraft, storageError, type SyncEngine, type SyncPorts } from './storage/sync';

export type { CalendarItem, ProposedCalendarItem, PendingDraft, DraftInput, ItemView, RepositoryError } from '../domain/items';
export type QueryRange = { from: string; to: string; timeZone: string };
export type SaveResult =
  | { status: 'saved'; item: CalendarItem; operationId: string; committedRevision: number }
  | { status: 'conflict'; mutation: PendingDraft; remote: CalendarItem }
  | { status: 'queued'; mutation: PendingDraft }
  | { status: 'stale-local'; current: PendingDraft | null; input: DraftInput }
  | { status: 'cancelled'; itemId: string };
export type ConflictChoice = { choice: 'keep-remote' } | { choice: 'use-local' } | { choice: 'edit'; edited: ProposedCalendarItem } | { choice: 'restore-as-new' };
export type SyncState = { connection: 'online' | 'offline' | 'unknown'; localJournal: 'available' | 'unavailable'; remoteCache: 'available' | 'unavailable' | 'empty-offline'; pendingCount: number; conflictCount: number; localWriteInFlight: boolean; error: RepositoryError | null };
export type BackupExport = { formatVersion: 1; ownerUid: string; exportedAt: string; canonicalSource: 'server' | 'cache'; canonicalItems: CalendarItem[]; pendingLocalChanges: PendingDraft[] };
export type DeviceDataClearResult = { status: 'cleared' } | { status: 'blocked'; reason: 'pending' | 'busy' | 'other-tabs' };
export type RepositoryPorts = SyncPorts & { remoteCacheAvailable?: boolean };
export interface Repository {
  listItems(range: QueryRange): Promise<ItemView[]>;
  subscribeItems(range: QueryRange, onItems: (items: ItemView[]) => void): () => void;
  readItem(id: string): Promise<ItemView | null>;
  saveDraft(input: DraftInput): Promise<SaveResult>;
  resolveConflict(itemId: string, choice: ConflictChoice): Promise<SaveResult>;
  exportBackup(): Promise<BackupExport>;
  clearDeviceData(options: { discardPending: boolean }): Promise<DeviceDataClearResult>;
  flushPending(): Promise<void>;
  subscribeSyncState(onState: (state: SyncState) => void): () => void;
  dispose(): void;
}
function proposalOf(item: CalendarItem): ProposedCalendarItem {
  const { revision, updatedAt, deletedAt, lastMutationId, lastMutationDigest, ...proposal } = item;
  void revision; void updatedAt; void deletedAt; void lastMutationId; void lastMutationDigest;
  const validated = validateProposedItem(proposal);
  if (!validated.valid) throw makeRepositoryError('integrity', '원격 항목을 검증하지 못했습니다.', { fieldIssues: validated.issues });
  return validated.value;
}
function validateInput(input: DraftInput): DraftInput {
  const valid = validateProposedItem(input.proposedSnapshot);
  if (!valid.valid) throw makeRepositoryError('validation', '입력한 항목을 확인해 주세요.', { fieldIssues: valid.issues });
  if (input.itemId !== valid.value.id || (input.baseRevision === null) !== (input.baseSnapshot === null) ||
      (input.baseRevision !== null && (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 1)) ||
      (input.expectedLocalSequence !== null && (!Number.isSafeInteger(input.expectedLocalSequence) || input.expectedLocalSequence < 1)) ||
      !['upsert', 'delete'].includes(input.mutationKind)) throw makeRepositoryError('validation', '항목 ID와 기준 revision/초안을 확인해 주세요.');
  if (input.baseSnapshot) {
    const base = validateProposedItem(input.baseSnapshot);
    if (!base.valid || base.value.id !== input.itemId) throw makeRepositoryError('validation', '기준 항목을 확인해 주세요.');
    if ((base.value.kind === 'deadline' || base.value.kind === 'window') && base.value.checklist.length > 0 && valid.value.kind !== 'deadline' && valid.value.kind !== 'window') {
      throw makeRepositoryError('validation', '하위 체크리스트를 명시적으로 정리한 뒤 종류를 변경해 주세요.');
    }
    if (base.value.importSource?.uid !== valid.value.importSource?.uid || base.value.importSource?.occurrenceKey !== valid.value.importSource?.occurrenceKey) {
      throw makeRepositoryError('validation', '가져온 일정의 원본 identity를 변경할 수 없습니다.');
    }
  }
  return { ...input, proposedSnapshot: valid.value };
}
function validateRange(range: QueryRange) {
  try {
    const from = getDateStartMs(range.from, range.timeZone);
    const to = getDateStartMs(range.to, range.timeZone);
    if (from >= to) throw new Error('Empty range');
    return { from, to };
  } catch { throw makeRepositoryError('validation', '조회 기간은 시작 포함/끝 제외의 유효한 날짜와 시간대여야 합니다.'); }
}

export function createRepository(session: { uid: string; generation: number }, ports: RepositoryPorts): Repository {
  const { uid } = session;
  if (!uid.trim() || uid.includes('/') || !Number.isSafeInteger(session.generation) || session.generation < 0) throw makeRepositoryError('auth', '유효한 로그인 세션이 필요합니다.');
  let disposed = false;
  let clearing = false;
  let localWrites = 0;
  let journalWriteFailed = false;
  let refreshGeneration = 0;
  let journalSnapshot: JournalSnapshot = { drafts: [], heads: [], resolutions: [] };
  const canonical = new Map<string, CalendarItem>();
  const sources = new Map<string, 'cache' | 'server'>();
  let canonicalSource: 'server' | 'cache' = 'cache';
  const state: SyncState = { connection: 'unknown', localJournal: 'available', remoteCache: ports.remoteCacheAvailable === false ? 'unavailable' : 'available', pendingCount: 0, conflictCount: 0, localWriteInFlight: false, error: null };
  const itemListeners = new Set<{ range: QueryRange; callback: (items: ItemView[]) => void }>();
  const stateListeners = new Set<(state: SyncState) => void>();
  const active = () => { if (disposed || clearing) throw makeRepositoryError('auth', '이 로그인 세션은 더 이상 자료를 변경할 수 없습니다.'); };
  function view(id: string): ItemView | null {
    const head = journalSnapshot.heads.find((entry) => entry.itemId === id);
    const localDraft = journalSnapshot.drafts.find((entry) => entry.operationId === head?.activeOperationId) ?? null;
    const remote = canonical.get(id) ?? localDraft?.remoteSnapshot ?? null;
    if (!localDraft && !remote) return null;
    return {
      display: localDraft?.proposedSnapshot ?? proposalOf(remote!), canonical: remote, localDraft,
      syncState: state.localJournal === 'unavailable' ? 'offline-read-only' : localDraft?.stage === 'conflicted' ? 'conflict' : localDraft?.stage === 'sending' ? 'syncing' : localDraft ? 'offline-draft' : 'synced',
      ...(localDraft?.remoteSnapshot ? { conflictRemote: localDraft.remoteSnapshot } : {}),
      snapshotSource: remote ? sources.get(id) ?? 'server' : 'none', localSequence: localDraft?.localSequence ?? null,
    };
  }
  function items(range: QueryRange): ItemView[] {
    const bounds = validateRange(range);
    const ids = new Set([...canonical.keys(), ...journalSnapshot.heads.map((entry) => entry.itemId)]);
    const values = [...ids].map(view).filter((entry): entry is ItemView => entry !== null);
    return values.filter((entry) => {
      if (entry.canonical?.deletedAt !== null && entry.canonical !== null) return false;
      if (entry.localDraft?.mutationKind === 'delete') return false;
      const timing = entry.display.timing;
      if (timing.type === 'unscheduled') return true;
      if (timing.type === 'date') return (timing.startDate ?? timing.endDate) < range.to && range.from <= timing.endDate;
      const { startMs, endExclusiveMs } = getTimingBounds(timing);
      if (startMs === null) return endExclusiveMs !== null && bounds.from <= endExclusiveMs && endExclusiveMs < bounds.to;
      return startMs < bounds.to && (endExclusiveMs === null || bounds.from < endExclusiveMs);
    }).sort((a, b) => a.display.id.localeCompare(b.display.id));
  }
  function emit() {
    if (disposed) return;
    state.pendingCount = journalSnapshot.drafts.length;
    state.conflictCount = new Set(journalSnapshot.drafts.filter((entry) => entry.stage === 'conflicted').map((entry) => entry.itemId)).size;
    state.localWriteInFlight = localWrites > 0;
    for (const callback of stateListeners) callback(structuredClone(state));
    for (const { range, callback } of itemListeners) callback(structuredClone(items(range)));
  }
  function error(value: unknown, journalFailure = false) {
    const failure = storageError(value);
    if (disposed) return failure;
    state.error = failure;
    if (journalFailure && failure.code === 'persistence') { state.localJournal = 'unavailable'; journalWriteFailed = true; }
    emit(); return failure;
  }
  async function refresh() {
    const generation = ++refreshGeneration;
    try {
      const snapshot = await ports.journal.read(uid);
      if (disposed || generation !== refreshGeneration) return;
      journalSnapshot = snapshot;
      state.localJournal = journalWriteFailed ? 'unavailable' : 'available';
      emit();
    } catch (failure) { error(failure, true); }
  }
  const ready = refresh();
  function makeEngine(): SyncEngine {
    return createSyncEngine(uid, ports, {
      onChange: () => { journalWriteFailed = false; void refresh(); },
      onRemote: (result) => {
        if (disposed || clearing) return;
        const existing = canonical.get(result.remote.id);
        if (!existing || existing.revision <= result.remote.revision) { canonical.set(result.remote.id, structuredClone(result.remote)); sources.set(result.remote.id, 'server'); }
        state.connection = 'online'; state.error = null;
      },
      onError: (failure) => { if (failure.retryable && failure.code === 'persistence') state.connection = 'offline'; error(failure); },
      onJournalError: (failure) => { error(failure, true); },
      onBusy: () => { emit(); },
    });
  }
  let engine = makeEngine();
  function receive(snapshot: RemoteSnapshot) {
    if (disposed || clearing) return;
    const checked = snapshot.items.map((entry) => validateCanonicalItem(entry));
    const invalid = checked.find((entry) => !entry.valid);
    if (invalid && !invalid.valid) { error(makeRepositoryError('integrity', '원격 자료의 형식을 확인하지 못했습니다.', { fieldIssues: invalid.issues })); return; }
    for (const entry of checked) if (entry.valid) {
      const previous = canonical.get(entry.value.id);
      if (!previous || previous.revision <= entry.value.revision) {
        canonical.set(entry.value.id, structuredClone(entry.value));
        sources.set(entry.value.id, snapshot.fromCache ? 'cache' : 'server');
      }
    }
    if (!snapshot.fromCache && !snapshot.hasPendingWrites) { state.connection = 'online'; canonicalSource = 'server'; }
    else if (snapshot.fromCache && state.connection !== 'offline') state.connection = 'unknown';
    if (ports.remoteCacheAvailable !== false) state.remoteCache = snapshot.fromCache && snapshot.items.length === 0 ? 'empty-offline' : 'available';
    emit();
    if (!snapshot.fromCache && !snapshot.hasPendingWrites) void ready.then(() => { if (!disposed && !clearing && state.localJournal === 'available') return engine.flushPending(false); });
  }
  function listen() {
    return ports.remote.subscribe(uid, receive, (failure) => {
      if (disposed || clearing) return;
      if (failure.code === 'persistence' && !failure.retryable) state.remoteCache = 'unavailable';
      error(failure);
    });
  }
  let stopRemote = listen();
  const stopJournal = ports.journal.subscribe(uid, () => { if (!disposed && !clearing) void refresh(); });
  async function write<Value>(operation: () => Promise<Value>): Promise<Value> {
    active(); localWrites++; emit();
    try { return await operation(); }
    catch (failure) { throw error(failure, true); }
    finally { localWrites--; emit(); }
  }
  const repository: Repository = {
    async listItems(range) { validateRange(range); await ready; active(); await refresh(); return structuredClone(items(range)); },
    subscribeItems(range, callback) {
      validateRange(range); active();
      const listener = { range, callback }; itemListeners.add(listener);
      void ready.then(() => { if (!disposed && itemListeners.has(listener)) callback(structuredClone(items(range))); });
      return () => { itemListeners.delete(listener); };
    },
    async readItem(id) { await ready; active(); await refresh(); return structuredClone(view(id)); },
    async saveDraft(input) {
      active(); const checked = validateInput(input); await ready; active();
      return write<SaveResult>(async () => {
        const snapshot = await ports.journal.read(uid);
        const head = snapshot.heads.find((entry) => entry.itemId === checked.itemId);
        const current = snapshot.drafts.find((entry) => entry.operationId === head?.activeOperationId) ?? null;
        if ((current?.localSequence ?? null) !== checked.expectedLocalSequence) return { status: 'stale-local', current, input: structuredClone(input) };
        if (current?.stage === 'conflicted' && current.remoteSnapshot) return { status: 'conflict', mutation: current, remote: current.remoteSnapshot };
        if (!current && checked.mutationKind === 'delete' && checked.baseRevision === null) throw makeRepositoryError('validation', '삭제할 서버 항목 또는 기기 초안이 없습니다.');
        const mutation = await prepareDraft(uid, checked, ports, current);
        active();
        const result = await ports.journal.save(mutation, checked.expectedLocalSequence);
        if (result.status === 'stale-local') return { ...result, input: structuredClone(input) };
        journalWriteFailed = false; await refresh(); state.error = null;
        if (!disposed && state.connection === 'online') queueMicrotask(() => { if (!disposed && !clearing) void engine.flushPending(false); });
        return result;
      });
    },
    async resolveConflict(itemId, choice) {
      active(); await ready;
      return write<SaveResult>(async () => {
        const snapshot = await ports.journal.read(uid);
        const head = snapshot.heads.find((entry) => entry.itemId === itemId);
        const mutation = snapshot.drafts.find((entry) => entry.operationId === head?.activeOperationId);
        if (!mutation || mutation.stage !== 'conflicted' || !mutation.remoteSnapshot) throw makeRepositoryError('validation', '해결할 충돌이 없습니다.');
        const known = canonical.get(itemId);
        const remote = known && known.revision > mutation.remoteSnapshot.revision ? known : mutation.remoteSnapshot;
        if (remote.deletedAt !== null && (choice.choice === 'use-local' || choice.choice === 'edit')) throw makeRepositoryError('validation', '삭제된 원본은 새 ID로 복원해야 합니다.');
        const input: DraftInput = {
          itemId: choice.choice === 'restore-as-new' ? ports.idFactory() : itemId,
          expectedLocalSequence: mutation.localSequence,
          baseRevision: choice.choice === 'restore-as-new' ? null : remote.revision,
          baseSnapshot: choice.choice === 'restore-as-new' ? null : proposalOf(remote),
          proposedSnapshot: choice.choice === 'edit' ? choice.edited : mutation.proposedSnapshot,
          mutationKind: choice.choice === 'restore-as-new' ? 'upsert' : mutation.mutationKind,
        };
        if (choice.choice === 'restore-as-new') input.proposedSnapshot = { ...input.proposedSnapshot, id: input.itemId };
        const replacement = choice.choice === 'keep-remote' ? null : await prepareDraft(uid, validateInput(input), ports);
        const resolution = {
          uid, resolutionId: ports.idFactory(), itemId, choice: choice.choice,
          drafts: snapshot.drafts.filter((entry) => entry.itemId === itemId), remoteSnapshot: mutation.remoteSnapshot,
          replacementOperationId: replacement?.operationId ?? null,
          status: replacement ? 'pending' as const : 'confirmed' as const, createdAt: new Date(ports.clock()).toISOString(),
        };
        active();
        const result = await ports.journal.resolve(resolution, mutation.localSequence, replacement);
        await refresh();
        if (result.status === 'stale-local') return { ...result, input };
        if (result.status === 'resolved') {
          canonical.set(itemId, remote); sources.set(itemId, 'server'); emit();
          return { status: 'saved', item: remote, operationId: mutation.operationId, committedRevision: remote.revision };
        }
        return result;
      });
    },
    async exportBackup() {
      await ready; active();
      const snapshot = await ports.journal.read(uid);
      return structuredClone({ formatVersion: 1, ownerUid: uid, exportedAt: new Date(ports.clock()).toISOString(), canonicalSource, canonicalItems: [...canonical.values()], pendingLocalChanges: snapshot.drafts });
    },
    async clearDeviceData(options) {
      active(); await ready;
      if (localWrites > 0 || engine.isBusy()) return { status: 'blocked', reason: 'busy' };
      const snapshot = await ports.journal.read(uid);
      if (snapshot.drafts.some((entry) => entry.stage === 'sending')) return { status: 'blocked', reason: 'busy' };
      if (snapshot.drafts.length > 0 && !options.discardPending) return { status: 'blocked', reason: 'pending' };
      clearing = true; engine.dispose(); stopRemote();
      try {
        await ports.remote.clearReadCache();
        const result = await ports.journal.clear(uid, snapshot);
        if (result === 'stale-local') {
          clearing = false; engine = makeEngine(); stopRemote = listen(); await refresh();
          return { status: 'blocked', reason: 'busy' };
        }
        clearing = false; repository.dispose();
        return { status: 'cleared' };
      } catch (failure) {
        clearing = false; engine = makeEngine(); stopRemote = listen(); error(failure);
        if (typeof failure === 'object' && failure !== null && 'reason' in failure && failure.reason === 'other-tabs') return { status: 'blocked', reason: 'other-tabs' };
        throw storageError(failure);
      }
    },
    async flushPending() { await ready; active(); await engine.flushPending(); await refresh(); },
    subscribeSyncState(callback) { active(); stateListeners.add(callback); callback(structuredClone(state)); return () => { stateListeners.delete(callback); }; },
    dispose() { if (disposed) return; disposed = true; engine.dispose(); stopRemote(); stopJournal(); canonical.clear(); sources.clear(); journalSnapshot = { drafts: [], heads: [], resolutions: [] }; itemListeners.clear(); stateListeners.clear(); },
  };
  return repository;
}
