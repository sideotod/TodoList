import 'fake-indexeddb/auto';
import type { CalendarItem, DraftInput, PendingDraft, ProposedCalendarItem, RepositoryError } from '../../src/domain/items';
import type { MutationReceipt, RemoteCommitResult, RemoteSnapshot, RemoteStore } from '../../src/lib/storage/contracts';
import { makeTask, withCanonicalMetadata } from '../fixtures/items';

export const NOW_MS = Date.parse('2026-10-03T00:00:00.000Z');
export function draftInput(proposal: ProposedCalendarItem = makeTask(), overrides: Partial<DraftInput> = {}): DraftInput {
  return { itemId: proposal.id, expectedLocalSequence: null, baseRevision: null, baseSnapshot: null, proposedSnapshot: proposal, mutationKind: 'upsert', ...overrides };
}
export function pendingDraft(uid = 'user-a', overrides: Partial<PendingDraft> = {}): PendingDraft {
  return { uid, itemId: 'task-1', operationId: 'operation-1', localSequence: 1, predecessorOperationId: null, baseRevision: null, baseSnapshot: null, proposedSnapshot: makeTask(), mutationKind: 'upsert', stage: 'queued', payloadDigest: 'a'.repeat(64), createdAt: new Date(NOW_MS).toISOString(), updatedAt: new Date(NOW_MS).toISOString(), ...overrides };
}
export function ids(prefix = 'id'): () => string {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}
export function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
// The external network is replaced; real IndexedDB and repository/sync code execute.
export class RemoteFixture implements RemoteStore {
  items = new Map<string, CalendarItem>();
  receipts = new Map<string, MutationReceipt>();
  attempts: PendingDraft[] = [];
  failures: RepositoryError[] = [];
  delay: ReturnType<typeof deferred<void>> | null = null;
  cacheClearError: RepositoryError | null = null;
  private listeners = new Map<string, Set<(snapshot: RemoteSnapshot) => void>>();
  subscribe(uid: string, callback: (snapshot: RemoteSnapshot) => void) {
    const listeners = this.listeners.get(uid) ?? new Set(); listeners.add(callback); this.listeners.set(uid, listeners);
    return () => { listeners.delete(callback); };
  }
  emit(uid: string, fromCache = false) {
    const items = [...this.items].filter(([key]) => key.startsWith(`${uid}/`)).map(([, value]) => value);
    for (const callback of this.listeners.get(uid) ?? []) callback({ items: structuredClone(items), fromCache, hasPendingWrites: false, receivedAt: new Date(NOW_MS).toISOString() });
  }
  async commit(uid: string, draft: PendingDraft): Promise<RemoteCommitResult> {
    if (uid !== draft.uid) throw { code: 'auth', message: 'UID mismatch', retryable: false };
    this.attempts.push(structuredClone(draft));
    if (this.delay) await this.delay.promise;
    const failure = this.failures.shift(); if (failure) throw failure;
    const remote = this.items.get(`${uid}/${draft.itemId}`);
    const receipt = this.receipts.get(`${uid}/${draft.operationId}`);
    if (receipt) {
      if (receipt.payloadDigest !== draft.payloadDigest || receipt.itemId !== draft.itemId || !remote) throw { code: 'integrity', message: 'invalid receipt', retryable: false };
      return { status: 'already-applied', receipt: structuredClone(receipt), remote: structuredClone(remote) };
    }
    if (remote && (remote.revision !== draft.baseRevision || remote.deletedAt !== null)) return { status: 'conflict', remote: structuredClone(remote) };
    if (!remote && draft.baseRevision !== null) throw { code: 'integrity', message: 'missing revision', retryable: false };
    const item = withCanonicalMetadata(draft.proposedSnapshot, { revision: (remote?.revision ?? 0) + 1, updatedAt: new Date(NOW_MS).toISOString(), deletedAt: draft.mutationKind === 'delete' ? new Date(NOW_MS).toISOString() : null, lastMutationId: draft.operationId, lastMutationDigest: draft.payloadDigest });
    const nextReceipt = { itemId: draft.itemId, payloadDigest: draft.payloadDigest, resultRevision: item.revision, createdAt: item.updatedAt };
    this.items.set(`${uid}/${draft.itemId}`, item); this.receipts.set(`${uid}/${draft.operationId}`, nextReceipt);
    return { status: 'applied', receipt: nextReceipt, remote: structuredClone(item) };
  }
  async clearReadCache() { if (this.cacheClearError) throw this.cacheClearError; }
}
