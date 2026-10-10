import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createIndexedDbJournal } from '../../src/lib/storage/journal';
import { createSyncEngine, prepareDraft } from '../../src/lib/storage/sync';
import { makeTask, withCanonicalMetadata } from '../fixtures/items';
import { deferred, draftInput, ids, NOW_MS, pendingDraft, RemoteFixture } from './helpers';

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.useRealTimers(); });
function setup() {
  const journal = createIndexedDbJournal({ indexedDB: new IDBFactory() });
  const remote = new RemoteFixture();
  const ports = { journal, remote, clock: () => Date.now(), idFactory: ids('operation'), random: () => 0.5 };
  const errors: unknown[] = [];
  const engine = createSyncEngine('user-a', ports, { onError: (error) => errors.push(error) });
  return { journal, remote, ports, engine, errors };
}

describe('immutable operation synchronization', () => {
  it('does not expose the removed importer retry control', () => {
    const { engine, journal } = setup();
    expect(engine).not.toHaveProperty('retryImport');
    engine.dispose(); journal.close();
  });

  it('captures the proposal before hashing even if the caller mutates the form during the async digest', async () => {
    const input = draftInput(makeTask({ title: 'saved input' }));
    const pending = prepareDraft('user-a', input, { clock: () => NOW_MS, idFactory: ids() });
    input.proposedSnapshot.title = 'later form input';
    expect((await pending).proposedSnapshot.title).toBe('saved input');
  });

  it('preserves a queued create null base when a stale caller supplied an existing revision', async () => {
    const current = pendingDraft();
    const result = await prepareDraft('user-a', draftInput(makeTask({ title: 'edit' }), { expectedLocalSequence: 1, baseRevision: 2, baseSnapshot: makeTask({ title: 'remote' }) }), { clock: () => NOW_MS, idFactory: ids() }, current);
    expect(result).toMatchObject({ baseRevision: null, baseSnapshot: null });
  });

  it('hashes normalized immutable payloads before journaling and never includes mutable stage/sequence', async () => {
    const ports = { clock: () => NOW_MS, idFactory: ids() };
    const input = draftInput();
    const a = await prepareDraft('user-a', input, ports);
    const b = await prepareDraft('user-a', { ...input, proposedSnapshot: { title: '과제 제출', completion: 'pending', kind: 'task', timing: { type: 'unscheduled' }, id: 'task-1' } }, ports);
    expect(a.payloadDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(b.payloadDigest).toBe(a.payloadDigest);
    expect((await prepareDraft('user-a', draftInput(makeTask({ title: 'different' })), ports)).payloadDigest).not.toBe(a.payloadDigest);
    expect(a.operationId).not.toBe(b.operationId);
  });

  it('successor_keeps_predecessor_revision after a lost ACK and another device revision', async () => {
    const { journal, remote, ports, engine } = setup();
    const base = makeTask();
    remote.items.set('user-a/task-1', withCanonicalMetadata(base));
    const first = await prepareDraft('user-a', draftInput(makeTask({ title: 'predecessor' }), { baseRevision: 1, baseSnapshot: base }), ports);
    await journal.save(first, null); await journal.markSending('user-a', first.operationId);
    await remote.commit('user-a', { ...first, stage: 'sending' }); // ACK lost.
    await journal.save(await prepareDraft('user-a', draftInput(makeTask({ title: 'successor' }), { expectedLocalSequence: 1, baseRevision: 1, baseSnapshot: base }), ports, { ...first, stage: 'sending' }), 1);
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'other device' }), { revision: 3, lastMutationId: 'other-operation' }));
    await engine.flushPending();
    const pending = (await journal.read('user-a')).drafts;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ stage: 'conflicted', baseRevision: 2, baseSnapshot: { title: 'predecessor' }, proposedSnapshot: { title: 'successor' }, remoteSnapshot: { revision: 3, title: 'other device' } });
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 3, title: 'other device' });
    engine.dispose(); journal.close();
  });

  it('conflicted predecessor stops its successor and preserves both proposals', async () => {
    const { journal, remote, ports, engine } = setup();
    const first = pendingDraft('user-a', { operationId: 'predecessor-operation', baseRevision: 1, baseSnapshot: makeTask() });
    await journal.save(first, null); await journal.markSending('user-a', first.operationId);
    await journal.save(await prepareDraft('user-a', draftInput(makeTask({ title: 'successor input' }), { expectedLocalSequence: 1, baseRevision: 1, baseSnapshot: makeTask() }), ports, { ...first, stage: 'sending' }), 1);
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'remote input' }), { revision: 2 }));
    await engine.flushPending();
    expect((await journal.read('user-a')).drafts).toMatchObject([{ stage: 'conflicted', proposedSnapshot: { title: '과제 제출' } }, { stage: 'conflicted', proposedSnapshot: { title: 'successor input' }, remoteSnapshot: { title: 'remote input' } }]);
    expect(remote.attempts).toHaveLength(1);
    engine.dispose(); journal.close();
  });

  it('sending create-delete confirms the original receipt before sending a revision-bound tombstone', async () => {
    const { journal, remote, ports, engine } = setup();
    const first = await prepareDraft('user-a', draftInput(), ports);
    await journal.save(first, null); await journal.markSending('user-a', first.operationId);
    await remote.commit('user-a', { ...first, stage: 'sending' });
    await journal.save(await prepareDraft('user-a', draftInput(makeTask(), { expectedLocalSequence: 1, mutationKind: 'delete' }), ports, { ...first, stage: 'sending' }), 1);
    await engine.flushPending();
    expect(remote.attempts.slice(1)).toMatchObject([{ operationId: first.operationId, mutationKind: 'upsert' }, { mutationKind: 'delete', baseRevision: 1, baseSnapshot: { title: '과제 제출' } }]);
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 2, deletedAt: '2026-10-03T00:00:00.000Z' });
    expect((await journal.read('user-a')).drafts).toEqual([]);
    engine.dispose(); journal.close();
  });

  it('two senders of the same fixed payload result in one revision and no leftover journal', async () => {
    const { journal, remote, ports, engine } = setup();
    await journal.save(await prepareDraft('user-a', draftInput(), ports), null);
    const second = createSyncEngine('user-a', ports);
    await Promise.all([engine.flushPending(), second.flushPending()]);
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 1 });
    expect(remote.receipts.size).toBe(1);
    expect((await journal.read('user-a')).drafts).toEqual([]);
    second.dispose(); engine.dispose(); journal.close();
  });

  it('retries transient failure with the same operation ID and digest, leaving sending durable meanwhile', async () => {
    const { journal, remote, ports, engine } = setup();
    remote.failures.push({ code: 'persistence', message: 'offline', retryable: true });
    const original = await prepareDraft('user-a', draftInput(), ports);
    await journal.save(original, null);
    await engine.flushPending();
    expect((await journal.read('user-a')).drafts).toMatchObject([{ operationId: original.operationId, stage: 'sending', payloadDigest: original.payloadDigest }]);
    await engine.flushPending();
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 1 });
    expect(remote.attempts.map((draft) => draft.operationId)).toEqual([original.operationId, original.operationId]);
    engine.dispose(); journal.close();
  });

  it('does not repeat permission or integrity failures automatically', async () => {
    const { journal, remote, ports, engine, errors } = setup();
    remote.failures.push({ code: 'permission', message: 'denied', retryable: false });
    await journal.save(await prepareDraft('user-a', draftInput(), ports), null);
    await engine.flushPending(); await engine.flushPending(false);
    expect(remote.items.size).toBe(0);
    expect((await journal.read('user-a')).drafts).toHaveLength(1);
    expect(errors).toMatchObject([{ code: 'permission', retryable: false }]);
    expect(remote.attempts).toHaveLength(1);
    engine.dispose(); journal.close();
  });

  it('automatic retries wait 1,2,4,8,16,30 seconds and keep the same operation after the cap', async () => {
    const { journal, remote, ports, engine } = setup();
    let now = NOW_MS;
    const retryEngine = createSyncEngine('user-a', { ...ports, clock: () => now });
    for (let n = 0; n < 8; n++) remote.failures.push({ code: 'quota', message: 'transient quota', retryable: true });
    await journal.save(await prepareDraft('user-a', draftInput(), ports), null);
    await retryEngine.flushPending();
    for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      now += delay - 1; const attempts = remote.attempts.length;
      await retryEngine.flushPending(false); expect(remote.attempts).toHaveLength(attempts);
      now++; await retryEngine.flushPending(false); expect(remote.attempts).toHaveLength(attempts + 1);
    }
    expect(new Set(remote.attempts.map((operation) => operation.operationId)).size).toBe(1);
    expect((await journal.read('user-a')).drafts).toMatchObject([{ stage: 'sending' }]);
    retryEngine.dispose(); engine.dispose(); journal.close();
  });

  it('does not start network work in the background but resumes unchanged operations in foreground', async () => {
    const { journal, remote, ports } = setup();
    let foreground = false;
    const engine = createSyncEngine('user-a', { ...ports, isForeground: () => foreground });
    await journal.save(await prepareDraft('user-a', draftInput(), ports), null);
    await engine.flushPending();
    expect(remote.items.size).toBe(0);
    foreground = true; await engine.flushPending();
    expect(remote.items.size).toBe(1);
    engine.dispose(); journal.close();
  });

  it('disposed sender processes only its old UID ACK and never sends its queued successor', async () => {
    const { journal, remote, ports, engine } = setup();
    remote.delay = deferred<void>();
    const first = await prepareDraft('user-a', draftInput(), ports);
    await journal.save(first, null);
    const flushing = engine.flushPending();
    await vi.waitFor(() => expect(remote.attempts).toHaveLength(1));
    const sending = (await journal.read('user-a')).drafts[0];
    await journal.save(await prepareDraft('user-a', draftInput(makeTask({ title: 'later input' }), { expectedLocalSequence: 1 }), ports, sending), 1);
    engine.dispose(); remote.delay.resolve(); await flushing;
    expect((await journal.read('user-a')).drafts).toMatchObject([{ stage: 'queued', baseRevision: 1, proposedSnapshot: { title: 'later input' } }]);
    expect(remote.attempts).toHaveLength(1);
    expect((await journal.read('user-b')).drafts).toEqual([]);
    journal.close();
  });

  it('finishes an old UID ACK after browser teardown closes its BroadcastChannel and IndexedDB connection', async () => {
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    const { journal, remote, ports, engine } = setup();
    remote.delay = deferred<void>();
    await journal.save(await prepareDraft('user-a', draftInput(), ports), null);
    const flushing = engine.flushPending();
    await vi.waitFor(() => expect(remote.attempts).toHaveLength(1));
    engine.dispose(); journal.close(); remote.delay.resolve();
    let completed = false;
    void flushing.then(() => { completed = true; });
    await vi.waitFor(() => expect(completed).toBe(true));
    expect((await journal.read('user-a')).drafts).toEqual([]);
    journal.close(); vi.unstubAllGlobals();
  });
});
