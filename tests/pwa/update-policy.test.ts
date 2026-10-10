import { describe, expect, it } from 'vitest';
import { evaluateUpdateGuard } from '../../src/pwa/update-policy';

describe('evaluateUpdateGuard', () => {
  it('blocks an update while an editor contains unsaved input', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: true, localWriteInFlight: false, journalAvailable: true, waitingWorkerAvailable: true, userConfirmed: true }))
      .toEqual({ allowed: false, reason: 'dirty-form' });
  });

  it('blocks an update while a local journal write is in flight', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: true, journalAvailable: true, waitingWorkerAvailable: true, userConfirmed: true }))
      .toEqual({ allowed: false, reason: 'write-in-flight' });
  });

  it('blocks an update when the local journal is unavailable', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: false, journalAvailable: false, waitingWorkerAvailable: true, userConfirmed: true }))
      .toEqual({ allowed: false, reason: 'journal-unavailable' });
  });

  it('requires an explicit user action and a waiting worker', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: false, journalAvailable: true, waitingWorkerAvailable: true, userConfirmed: false }))
      .toEqual({ allowed: false, reason: 'confirmation-required' });
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: false, journalAvailable: true, waitingWorkerAvailable: false, userConfirmed: true }))
      .toEqual({ allowed: false, reason: 'no-waiting-worker' });
  });

  it('does not reload the first worker installation as an update', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: false, journalAvailable: true, activeWorkerAvailable: false, waitingWorkerAvailable: true, userConfirmed: true }))
      .toEqual({ allowed: false, reason: 'no-active-worker' });
  });

  it('permits a confirmed update when the journal is durable and the editor is clean', () => {
    expect(evaluateUpdateGuard({ hasDirtyForm: false, localWriteInFlight: false, journalAvailable: true, waitingWorkerAvailable: true, userConfirmed: true }))
      .toEqual({ allowed: true });
  });
});
