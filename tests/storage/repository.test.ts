import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { SyncState } from '../../src/lib/repository';
import { createRepository } from '../../src/lib/repository';
import { createIndexedDbJournal } from '../../src/lib/storage/journal';
import { makeTask, makeWindow, withCanonicalMetadata } from '../fixtures/items';
import { deferred, draftInput, ids, NOW_MS, RemoteFixture } from './helpers';

const range = { from: '2026-10-01', to: '2026-11-01', timeZone: 'Asia/Seoul' };
function setup() {
  const factory = new IDBFactory();
  const journal = createIndexedDbJournal({ indexedDB: factory });
  const remote = new RemoteFixture();
  const ports = { journal, remote, clock: () => NOW_MS, idFactory: ids('repository') };
  const repository = createRepository({ uid: 'user-a', generation: 1 }, ports);
  return { factory, journal, remote, ports, repository };
}

describe('public repository durability and lifetime', () => {
  it('does not expose the removed ICS import API', () => {
    const { repository, journal } = setup();
    expect(repository).not.toHaveProperty('importIcs');
    expect(repository).not.toHaveProperty('updateImportPreview');
    expect(repository).not.toHaveProperty('commitIcsImport');
    expect(repository).not.toHaveProperty('readImportResult');
    expect(repository).not.toHaveProperty('listImportPreviews');
    repository.dispose(); journal.close();
  });

  it('returns queued after local commit and separates new proposals from canonical metadata in backup', async () => {
    const { repository, journal, remote } = setup();
    const result = await repository.saveDraft(draftInput());
    expect(result).toMatchObject({ status: 'queued', mutation: { stage: 'queued', baseRevision: null } });
    expect(await repository.readItem('task-1')).toMatchObject({ canonical: null, display: { title: '과제 제출' }, localSequence: 1, snapshotSource: 'none', syncState: 'offline-draft' });
    expect(remote.items.size).toBe(0);
    const backup = await repository.exportBackup();
    expect(backup).toMatchObject({ formatVersion: 1, ownerUid: 'user-a', canonicalItems: [], pendingLocalChanges: [{ itemId: 'task-1' }] });
    expect(backup.pendingLocalChanges[0].proposedSnapshot).not.toHaveProperty('revision');
    repository.dispose(); journal.close();
  });

  it('two_tabs_stale_local returns the losing input and existing local proposal without a write', async () => {
    const { repository, journal, ports } = setup();
    const second = createRepository({ uid: 'user-a', generation: 2 }, ports);
    await repository.saveDraft(draftInput());
    await repository.saveDraft(draftInput(makeTask({ title: 'first editor' }), { expectedLocalSequence: 1 }));
    const staleInput = draftInput(makeTask({ title: 'second editor unsaved' }), { expectedLocalSequence: 1 });
    expect(await second.saveDraft(staleInput)).toMatchObject({ status: 'stale-local', current: { proposedSnapshot: { title: 'first editor' } }, input: staleInput });
    expect(await repository.readItem('task-1')).toMatchObject({ display: { title: 'first editor' }, localSequence: 2 });
    second.dispose(); repository.dispose(); journal.close();
  });

  it('queued replacement preserves the original canonical base even if the caller observed a newer remote', async () => {
    const { repository, journal } = setup();
    await repository.saveDraft(draftInput(makeTask({ title: 'local 1' }), { baseRevision: 1, baseSnapshot: makeTask() }));
    await repository.saveDraft(draftInput(makeTask({ title: 'local 2' }), { expectedLocalSequence: 1, baseRevision: 2, baseSnapshot: makeTask({ title: 'new remote' }) }));
    expect((await journal.read('user-a')).drafts).toMatchObject([{ baseRevision: 1, baseSnapshot: { title: '과제 제출' }, proposedSnapshot: { title: 'local 2' } }]);
    repository.dispose(); journal.close();
  });

  it('unsent create-delete never reaches the server', async () => {
    const { repository, journal, remote } = setup();
    await repository.saveDraft(draftInput());
    expect(await repository.saveDraft(draftInput(makeTask(), { expectedLocalSequence: 1, mutationKind: 'delete' }))).toEqual({ status: 'cancelled', itemId: 'task-1' });
    await repository.flushPending();
    expect(remote.items.size).toBe(0);
    expect(await repository.readItem('task-1')).toBeNull();
    repository.dispose(); journal.close();
  });

  it('exposes committed remote revisions through subscription after an explicit flush', async () => {
    const { repository, journal } = setup();
    const changes: string[] = [];
    const unsubscribe = repository.subscribeItems(range, (items) => { if (items[0]) changes.push(items[0].syncState); });
    await repository.saveDraft(draftInput()); await repository.flushPending();
    expect(await repository.readItem('task-1')).toMatchObject({ canonical: { revision: 1 }, localDraft: null, localSequence: null, syncState: 'synced', snapshotSource: 'server' });
    expect(changes).toContain('offline-draft'); expect(changes).toContain('synced');
    unsubscribe(); repository.dispose(); journal.close();
  });

  it('idb_abort_preserves_input: failed durable write preserves form input and cannot bypass the journal', async () => {
    const { repository, journal, remote } = setup();
    await repository.readItem('task-1');
    const save = journal.save.bind(journal);
    journal.save = async () => { throw { code: 'persistence', message: 'transaction abort', retryable: false }; };
    const input = draftInput(makeTask({ title: 'still in form' }));
    const states: SyncState[] = []; repository.subscribeSyncState((state) => states.push(state));
    await expect(repository.saveDraft(input)).rejects.toMatchObject({ code: 'persistence' });
    await repository.flushPending();
    expect(input.proposedSnapshot.title).toBe('still in form');
    expect(await repository.readItem('task-1')).toBeNull();
    expect(remote.items.size).toBe(0);
    expect(states.at(-1)).toMatchObject({ localJournal: 'unavailable', localWriteInFlight: false, error: { code: 'persistence' } });
    journal.save = save; repository.dispose(); journal.close();
  });

  it('ACK journal failure keeps the immutable sending row and exposes journal unavailability until durable recovery', async () => {
    const { repository, remote, journal } = setup();
    const acknowledge = journal.acknowledge.bind(journal);
    journal.acknowledge = async () => { throw { code: 'persistence', message: 'ACK transaction abort', retryable: false }; };
    const states: SyncState[] = []; repository.subscribeSyncState((state) => states.push(state));
    await repository.saveDraft(draftInput()); await repository.flushPending();
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 1 });
    expect((await journal.read('user-a')).drafts).toMatchObject([{ stage: 'sending' }]);
    expect(states.at(-1)).toMatchObject({ localJournal: 'unavailable', error: { code: 'persistence' } });
    journal.acknowledge = acknowledge; await repository.flushPending();
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 1 });
    expect((await journal.read('user-a')).drafts).toEqual([]);
    expect(states.at(-1)).toMatchObject({ localJournal: 'available', error: null });
    repository.dispose(); journal.close();
  });

  it('late_ack_after_uid_switch cannot leak old UID data or start its successor in the new account', async () => {
    const { repository, journal, remote, ports } = setup();
    await repository.saveDraft(draftInput()); remote.delay = deferred<void>();
    const flushing = repository.flushPending();
    await vi.waitFor(() => expect(remote.attempts).toHaveLength(1));
    await repository.saveDraft(draftInput(makeTask({ title: 'old account successor' }), { expectedLocalSequence: 1 }));
    const oldChanges: unknown[] = []; repository.subscribeItems(range, (items) => oldChanges.push(items));
    repository.dispose(); const eventCount = oldChanges.length;
    const next = createRepository({ uid: 'user-b', generation: 2 }, { ...ports, idFactory: ids('next') });
    remote.delay.resolve(); await flushing;
    expect(await next.listItems(range)).toEqual([]);
    expect(await next.exportBackup()).toMatchObject({ ownerUid: 'user-b', pendingLocalChanges: [], canonicalItems: [] });
    expect(oldChanges).toHaveLength(eventCount);
    expect((await journal.read('user-a')).drafts).toMatchObject([{ proposedSnapshot: { title: 'old account successor' }, baseRevision: 1 }]);
    expect(remote.attempts).toHaveLength(1);
    next.dispose(); journal.close();
  });

  it('cache-only first load retains empty-offline provenance instead of asserting an empty server', async () => {
    const { repository, remote, journal } = setup();
    const states: SyncState[] = []; repository.subscribeSyncState((state) => states.push(state));
    remote.emit('user-a', true);
    await repository.listItems(range);
    expect(states.at(-1)).toMatchObject({ connection: 'unknown', remoteCache: 'empty-offline' });
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask())); remote.emit('user-a', true);
    expect(await repository.readItem('task-1')).toMatchObject({ snapshotSource: 'cache' });
    expect((await repository.exportBackup()).canonicalSource).toBe('cache');
    repository.dispose(); journal.close();
  });

  it('offline journal unavailability still allows canonical reads with explicit read-only state', async () => {
    const { journal, remote, ports, repository } = setup(); repository.dispose();
    journal.read = async () => { throw { code: 'persistence', message: 'IDB unavailable', retryable: false }; };
    const readOnly = createRepository({ uid: 'user-a', generation: 2 }, ports);
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask())); remote.emit('user-a');
    expect(await readOnly.readItem('task-1')).toMatchObject({ syncState: 'offline-read-only', canonical: { revision: 1 } });
    await expect(readOnly.saveDraft(draftInput())).rejects.toMatchObject({ code: 'persistence' });
    readOnly.dispose(); journal.close();
  });

  it('keeps local and remote conflict versions until explicit keep-remote resolution', async () => {
    const { repository, remote, journal } = setup();
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'remote' }), { revision: 2 }));
    await repository.saveDraft(draftInput(makeTask({ title: 'local' }), { baseRevision: 1, baseSnapshot: makeTask() })); await repository.flushPending();
    expect(await repository.readItem('task-1')).toMatchObject({ display: { title: 'local' }, syncState: 'conflict', conflictRemote: { title: 'remote', revision: 2 }, localDraft: { baseSnapshot: { title: '과제 제출' } } });
    expect(await repository.resolveConflict('task-1', { choice: 'keep-remote' })).toMatchObject({ status: 'saved', item: { title: 'remote', revision: 2 } });
    expect((await journal.read('user-a')).resolutions).toMatchObject([{ choice: 'keep-remote', status: 'confirmed', drafts: [{ proposedSnapshot: { title: 'local' } }], remoteSnapshot: { title: 'remote' } }]);
    expect(await repository.readItem('task-1')).toMatchObject({ display: { title: 'remote' }, localDraft: null });
    repository.dispose(); journal.close();
  });

  it('resolution edits use the latest remote base and preserve a fresh conflict if the remote changes again', async () => {
    const { repository, remote, journal } = setup();
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'remote' }), { revision: 2 }));
    await repository.saveDraft(draftInput(makeTask({ title: 'local' }), { baseRevision: 1, baseSnapshot: makeTask() })); await repository.flushPending();
    expect(await repository.resolveConflict('task-1', { choice: 'edit', edited: makeTask({ title: 'chosen edit' }) })).toMatchObject({ status: 'queued', mutation: { baseRevision: 2 } });
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'remote again' }), { revision: 3 }));
    await repository.flushPending();
    expect(await repository.readItem('task-1')).toMatchObject({ syncState: 'conflict', display: { title: 'chosen edit' }, conflictRemote: { title: 'remote again', revision: 3 } });
    expect((await journal.read('user-a')).resolutions[0].status).toBe('pending');
    repository.dispose(); journal.close();
  });

  it('tombstone conflict rejects use-local/edit and restores under a new ID while preserving the old tombstone', async () => {
    const { repository, remote, journal } = setup();
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask(), { revision: 2, deletedAt: new Date(NOW_MS).toISOString() }));
    await repository.saveDraft(draftInput(makeTask({ title: 'restore me' }), { baseRevision: 1, baseSnapshot: makeTask() })); await repository.flushPending();
    await expect(repository.resolveConflict('task-1', { choice: 'use-local' })).rejects.toMatchObject({ code: 'validation' });
    await expect(repository.resolveConflict('task-1', { choice: 'edit', edited: makeTask() })).rejects.toMatchObject({ code: 'validation' });
    const result = await repository.resolveConflict('task-1', { choice: 'restore-as-new' });
    expect(result).toMatchObject({ status: 'queued', mutation: { baseRevision: null, mutationKind: 'upsert', proposedSnapshot: { title: 'restore me' } } });
    if (result.status !== 'queued') throw new Error('Expected new queued item');
    expect(result.mutation.itemId).not.toBe('task-1');
    await repository.flushPending();
    expect(remote.items.get('user-a/task-1')).toMatchObject({ revision: 2, deletedAt: new Date(NOW_MS).toISOString() });
    expect(remote.items.get(`user-a/${result.mutation.itemId}`)).toMatchObject({ revision: 1, title: 'restore me', deletedAt: null });
    expect((await journal.read('user-a')).resolutions[0].status).toBe('confirmed');
    repository.dispose(); journal.close();
  });

  it('confirming a later resolution also confirms preserved earlier resolution attempts in the same conflict chain', async () => {
    const { repository, remote, journal } = setup();
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'remote' }), { revision: 2 }));
    await repository.saveDraft(draftInput(makeTask({ title: 'local' }), { baseRevision: 1, baseSnapshot: makeTask() })); await repository.flushPending();
    await repository.resolveConflict('task-1', { choice: 'use-local' });
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: 'changed again' }), { revision: 3 }));
    await repository.flushPending();
    await repository.resolveConflict('task-1', { choice: 'keep-remote' });
    expect((await journal.read('user-a')).resolutions.map((entry) => entry.status)).toEqual(['confirmed', 'confirmed']);
    expect((await journal.read('user-a')).resolutions[0].drafts[0].proposedSnapshot.title).toBe('local');
    repository.dispose(); journal.close();
  });

  it('rejects invalid payloads and implicit loss of period checklist without journaling', async () => {
    const { repository, journal } = setup();
    await expect(repository.saveDraft(draftInput(makeTask({ title: '' })))).rejects.toMatchObject({ code: 'validation', fieldIssues: [{ path: 'title' }] });
    const base = makeWindow({ checklist: [{ id: 'child', title: 'keep this', completed: false }] });
    await expect(repository.saveDraft(draftInput(makeTask({ id: 'window-1' }), { baseRevision: 1, baseSnapshot: base }))).rejects.toMatchObject({ code: 'validation' });
    expect((await journal.read('user-a')).drafts).toEqual([]);
    repository.dispose(); journal.close();
  });

  it('preserves all 11 form rows when checklist exceeds the single-document cap and does not journal or send it', async () => {
    const { repository, journal, remote } = setup();
    const proposed = makeWindow({ checklist: Array.from({ length: 11 }, (_, index) => ({ id: `check-${index}`, title: `입력 ${index + 1}`, completed: false })) });
    const input = draftInput(proposed);
    await expect(repository.saveDraft(input)).rejects.toMatchObject({ code: 'validation', fieldIssues: [{ path: 'checklist', code: 'too_many_items' }] });
    expect(proposed.checklist).toHaveLength(11);
    expect(proposed.checklist[10]).toEqual({ id: 'check-10', title: '입력 11', completed: false });
    expect((await journal.read('user-a')).drafts).toEqual([]);
    expect(remote.items.size).toBe(0);
    repository.dispose(); journal.close();
  });

  it('device clear blocks pending by default and clears only the current UID after explicit discard', async () => {
    const { repository, journal, ports } = setup();
    const other = createRepository({ uid: 'user-b', generation: 2 }, { ...ports, idFactory: ids('other') });
    await repository.saveDraft(draftInput()); await other.saveDraft(draftInput());
    expect(await repository.clearDeviceData({ discardPending: false })).toEqual({ status: 'blocked', reason: 'pending' });
    expect(await repository.clearDeviceData({ discardPending: true })).toEqual({ status: 'cleared' });
    expect((await journal.read('user-a')).drafts).toEqual([]);
    expect((await journal.read('user-b')).drafts).toHaveLength(1);
    other.dispose(); journal.close();
  });

  it('cache clear failure or other-tabs block leaves every journal record intact', async () => {
    const { repository, remote, journal } = setup();
    await repository.saveDraft(draftInput());
    remote.cacheClearError = Object.assign({ code: 'persistence' as const, message: 'other tabs', retryable: false }, { reason: 'other-tabs' });
    expect(await repository.clearDeviceData({ discardPending: true })).toEqual({ status: 'blocked', reason: 'other-tabs' });
    expect((await journal.read('user-a')).drafts).toHaveLength(1);
    remote.cacheClearError = { code: 'persistence', message: 'unrecoverable', retryable: false };
    await expect(repository.clearDeviceData({ discardPending: true })).rejects.toMatchObject({ code: 'persistence' });
    expect((await journal.read('user-a')).drafts).toHaveLength(1);
    repository.dispose(); journal.close();
  });

  it('device clear cannot erase a newer draft saved by another tab during cache clearing', async () => {
    const { repository, remote, journal, ports } = setup();
    await repository.saveDraft(draftInput());
    const gate = deferred<void>();
    let started = false;
    remote.clearReadCache = async () => { started = true; await gate.promise; };
    const second = createRepository({ uid: 'user-a', generation: 2 }, { ...ports, idFactory: ids('second-tab') });
    const clearing = repository.clearDeviceData({ discardPending: true });
    await vi.waitFor(() => expect(started).toBe(true));
    await second.saveDraft(draftInput(makeTask({ title: 'new input while clearing' }), { expectedLocalSequence: 1 }));
    gate.resolve();
    expect(await clearing).toEqual({ status: 'blocked', reason: 'busy' });
    expect((await journal.read('user-a')).drafts).toMatchObject([{ proposedSnapshot: { title: 'new input while clearing' } }]);
    second.dispose(); repository.dispose(); journal.close();
  });

  it('cache clear followed by journal failure reports failure and preserves pending input', async () => {
    const { repository, journal } = setup();
    await repository.saveDraft(draftInput());
    journal.clear = async () => { throw { code: 'persistence', message: 'clear abort', retryable: false }; };
    await expect(repository.clearDeviceData({ discardPending: true })).rejects.toMatchObject({ code: 'persistence' });
    expect((await journal.read('user-a')).drafts).toMatchObject([{ proposedSnapshot: { title: '과제 제출' } }]);
    repository.dispose(); journal.close();
  });

  it('rejects storage-origin malformed canonical snapshots instead of rendering them', async () => {
    const { repository, remote, journal } = setup();
    remote.items.set('user-a/task-1', withCanonicalMetadata(makeTask({ title: '' })));
    const states: SyncState[] = []; repository.subscribeSyncState((state) => states.push(state));
    remote.emit('user-a');
    expect(await repository.readItem('task-1')).toBeNull();
    expect(states.at(-1)).toMatchObject({ error: { code: 'integrity' } });
    repository.dispose(); journal.close();
  });

  it('device clear blocks an in-flight server operation even with discardPending', async () => {
    const { repository, remote, journal } = setup();
    await repository.saveDraft(draftInput()); remote.delay = deferred<void>();
    const flushing = repository.flushPending();
    await vi.waitFor(() => expect(remote.attempts).toHaveLength(1));
    expect(await repository.clearDeviceData({ discardPending: true })).toEqual({ status: 'blocked', reason: 'busy' });
    remote.delay.resolve(); await flushing;
    repository.dispose(); journal.close();
  });
});
