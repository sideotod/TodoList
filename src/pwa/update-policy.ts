export type UpdateGuardInput = {
  hasDirtyForm: boolean;
  localWriteInFlight: boolean;
  journalAvailable: boolean;
  activeWorkerAvailable?: boolean;
  waitingWorkerAvailable: boolean;
  userConfirmed: boolean;
};

export type UpdateBlockReason =
  | 'dirty-form'
  | 'write-in-flight'
  | 'journal-unavailable'
  | 'confirmation-required'
  | 'no-waiting-worker'
  | 'no-active-worker';

export type UpdateGuardResult =
  | { allowed: true }
  | { allowed: false; reason: UpdateBlockReason };

export function evaluateUpdateGuard(input: UpdateGuardInput): UpdateGuardResult {
  if (input.hasDirtyForm) return { allowed: false, reason: 'dirty-form' };
  if (input.localWriteInFlight) return { allowed: false, reason: 'write-in-flight' };
  if (!input.journalAvailable) return { allowed: false, reason: 'journal-unavailable' };
  if (!input.userConfirmed) return { allowed: false, reason: 'confirmation-required' };
  if (!input.waitingWorkerAvailable) return { allowed: false, reason: 'no-waiting-worker' };
  if (input.activeWorkerAvailable === false) return { allowed: false, reason: 'no-active-worker' };
  return { allowed: true };
}
