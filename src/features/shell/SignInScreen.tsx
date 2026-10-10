'use client';

import { useState } from 'react';
import { useAuth } from '../../auth/session';
import styles from './SignInScreen.module.css';

export function SignInScreen() {
  const { signInWithGoogle, busy, actionError } = useAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSignIn() {
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '로그인을 시작하지 못했습니다.');
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="sign-in-title">
        <h1 id="sign-in-title">일정을 이어서 관리해요</h1>
        <p>같은 계정으로 로그인하면 내 일정과 할 일을 기기 사이에서 확인할 수 있습니다.</p>
        <button className={styles.button} type="button" disabled={busy} onClick={handleSignIn}>
          {busy ? 'Google 로그인으로 이동 중…' : 'Google로 계속하기'}
        </button>
        {(localError || actionError) && <p className={styles.error} role="alert">{localError || actionError}</p>}
        <p className={styles.offline}>첫 로그인에는 인터넷 연결이 필요합니다.</p>
      </section>
    </main>
  );
}
