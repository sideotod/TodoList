'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ConfigResult } from '../lib/supabase/config';
import type { Database } from '../lib/supabase/database.types';
import {
  createAuthClient,
  observeAuth,
  readPublicSupabaseConfig,
  redirectToGoogle,
  signOutFromSupabase,
} from './client';

export type SignOutChoice = 'flush' | 'export-and-retain' | 'retain' | 'discard';
export type AuthSession =
  | { status: 'resolving' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; uid: string; generation: number; displayName: string | null; email: string | null }
  | { status: 'error'; message: string };
export type SignOutPreflight = (choice: SignOutChoice) => Promise<void>;

type AuthContextValue = {
  config: ConfigResult | null;
  session: AuthSession;
  signInWithGoogle: () => Promise<void>;
  requestSignOut: (choice: SignOutChoice) => Promise<void>;
  registerSignOutPreflight: (handler: SignOutPreflight) => () => void;
  busy: boolean;
  actionError: string | null;
  clearActionError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(user: User | null, generation: number): AuthSession {
  return user
    ? {
        status: 'signed-in',
        uid: user.id,
        generation,
        displayName: typeof user.user_metadata.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata.name === 'string' ? user.user_metadata.name : null,
        email: user.email ?? null,
      }
    : { status: 'signed-out' };
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [config] = useState<ConfigResult>(readPublicSupabaseConfig);
  const [session, setSession] = useState<AuthSession>({ status: 'resolving' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<SupabaseClient<Database> | null>(null);
  const preflightRef = useRef<SignOutPreflight | null>(null);

  useEffect(() => {
    const result = createAuthClient();
    if (result.status !== 'configured') return;
    clientRef.current = result.client;
    let active = true;
    let generation = 0;
    let previousUid: string | null = null;
    const publishUser = (user: User | null) => {
      if (!active) return;
      const nextUid = user?.id ?? null;
      if (nextUid !== previousUid) {
        generation += 1;
        previousUid = nextUid;
      }
      setSession(toSession(user, generation));
      setActionError(null);
    };
    const stopObserving = observeAuth(result.client, publishUser);
    void result.client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setSession({ status: 'error', message: error.message });
      else publishUser(data.session?.user ?? null);
    }).catch((error: unknown) => {
      if (active) setSession({ status: 'error', message: error instanceof Error ? error.message : '로그인 상태를 확인하지 못했습니다.' });
    });
    return () => {
      active = false;
      stopObserving();
      clientRef.current = null;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('Supabase 설정을 먼저 완료해 주세요.');
    setBusy(true);
    setActionError(null);
    try {
      await redirectToGoogle(client);
    } catch {
      const message = 'Google 로그인으로 이동하지 못했습니다. 연결과 Supabase Auth 제공자 설정을 확인해 주세요.';
      setActionError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const requestSignOut = useCallback(async (choice: SignOutChoice) => {
    const client = clientRef.current;
    if (!client) throw new Error('로그인 상태를 확인할 수 없습니다.');
    setBusy(true);
    setActionError(null);
    try {
      const preflight = preflightRef.current;
      if (preflight) {
        await preflight(choice);
      } else if (choice !== 'retain') {
        throw new Error('저장소가 연결된 뒤 로그아웃 옵션을 사용할 수 있습니다.');
      }
      await signOutFromSupabase(client);
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그아웃을 완료하지 못했습니다.';
      setActionError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const registerSignOutPreflight = useCallback((handler: SignOutPreflight) => {
    preflightRef.current = handler;
    return () => {
      if (preflightRef.current === handler) preflightRef.current = null;
    };
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);
  const value: AuthContextValue = {
    config,
    session,
    signInWithGoogle,
    requestSignOut,
    registerSignOutPreflight,
    busy,
    actionError,
    clearActionError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.');
  return value;
}
