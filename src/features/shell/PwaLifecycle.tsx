'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/session';
import { useRepositoryStatus, useSyncState } from '../../lib/repository-context';
import { applyWaitingUpdate, registerPwa } from '../../pwa/client';
import type { UpdateBlockReason } from '../../pwa/update-policy';
import { UpdatePrompt } from './UpdatePrompt';

export function PwaLifecycle() {
  const { config, session } = useAuth();
  const repository = useRepositoryStatus();
  const syncState = useSyncState();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let disposed = false;
    let handle: Awaited<ReturnType<typeof registerPwa>> | null = null;

    void registerPwa((nextRegistration) => {
      if (disposed) return;
      setRegistration(nextRegistration);
      setDismissed(false);
    }).then((nextHandle) => {
      handle = nextHandle;
      if (disposed) nextHandle.dispose();
    }).catch(() => undefined);

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);

  function applyUpdate(): UpdateBlockReason | null {
    if (!registration) return 'no-waiting-worker';
    const hasDirtyForm = document.querySelector('[role="dialog"][data-dirty="true"]') !== null;
    const journalAvailable = config?.status === 'missing' || session.status === 'signed-out'
      || (session.status === 'signed-in' && repository.phase === 'ready' && syncState.localJournal === 'available');
    const result = applyWaitingUpdate(registration, {
      hasDirtyForm,
      localWriteInFlight: syncState.localWriteInFlight,
      journalAvailable,
      userConfirmed: true,
    });
    return result.allowed ? null : result.reason;
  }

  if (!registration || dismissed) return null;
  return <UpdatePrompt onApply={applyUpdate} onDismiss={() => setDismissed(true)} />;
}
