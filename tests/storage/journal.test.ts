import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { PendingDraft } from '../../src/domain/items';
import { createIndexedDbJournal } from '../../src/lib/storage/journal';
import { makeTask, makeWindow, withCanonicalMetadata } from '../fixtures/items';

const NOW = '2026-10-03T00:00:00.000Z';
export function draft(uid = 'user-a', overrides: Partial<PendingDraft> = {}): PendingDraft {
  return { uid, itemId: 'task-1', operationId: 'operation-1', localSequence: 1, predecessorOperationId: null, baseRevision: null, baseSnapshot: null, proposedSnapshot: makeTask(), mutationKind: 'upsert', stage: 'queued', payloadDigest: 'a'.repeat(64), createdAt: NOW, updatedAt: NOW, ...overrides };
}
let factory: IDBFactory;
beforeEach(() => { factory = new IDBFactory(); });

describe('durable UID-scoped IndexedDB journal', () => {
  it('removes the legacy import store on upgrade while preserving pending drafts', async () => {
    const databaseName = 'legacy-import-journal';
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [name, key] of [['drafts', 'operationId'], ['heads', 'itemId'], ['resolutions', 'resolutionId'], ['imports', 'previewId']]) {
          const store = db.createObjectStore(name, { keyPath: ['uid', key] });
          store.createIndex('uid', 'uid');
          if (name === 'drafts') store.createIndex('itemSequence', ['uid', 'itemId', 'localSequence'], { unique: true });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction(['drafts', 'heads', 'imports'], 'readwrite');
    transaction.objectStore('drafts').add(draft());
    transaction.objectStore('heads').add({ uid: 'user-a', itemId: 'task-1', localSequence: 1, activeOperationId: 'operation-1' });
    transaction.objectStore('imports').add({ uid: 'user-a', previewId: 'preview-1', value: { obsolete: true } });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();

    const migrated = createIndexedDbJournal({ indexedDB: factory, databaseName });
    expect((await migrated.read('user-a')).drafts).toMatchObject([{ operationId: 'operation-1', proposedSnapshot: { title: '과제 제출' } }]);
    expect(await migrated.read('user-a')).not.toHaveProperty('imports');
    expect(await new Promise<boolean>((resolve, reject) => {
      const request = factory.open(databaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const contains = db.objectStoreNames.contains('imports'); db.close(); resolve(contains); };
    })).toBe(false);
    migrated.close();
  });

  it('recovers queued and sending payloads after closing and reopening the database', async () => {
    const first = createIndexedDbJournal({ indexedDB: factory });
    await first.save(draft(), null);
    await first.markSending('user-a', 'operation-1');
    await first.save(draft('user-a', { itemId: 'window-1', operationId: 'window-operation', proposedSnapshot: makeWindow({ checklist: [{ id: 'child-1', title: '성적표', completed: true }] }) }), null);
    first.close();
    const reopened = createIndexedDbJournal({ indexedDB: factory });
    expect((await reopened.read('user-a')).drafts).toMatchObject([{ itemId: 'task-1', stage: 'sending', payloadDigest: 'a'.repeat(64) }, { itemId: 'window-1', stage: 'queued', proposedSnapshot: { checklist: [{ id: 'child-1', completed: true }], startCountdown: { enabled: true, daysBefore: 1 } } }]);
    reopened.close();
  });

  it('two_tabs_stale_local: only one same-sequence edit wins and losing input does not replace it', async () => {
    const a = createIndexedDbJournal({ indexedDB: factory });
    const b = createIndexedDbJournal({ indexedDB: factory });
    await a.save(draft(), null);
    const results = await Promise.all([
      a.save(draft('user-a', { operationId: 'edit-a', proposedSnapshot: makeTask({ title: 'A input' }) }), 1),
      b.save(draft('user-a', { operationId: 'edit-b', proposedSnapshot: makeTask({ title: 'B input' }) }), 1),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['queued', 'stale-local']);
    const pending = (await a.read('user-a')).drafts;
    expect(pending).toHaveLength(1);
    expect(pending[0].localSequence).toBe(2);
    const stale = results.find((result) => result.status === 'stale-local');
    expect(stale).toMatchObject({ current: { operationId: pending[0].operationId } });
    a.close(); b.close();
  });

  it('cancels an unsent create/delete atomically and never creates a sending delete', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.save(draft(), null);
    expect(await store.save(draft('user-a', { operationId: 'delete', mutationKind: 'delete' }), 1)).toEqual({ status: 'cancelled', itemId: 'task-1' });
    expect((await store.read('user-a')).drafts).toEqual([]);
    expect(await store.markSending('user-a', 'delete')).toBeNull();
    store.close();
  });

  it('preserves a sending create when delete is queued behind it', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.save(draft(), null);
    await store.markSending('user-a', 'operation-1');
    await store.save(draft('user-a', { operationId: 'delete', mutationKind: 'delete', predecessorOperationId: 'operation-1' }), 1);
    expect((await store.read('user-a')).drafts).toMatchObject([{ operationId: 'operation-1', stage: 'sending', mutationKind: 'upsert' }, { operationId: 'delete', stage: 'queued', mutationKind: 'delete' }]);
    expect(await store.markSending('user-a', 'delete')).toBeNull();
    store.close();
  });

  it('late duplicate ACK never removes the newer successor or its head', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.save(draft(), null);
    await store.markSending('user-a', 'operation-1');
    await store.save(draft('user-a', { operationId: 'successor', predecessorOperationId: 'operation-1', proposedSnapshot: makeTask({ title: 'later' }) }), 1);
    const result = { status: 'applied' as const, receipt: { itemId: 'task-1', payloadDigest: 'a'.repeat(64), resultRevision: 1, createdAt: NOW }, remote: withCanonicalMetadata(makeTask()) };
    const replacement = draft('user-a', { operationId: 'bound-successor', localSequence: 2, baseRevision: 1, baseSnapshot: makeTask(), proposedSnapshot: makeTask({ title: 'later' }), payloadDigest: 'b'.repeat(64) });
    expect(await store.acknowledge('user-a', 'operation-1', result, { expectedOperationId: 'successor', mutation: replacement })).toBe('acknowledged');
    expect(await store.acknowledge('user-a', 'operation-1', result)).toBe('missing');
    expect((await store.read('user-a')).heads[0]).toMatchObject({ activeOperationId: 'bound-successor', localSequence: 2 });
    expect((await store.read('user-a')).drafts).toHaveLength(1);
    store.close();
  });

  it('checks the successor operation again in the ACK transaction after an edit race', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.save(draft(), null);
    await store.markSending('user-a', 'operation-1');
    await store.save(draft('user-a', { operationId: 'successor', predecessorOperationId: 'operation-1' }), 1);
    await store.save(draft('user-a', { operationId: 'edited-successor', predecessorOperationId: 'operation-1', proposedSnapshot: makeTask({ title: 'latest input' }) }), 2);
    const result = { status: 'applied' as const, receipt: { itemId: 'task-1', payloadDigest: 'a'.repeat(64), resultRevision: 1, createdAt: NOW }, remote: withCanonicalMetadata(makeTask()) };
    expect(await store.acknowledge('user-a', 'operation-1', result, { expectedOperationId: 'successor', mutation: draft('user-a', { operationId: 'stale-bound', localSequence: 2, baseRevision: 1, baseSnapshot: makeTask() }) })).toBe('stale-local');
    expect((await store.read('user-a')).drafts).toMatchObject([{ operationId: 'operation-1' }, { operationId: 'edited-successor', proposedSnapshot: { title: 'latest input' } }]);
    store.close();
  });

  it('keeps drafts and heads isolated on UID-scoped clearing', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.save(draft('user-a'), null);
    await store.save(draft('user-b'), null);
    await store.clear('user-a');
    expect((await store.read('user-a')).drafts).toEqual([]);
    expect((await store.read('user-b')).drafts).toHaveLength(1);
    store.close();
  });

  it('rejects an IndexedDB transaction abort after request success instead of claiming a durable save', async () => {
    const store = createIndexedDbJournal({ indexedDB: factory });
    await store.read('user-a');
    const original = factory.open.bind(factory);
    // Abort the real readwrite transaction after a draft write request succeeds.
    factory.open = ((...args: Parameters<IDBFactory['open']>) => {
      const request = original(...args);
      request.addEventListener('success', () => {
        const db = request.result;
        const transaction = db.transaction.bind(db);
        db.transaction = ((...transactionArgs: Parameters<IDBDatabase['transaction']>) => {
          const tx = transaction(...transactionArgs);
          if (transactionArgs[1] === 'readwrite') {
            const storeOf = tx.objectStore.bind(tx);
            tx.objectStore = (name: string) => {
              const objectStore = storeOf(name);
              if (name === 'drafts') {
                for (const method of ['put', 'add'] as const) {
                  const write = objectStore[method].bind(objectStore);
                  objectStore[method] = (...writeArgs: Parameters<IDBObjectStore['put']>) => {
                    const pending = write(...writeArgs);
                    pending.addEventListener('success', () => tx.abort());
                    return pending;
                  };
                }
              }
              return objectStore;
            };
          }
          return tx;
        }) as IDBDatabase['transaction'];
      });
      return request;
    }) as IDBFactory['open'];
    store.close();
    const failing = createIndexedDbJournal({ indexedDB: factory });
    await expect(failing.save(draft(), null)).rejects.toMatchObject({ code: 'persistence' });
    expect((await failing.read('user-a')).drafts).toEqual([]);
    failing.close();
  });
});
