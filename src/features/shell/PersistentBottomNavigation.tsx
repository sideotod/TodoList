'use client';

import { useSyncExternalStore } from 'react';
import { useAuth } from '../../auth/session';
import { isDesignPreview, subscribeToLocationChanges } from '../../lib/design-preview';
import { useRepositoryStatus } from '../../lib/repository-context';
import { BottomNavigation } from './BottomNavigation';

export function PersistentBottomNavigation() {
  const { config, session } = useAuth();
  const repository = useRepositoryStatus();
  const designPreview = useSyncExternalStore(subscribeToLocationChanges, isDesignPreview, () => false);

  const appReady = designPreview || (
    config?.status === 'configured'
    && session.status === 'signed-in'
    && repository.phase === 'ready'
  );

  return appReady ? <BottomNavigation preview={designPreview} /> : null;
}
