import type { CalendarItem, PendingDraft } from '../../domain/items';
import { validateCanonicalItem, validateProposedItem } from '../../domain/validation';
import { makeRepositoryError } from '../errors';
import type { ConflictResolution, JournalHead, JournalStore } from './contracts';

const STORES = ['drafts', 'heads', 'resolutions'];
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && !value.includes('/');
const integrity = () => makeRepositoryError('integrity', '기기 저널의 형식을 확인할 수 없습니다. 기존 기록은 보존됩니다.');

function checkedDraft(value: unknown): PendingDraft {
  if (!object(value) || !id(value.uid) || !id(value.itemId) || !id(value.operationId) ||
      !Number.isSafeInteger(value.localSequence) || Number(value.localSequence) < 1 ||
      (value.predecessorOperationId !== null && !id(value.predecessorOperationId)) ||
      (value.baseRevision !== null && (!Number.isSafeInteger(value.baseRevision) || Number(value.baseRevision) < 1)) ||
      !['queued', 'sending', 'conflicted'].includes(String(value.stage)) || !['upsert', 'delete'].includes(String(value.mutationKind)) ||
      typeof value.payloadDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.payloadDigest) ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw integrity();
  const proposal = validateProposedItem(value.proposedSnapshot);
  if (!proposal.valid || proposal.value.id !== value.itemId) throw integrity();
  if (value.baseSnapshot !== null) {
    const base = validateProposedItem(value.baseSnapshot);
    if (!base.valid || base.value.id !== value.itemId) throw integrity();
  }
  if ((value.baseRevision === null) !== (value.baseSnapshot === null)) throw integrity();
  if (value.remoteSnapshot !== undefined) {
    const remote = validateCanonicalItem(value.remoteSnapshot);
    if (!remote.valid || remote.value.id !== value.itemId) throw integrity();
  }
  return value as PendingDraft;
}
function checkedHead(value: unknown): JournalHead {
  if (!object(value) || !id(value.uid) || !id(value.itemId) || !Number.isSafeInteger(value.localSequence) || Number(value.localSequence) < 1 ||
      (value.activeOperationId !== null && !id(value.activeOperationId))) throw integrity();
  return value as JournalHead;
}
function checkedResolution(value: unknown): ConflictResolution {
  if (!object(value) || !id(value.uid) || !id(value.resolutionId) || !id(value.itemId) ||
      !['keep-remote', 'use-local', 'edit', 'restore-as-new'].includes(String(value.choice)) ||
      !['pending', 'confirmed'].includes(String(value.status)) || !Array.isArray(value.drafts) ||
      (value.replacementOperationId !== null && !id(value.replacementOperationId)) ||
      typeof value.createdAt !== 'string' || !validateCanonicalItem(value.remoteSnapshot).valid) throw integrity();
  for (const entry of value.drafts) if (checkedDraft(entry).uid !== value.uid || checkedDraft(entry).itemId !== value.itemId) throw integrity();
  return value as ConflictResolution;
}
export function createIndexedDbJournal(options: { indexedDB?: IDBFactory; databaseName?: string } = {}): JournalStore {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  const databaseName = options.databaseName ?? 'student-tasks-journal';
  let connection: Promise<IDBDatabase> | null = null;
  const listeners = new Map<string, Set<() => void>>();
  let channel: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try { channel = new BroadcastChannel(databaseName); } catch { /* Coordination is optional; IndexedDB CAS and receipts remain authoritative. */ }
  }
  function notify(uid: string, broadcast = true) {
    for (const callback of listeners.get(uid) ?? []) callback();
    if (broadcast && channel) {
      try { channel.postMessage({ uid }); } catch { channel.close(); channel = null; }
    }
  }
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
    if (object(event.data) && typeof event.data.uid === 'string') notify(event.data.uid, false);
  };
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      if (!factory) { reject(makeRepositoryError('persistence', '이 브라우저에서 기기 저널을 사용할 수 없습니다.')); return; }
      const request = factory.open(databaseName, 2);
      let failed = false;
      request.onupgradeneeded = (event) => {
        const db = request.result;
        for (const name of STORES) {
          if (db.objectStoreNames.contains(name)) continue;
          const key = name === 'drafts' ? 'operationId' : name === 'heads' ? 'itemId' : name === 'resolutions' ? 'resolutionId' : 'previewId';
          const store = db.createObjectStore(name, { keyPath: ['uid', key] });
          store.createIndex('uid', 'uid');
          if (name === 'drafts') store.createIndex('itemSequence', ['uid', 'itemId', 'localSequence'], { unique: true });
        }
        if (event.oldVersion < 2 && db.objectStoreNames.contains('imports')) db.deleteObjectStore('imports');
      };
      request.onerror = () => { failed = true; reject(makeRepositoryError('persistence', '기기 저널을 열지 못했습니다. 입력을 유지하고 다시 시도해 주세요.')); };
      request.onblocked = () => { failed = true; reject(makeRepositoryError('persistence', '다른 탭이 기기 저널 업그레이드를 막고 있습니다.')); };
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); connection = null; };
        resolve(request.result);
      };
    });
    // Opening can be retried after capabilities or another tab change.
    connection.catch(() => { connection = null; });
    return connection;
  }
  async function run<Value>(names: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, finish: (value: Value) => void, request: <T>(req: IDBRequest<T>, callback: (value: T) => void) => void) => void, changedUid?: string): Promise<Value> {
    const db = await open();
    return new Promise<Value>((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let outcome: Value;
      let finished = false;
      let failure: unknown;
      const finish = (value: Value) => { outcome = value; finished = true; };
      const request = <T>(req: IDBRequest<T>, callback: (value: T) => void) => {
        req.onsuccess = () => {
          try { callback(req.result); } catch (error) { failure = error; tx.abort(); }
        };
      };
      tx.onabort = () => reject(failure ?? makeRepositoryError('persistence', '기기 저장이 완료되지 않았습니다. 입력을 유지하고 다시 시도해 주세요.'));
      tx.oncomplete = () => {
        if (!finished) { reject(integrity()); return; }
        if (changedUid) notify(changedUid);
        resolve(outcome);
      };
      try { action(tx, finish, request); } catch (error) { failure = error; tx.abort(); }
    });
  }
  function rows<Value>(tx: IDBTransaction, name: string, uid: string): IDBRequest<Value[]> {
    return tx.objectStore(name).index('uid').getAll(uid);
  }
  function itemDrafts(tx: IDBTransaction, uid: string, itemId: string): IDBRequest<unknown[]> {
    // The compound index is UID-prefixed; a single read includes predecessor and successor.
    return tx.objectStore('drafts').index('itemSequence').getAll(IDBKeyRange.bound([uid, itemId, 0], [uid, itemId, Number.MAX_SAFE_INTEGER]));
  }
  const store: JournalStore = {
    async read(uid) {
      return run(STORES, 'readonly', (tx, finish, request) => {
        let drafts: PendingDraft[] | undefined;
        let heads: JournalHead[] | undefined;
        let resolutions: ConflictResolution[] | undefined;
        const ready = () => { if (drafts && heads && resolutions) finish({ drafts, heads, resolutions }); };
        request(rows<unknown>(tx, 'drafts', uid), (values) => { drafts = values.map(checkedDraft).sort((a, b) => a.itemId.localeCompare(b.itemId) || a.localSequence - b.localSequence); ready(); });
        request(rows<unknown>(tx, 'heads', uid), (values) => { heads = values.map(checkedHead); ready(); });
        request(rows<unknown>(tx, 'resolutions', uid), (values) => { resolutions = values.map(checkedResolution); ready(); });
      });
    },
    async save(mutation, expectedLocalSequence) {
      checkedDraft(mutation);
      return run(['drafts', 'heads'], 'readwrite', (tx, finish, request) => {
        request(tx.objectStore('heads').get([mutation.uid, mutation.itemId]), (value: unknown) => {
          const head = value === undefined ? null : checkedHead(value);
          request(itemDrafts(tx, mutation.uid, mutation.itemId), (values) => {
            const drafts = values.map(checkedDraft);
            const current = drafts.find((entry) => entry.operationId === head?.activeOperationId) ?? null;
            if ((current?.localSequence ?? null) !== expectedLocalSequence || current?.stage === 'conflicted') { finish({ status: 'stale-local', current }); return; }
            const predecessor = current?.stage === 'sending' ? current.operationId : current?.predecessorOperationId ?? null;
            // Preparation/hashing is outside this transaction; reject stale or incorrectly linked payloads.
            if (mutation.predecessorOperationId !== predecessor || (current && (mutation.baseRevision !== current.baseRevision || JSON.stringify(mutation.baseSnapshot) !== JSON.stringify(current.baseSnapshot)))) throw integrity();
            const sequence = (head?.localSequence ?? 0) + 1;
            if (mutation.mutationKind === 'delete' && current?.stage === 'queued' && current.baseRevision === null && predecessor === null) {
              for (const entry of drafts) tx.objectStore('drafts').delete([mutation.uid, entry.operationId]);
              tx.objectStore('heads').put({ uid: mutation.uid, itemId: mutation.itemId, localSequence: sequence, activeOperationId: null });
              finish({ status: 'cancelled', itemId: mutation.itemId }); return;
            }
            if (current?.stage === 'queued') tx.objectStore('drafts').delete([mutation.uid, current.operationId]);
            const pending = { ...mutation, localSequence: sequence, stage: 'queued' as const };
            tx.objectStore('drafts').add(pending);
            tx.objectStore('heads').put({ uid: mutation.uid, itemId: mutation.itemId, localSequence: sequence, activeOperationId: pending.operationId });
            finish({ status: 'queued', mutation: pending });
          });
        });
      }, mutation.uid);
    },
    async markSending(uid, operationId) {
      return run(['drafts', 'heads'], 'readwrite', (tx, finish, request) => {
        request(tx.objectStore('drafts').get([uid, operationId]), (value: unknown) => {
          if (value === undefined) { finish(null); return; }
          const mutation = checkedDraft(value);
          if (mutation.stage === 'conflicted' || mutation.predecessorOperationId !== null) { finish(null); return; }
          const sending = { ...mutation, stage: 'sending' as const };
          tx.objectStore('drafts').put(sending);
          finish(sending);
        });
      }, uid);
    },
    async acknowledge(uid, operationId, result, successor) {
      return run(['drafts', 'heads', 'resolutions'], 'readwrite', (tx, finish, request) => {
        request(tx.objectStore('drafts').get([uid, operationId]), (value: unknown) => {
          if (value === undefined) { finish('missing'); return; }
          const predecessor = checkedDraft(value);
          if (predecessor.stage !== 'sending' || result.receipt.itemId !== predecessor.itemId || result.receipt.payloadDigest !== predecessor.payloadDigest) throw integrity();
          request(itemDrafts(tx, uid, predecessor.itemId), (values) => {
            const dependent = values.map(checkedDraft).find((entry) => entry.predecessorOperationId === operationId);
            if (dependent && (!successor || successor.expectedOperationId !== dependent.operationId || successor.mutation.localSequence !== dependent.localSequence)) { finish('stale-local'); return; }
            if (dependent && successor) {
              const replacement = checkedDraft(successor.mutation);
              if (replacement.uid !== uid || replacement.itemId !== predecessor.itemId || replacement.predecessorOperationId !== null || replacement.stage !== 'queued' ||
                  replacement.baseRevision !== result.receipt.resultRevision || JSON.stringify(replacement.baseSnapshot) !== JSON.stringify(predecessor.proposedSnapshot) ||
                  replacement.mutationKind !== dependent.mutationKind || JSON.stringify(replacement.proposedSnapshot) !== JSON.stringify(dependent.proposedSnapshot)) throw integrity();
              tx.objectStore('drafts').delete([uid, dependent.operationId]);
              tx.objectStore('drafts').add(replacement);
            }
            request(tx.objectStore('heads').get([uid, predecessor.itemId]), (headValue: unknown) => {
              if (headValue !== undefined) {
                const head = checkedHead(headValue);
                if (head.activeOperationId === operationId) tx.objectStore('heads').put({ ...head, activeOperationId: null });
                else if (dependent && successor && head.activeOperationId === dependent.operationId) tx.objectStore('heads').put({ ...head, activeOperationId: successor.mutation.operationId });
              }
              tx.objectStore('drafts').delete([uid, operationId]);
              request(rows<unknown>(tx, 'resolutions', uid), (values) => {
                for (const value of values) {
                  const resolution = checkedResolution(value);
                  if (resolution.replacementOperationId === operationId) tx.objectStore('resolutions').put({ ...resolution, status: 'confirmed' });
                }
                finish('acknowledged');
              });
            });
          });
        });
      }, uid);
    },
    async markConflict(uid, operationId, remote: CalendarItem) {
      return run(['drafts'], 'readwrite', (tx, finish, request) => {
        request(tx.objectStore('drafts').get([uid, operationId]), (value: unknown) => {
          if (value === undefined) { finish(undefined); return; }
          const failed = checkedDraft(value);
          if (!validateCanonicalItem(remote).valid || remote.id !== failed.itemId) throw integrity();
          request(itemDrafts(tx, uid, failed.itemId), (values) => {
            for (const entry of values.map(checkedDraft)) tx.objectStore('drafts').put({ ...entry, stage: 'conflicted', remoteSnapshot: remote });
            finish(undefined);
          });
        });
      }, uid);
    },
    async resolve(resolution, expectedLocalSequence, replacement) {
      checkedResolution(resolution);
      if (replacement) checkedDraft(replacement);
      return run(['drafts', 'heads', 'resolutions'], 'readwrite', (tx, finish, request) => {
        request(tx.objectStore('heads').get([resolution.uid, resolution.itemId]), (value: unknown) => {
          const head = value === undefined ? null : checkedHead(value);
          request(itemDrafts(tx, resolution.uid, resolution.itemId), (values) => {
            const drafts = values.map(checkedDraft);
            const current = drafts.find((entry) => entry.operationId === head?.activeOperationId) ?? null;
            if (!current || current.localSequence !== expectedLocalSequence || current.stage !== 'conflicted' || JSON.stringify(drafts) !== JSON.stringify(resolution.drafts)) { finish({ status: 'stale-local', current }); return; }
            const apply = (newHead: JournalHead | null) => {
              if (replacement && replacement.itemId !== resolution.itemId && newHead?.activeOperationId !== null && newHead !== null) { finish({ status: 'stale-local', current }); return; }
              tx.objectStore('resolutions').add(resolution);
              for (const entry of drafts) tx.objectStore('drafts').delete([resolution.uid, entry.operationId]);
              tx.objectStore('heads').put({ ...head, activeOperationId: null });
              if (replacement) {
                const pending = { ...replacement, localSequence: (replacement.itemId === resolution.itemId ? head?.localSequence ?? 0 : newHead?.localSequence ?? 0) + 1 };
                tx.objectStore('drafts').add(pending);
                tx.objectStore('heads').put({ uid: pending.uid, itemId: pending.itemId, localSequence: pending.localSequence, activeOperationId: pending.operationId });
                request(rows<unknown>(tx, 'resolutions', resolution.uid), (values) => {
                  for (const value of values) {
                    const previous = checkedResolution(value);
                    if (previous.status === 'pending' && drafts.some((entry) => entry.operationId === previous.replacementOperationId)) {
                      tx.objectStore('resolutions').put({ ...previous, replacementOperationId: pending.operationId });
                    }
                  }
                  finish({ status: 'queued', mutation: pending });
                });
              } else request(rows<unknown>(tx, 'resolutions', resolution.uid), (values) => {
                for (const value of values) {
                  const previous = checkedResolution(value);
                  if (previous.status === 'pending' && drafts.some((entry) => entry.operationId === previous.replacementOperationId)) {
                    tx.objectStore('resolutions').put({ ...previous, status: 'confirmed', replacementOperationId: null });
                  }
                }
                finish({ status: 'resolved' });
              });
            };
            if (replacement && replacement.itemId !== resolution.itemId) request(tx.objectStore('heads').get([resolution.uid, replacement.itemId]), (value: unknown) => apply(value === undefined ? null : checkedHead(value)));
            else apply(head);
          });
        });
      }, resolution.uid);
    },
    async clear(uid, expected) {
      return run(STORES, 'readwrite', (tx, finish, request) => {
        let remaining = STORES.length;
        let stale = false;
        const keysByStore = new Map<string, IDBValidKey[]>();
        for (const name of STORES) request(rows<unknown>(tx, name, uid), (values) => {
          const keyName = name === 'drafts' ? 'operationId' : name === 'heads' ? 'itemId' : 'resolutionId';
          keysByStore.set(name, values.map((value) => {
            if (!object(value) || typeof value[keyName] !== 'string' || value.uid !== uid) throw integrity();
            return [uid, value[keyName]];
          }));
          if (expected) {
            const prior = name === 'drafts' ? expected.drafts : name === 'heads' ? expected.heads : expected.resolutions;
            const sort = (entries: unknown[]) => entries.slice().sort((a, b) => {
              if (!object(a) || !object(b)) throw integrity();
              return String(a[keyName]).localeCompare(String(b[keyName]));
            });
            if (JSON.stringify(sort(values)) !== JSON.stringify(sort(prior))) stale = true;
          }
          if (--remaining === 0) {
            if (stale) { finish('stale-local'); return; }
            for (const [storeName, keys] of keysByStore) for (const key of keys) tx.objectStore(storeName).delete(key);
            finish('cleared');
          }
        });
      }, uid);
    },
    subscribe(uid, callback) {
      const callbacks = listeners.get(uid) ?? new Set();
      callbacks.add(callback); listeners.set(uid, callbacks);
      return () => { callbacks.delete(callback); if (callbacks.size === 0) listeners.delete(uid); };
    },
    close() {
      void connection?.then((db) => db.close(), () => {});
      connection = null;
      channel?.close(); channel = null; listeners.clear();
    },
  };
  return store;
}
