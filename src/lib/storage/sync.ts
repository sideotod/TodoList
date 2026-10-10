import type { DraftInput, PendingDraft, RepositoryError } from '../../domain/items';
import { makeRepositoryError } from '../errors';
import type { JournalStore, RemoteCommitResult, RemoteStore, SuccessorReplacement } from './contracts';

export type SyncPorts = { journal: JournalStore; remote: RemoteStore; clock: () => number; idFactory: () => string; random?: () => number; isForeground?: () => boolean };
export type SyncEngine = { flushPending(manual?: boolean): Promise<void>; dispose(): void; isBusy(): boolean };

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, normalize(entry)]));
  }
  return value;
}
export function storageError(error: unknown): RepositoryError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error && 'retryable' in error &&
      typeof error.message === 'string' && typeof error.retryable === 'boolean' &&
      ['persistence', 'auth', 'validation', 'permission', 'quota', 'integrity'].includes(String(error.code))) return error as RepositoryError;
  return makeRepositoryError('persistence', '저장 결과를 확인하지 못했습니다. 기기 초안과 입력을 유지하고 다시 시도해 주세요.');
}
export async function prepareDraft(uid: string, input: DraftInput, ports: Pick<SyncPorts, 'clock' | 'idFactory'>, current: PendingDraft | null = null): Promise<PendingDraft> {
  const baseRevision = current ? current.baseRevision : input.baseRevision;
  const baseSnapshot = structuredClone(current ? current.baseSnapshot : input.baseSnapshot);
  const proposedSnapshot = structuredClone(input.proposedSnapshot);
  const predecessorOperationId = current?.stage === 'sending' ? current.operationId : current?.predecessorOperationId ?? null;
  const payload = normalize({ mutationKind: input.mutationKind, itemId: input.itemId, baseRevision, proposedSnapshot });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const payloadDigest = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  const timestamp = new Date(ports.clock()).toISOString();
  return {
    uid, itemId: input.itemId, localSequence: (current?.localSequence ?? 0) + 1,
    operationId: ports.idFactory(), predecessorOperationId, baseRevision, baseSnapshot,
    proposedSnapshot, mutationKind: input.mutationKind,
    stage: 'queued', payloadDigest, createdAt: timestamp, updatedAt: timestamp,
  };
}

export function createSyncEngine(uid: string, ports: SyncPorts, callbacks: { onChange?: () => void; onRemote?: (result: RemoteCommitResult) => void; onError?: (error: RepositoryError) => void; onJournalError?: (error: RepositoryError) => void; onBusy?: (busy: boolean) => void } = {}): SyncEngine {
  let disposed = false;
  let running: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const attempts = new Map<string, number>();
  const stopped = new Set<string>();
  const retryAt = new Map<string, number>();
  const foreground = ports.isForeground ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const report = (error: unknown) => { if (!disposed) callbacks.onError?.(storageError(error)); };
  async function local<Value>(operation: () => Promise<Value>): Promise<Value> {
    try { return await operation(); }
    catch (error) { if (!disposed) callbacks.onJournalError?.(storageError(error)); throw error; }
  }
  function cancelRetry() { if (retryTimer !== null) clearTimeout(retryTimer); retryTimer = null; }
  function schedule() {
    cancelRetry();
    if (disposed || !foreground() || retryAt.size === 0) return;
    const next = Math.min(...retryAt.values());
    retryTimer = setTimeout(() => { retryTimer = null; void engine.flushPending(false); }, Math.max(0, next - ports.clock()));
  }
  async function acknowledge(mutation: PendingDraft, result: Exclude<RemoteCommitResult, { status: 'conflict' }>) {
    // Hashing a rebound successor never runs inside the IndexedDB transaction.
    for (;;) {
      const snapshot = await local(() => ports.journal.read(uid));
      const successor = snapshot.drafts.find((entry) => entry.predecessorOperationId === mutation.operationId);
      let replacement: SuccessorReplacement | undefined;
      if (successor) {
        const bound = await prepareDraft(uid, {
          itemId: successor.itemId, expectedLocalSequence: successor.localSequence,
          baseRevision: result.receipt.resultRevision, baseSnapshot: mutation.proposedSnapshot,
          proposedSnapshot: successor.proposedSnapshot, mutationKind: successor.mutationKind,
        }, ports);
        replacement = { expectedOperationId: successor.operationId, mutation: { ...bound, localSequence: successor.localSequence, createdAt: successor.createdAt } };
      }
      const outcome = await local(() => ports.journal.acknowledge(uid, mutation.operationId, result, replacement));
      if (outcome !== 'stale-local') return;
      // A concurrent form save won CAS. Re-read and bind that exact successor.
    }
  }
  async function sendAll() {
    while (!disposed && foreground()) {
      const snapshot = await local(() => ports.journal.read(uid));
      const next = snapshot.drafts.find((entry) => entry.stage !== 'conflicted' && entry.predecessorOperationId === null &&
        !stopped.has(entry.operationId) && (retryAt.get(entry.operationId) ?? 0) <= ports.clock());
      if (!next) return;
      const mutation = await local(() => ports.journal.markSending(uid, next.operationId));
      if (!mutation) continue;
      if (disposed || !foreground()) return;
      try {
        const result = await ports.remote.commit(uid, mutation);
        if (result.status === 'conflict') await local(() => ports.journal.markConflict(uid, mutation.operationId, result.remote));
        else await acknowledge(mutation, result);
        attempts.delete(mutation.operationId); retryAt.delete(mutation.operationId);
        if (!disposed) { callbacks.onRemote?.(result); callbacks.onChange?.(); }
      } catch (error) {
        const failure = storageError(error);
        report(failure);
        if (failure.retryable) {
          const attempt = (attempts.get(mutation.operationId) ?? 0) + 1;
          attempts.set(mutation.operationId, attempt);
          const base = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5));
          const jitter = 0.8 + Math.max(0, Math.min(1, (ports.random ?? Math.random)())) * 0.4;
          retryAt.set(mutation.operationId, ports.clock() + Math.min(30_000, Math.round(base * jitter)));
        } else stopped.add(mutation.operationId);
      }
    }
  }
  async function executeFlush(): Promise<void> {
    callbacks.onBusy?.(true);
    const execute = async () => {
      try {
        const send = () => sendAll();
        if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(`student-tasks-sync:${uid}`, send);
        else await send();
      } catch (error) { report(error); }
      finally {
        running = null;
        if (!disposed) {
          callbacks.onBusy?.(false);
          schedule();
        }
      }
    };
    running = execute();
    return running;
  }
  async function runManualFlush(): Promise<void> {
    if (disposed || !foreground()) return;
    if (running) { await running; return runManualFlush(); }
    stopped.clear(); retryAt.clear(); cancelRetry();
    return executeFlush();
  }
  const engine: SyncEngine = {
    async flushPending(manual = true) { if (manual) return runManualFlush(); if (disposed || !foreground()) return; if (running) return running; return executeFlush(); },
    isBusy() { return running !== null; },
    dispose() {
      disposed = true; cancelRetry();
      if (typeof window !== 'undefined') window.removeEventListener('online', resume);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume);
    },
  };
  function resume() { if (!foreground()) cancelRetry(); else void engine.flushPending(false); }
  if (typeof window !== 'undefined') window.addEventListener('online', resume);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume);
  return engine;
}
