'use client';

import { evaluateUpdateGuard, type UpdateGuardInput, type UpdateGuardResult } from './update-policy';

export type PwaRegistrationHandle = {
  registration: ServiceWorkerRegistration;
  dispose: () => void;
};

export async function registerPwa(onUpdateAvailable: (registration: ServiceWorkerRegistration) => void): Promise<PwaRegistrationHandle> {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  let disposed = false;

  function checkForWaitingWorker() {
    if (!disposed && navigator.serviceWorker.controller && registration.waiting) {
      onUpdateAvailable(registration);
    }
  }

  function watchNewWorker() {
    registration.installing?.addEventListener('statechange', checkForWaitingWorker);
  }

  registration.addEventListener('updatefound', watchNewWorker);
  await registration.update().catch(() => undefined);
  checkForWaitingWorker();
  const updateTimer = window.setInterval(() => {
    void registration.update().catch(() => undefined);
  }, 60 * 60 * 1_000);

  return {
    registration,
    dispose() {
      disposed = true;
      window.clearInterval(updateTimer);
      registration.removeEventListener('updatefound', watchNewWorker);
      registration.installing?.removeEventListener('statechange', checkForWaitingWorker);
    },
  };
}

export function applyWaitingUpdate(registration: ServiceWorkerRegistration, input: Omit<UpdateGuardInput, 'activeWorkerAvailable' | 'waitingWorkerAvailable'>): UpdateGuardResult {
  const waitingWorker = registration.waiting;
  const result = evaluateUpdateGuard({
    ...input,
    activeWorkerAvailable: navigator.serviceWorker.controller !== null,
    waitingWorkerAvailable: waitingWorker !== null,
  });
  if (!result.allowed || !waitingWorker) return result;

  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' });
  return result;
}
