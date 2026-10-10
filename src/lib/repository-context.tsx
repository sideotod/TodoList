'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '../auth/session';
import type { ItemView } from '../domain/items';
import { isDesignPreview, subscribeToLocationChanges } from './design-preview';
import {
  createBrowserRepository,
  type BrowserRepository,
} from './repository-runtime';
import type { Repository, SyncState } from './repository';
import type { QueryRange } from './repository';

const EMPTY_ITEMS: readonly ItemView[] = [];
const ALL_ITEMS_RANGE: QueryRange = {
  from: '0001-01-01',
  to: '9999-12-31',
  timeZone: 'Asia/Seoul',
};
const INITIAL_SYNC_STATE: SyncState = {
  connection: 'unknown',
  localJournal: 'unavailable',
  remoteCache: 'unavailable',
  pendingCount: 0,
  conflictCount: 0,
  localWriteInFlight: false,
  error: null,
};

type RepositoryViewStore = {
  repository: Repository;
  getItems: () => readonly ItemView[];
  subscribeItems: (listener: () => void) => () => void;
  getSyncState: () => SyncState;
  subscribeSyncState: (listener: () => void) => () => void;
  dispose: () => void;
};
type RegistryPhase = 'idle' | 'loading' | 'ready' | 'error';
type RegistrySnapshot = {
  identity: string | null;
  phase: RegistryPhase;
  view: RepositoryViewStore | null;
  error: string | null;
};
type Registry = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => RegistrySnapshot;
  publish: (snapshot: RegistrySnapshot) => void;
};

const IDLE_SNAPSHOT: RegistrySnapshot = { identity: null, phase: 'idle', view: null, error: null };
const RepositoryRegistryContext = createContext<Registry | null>(null);

function createRegistry(): Registry {
  let snapshot = IDLE_SNAPSHOT;
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    publish(next) {
      if (snapshot === next) return;
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

function createViewStore(lease: BrowserRepository): RepositoryViewStore {
  let items: readonly ItemView[] = EMPTY_ITEMS;
  let syncState = INITIAL_SYNC_STATE;
  const itemListeners = new Set<() => void>();
  const syncListeners = new Set<() => void>();
  const stopItems = lease.repository.subscribeItems(ALL_ITEMS_RANGE, (nextItems) => {
    items = nextItems;
    for (const listener of itemListeners) listener();
  });
  const stopSync = lease.repository.subscribeSyncState((nextState) => {
    syncState = nextState;
    for (const listener of syncListeners) listener();
  });
  let disposed = false;

  return {
    repository: lease.repository,
    getItems: () => items,
    subscribeItems(listener) {
      itemListeners.add(listener);
      return () => itemListeners.delete(listener);
    },
    getSyncState: () => syncState,
    subscribeSyncState(listener) {
      syncListeners.add(listener);
      return () => syncListeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopItems();
      stopSync();
      itemListeners.clear();
      syncListeners.clear();
      lease.dispose();
    },
  };
}

export function RepositorySessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { config, session } = useAuth();
  const [registry] = useState(createRegistry);
  const designPreview = useSyncExternalStore(subscribeToLocationChanges, isDesignPreview, () => false);
  const identity = session.status === 'signed-in' ? `${session.uid}:${session.generation}` : null;

  useEffect(() => {
    let cancelled = false;
    let view: RepositoryViewStore | null = null;
    if (designPreview || !identity || session.status !== 'signed-in' || config?.status !== 'configured') {
      queueMicrotask(() => {
        if (!cancelled) registry.publish(IDLE_SNAPSHOT);
      });
      return () => { cancelled = true; };
    }

    const sessionIdentity = identity;
    const sessionUid = session.uid;
    const sessionGeneration = session.generation;
    const supabaseConfig = config.config;
    queueMicrotask(() => {
      if (!cancelled) registry.publish({ identity: sessionIdentity, phase: 'loading', view: null, error: null });
    });

    async function startRepository() {
      try {
        const lease = createBrowserRepository({ uid: sessionUid, generation: sessionGeneration }, supabaseConfig);
        view = createViewStore(lease);
        await lease.repository.listItems(ALL_ITEMS_RANGE);
        if (!cancelled) registry.publish({ identity: sessionIdentity, phase: 'ready', view, error: null });
      } catch (error) {
        view?.dispose();
        view = null;
        const message = error instanceof Error ? error.message : '저장소를 시작하지 못했습니다.';
        if (!cancelled) registry.publish({ identity: sessionIdentity, phase: 'error', view: null, error: message });
      }
    }
    void startRepository();

    return () => {
      cancelled = true;
      view?.dispose();
      queueMicrotask(() => {
        if (registry.getSnapshot().identity === sessionIdentity) registry.publish(IDLE_SNAPSHOT);
      });
    };
  }, [config, designPreview, identity, registry, session]);

  return <RepositoryRegistryContext.Provider value={registry}>{children}</RepositoryRegistryContext.Provider>;
}

function useCurrentSnapshot(): RegistrySnapshot {
  const registry = useContext(RepositoryRegistryContext);
  const { session } = useAuth();
  if (!registry) throw new Error('RepositorySessionProvider 안에서 사용해야 합니다.');
  const snapshot = useSyncExternalStore(registry.subscribe, registry.getSnapshot, () => IDLE_SNAPSHOT);
  const identity = session.status === 'signed-in' ? `${session.uid}:${session.generation}` : null;
  return snapshot.identity === identity ? snapshot : {
    identity,
    phase: identity === null ? 'idle' : 'loading',
    view: null,
    error: null,
  };
}

export function useRepositoryStatus(): { phase: RegistryPhase; error: string | null } {
  const snapshot = useCurrentSnapshot();
  return { phase: snapshot.phase, error: snapshot.error };
}

export function useRepository(): Repository | null {
  return useCurrentSnapshot().view?.repository ?? null;
}

export function useItems(): readonly ItemView[] {
  const view = useCurrentSnapshot().view;
  const subscribe = useCallback((listener: () => void) => view?.subscribeItems(listener) ?? (() => {}), [view]);
  const getSnapshot = useCallback(() => view?.getItems() ?? EMPTY_ITEMS, [view]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_ITEMS);
}

export function useSyncState(): SyncState {
  const view = useCurrentSnapshot().view;
  const subscribe = useCallback((listener: () => void) => view?.subscribeSyncState(listener) ?? (() => {}), [view]);
  const getSnapshot = useCallback(() => view?.getSyncState() ?? INITIAL_SYNC_STATE, [view]);
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_SYNC_STATE);
}
