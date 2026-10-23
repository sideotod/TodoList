'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/session';
import { useSyncState } from '../../lib/repository-context';
import { useDesktopPreferences } from '../../lib/desktop-preferences';
import { AppShell } from '../shell/AppShell';
import { BackupControls } from './BackupControls';
import { LocalNotificationSettings } from './LocalNotificationSettings';
import { createLocalPreviewFixture } from '../home/preview-data';
import { useLocalPreviewState } from '../../lib/local-preview-store';
import { getLocalDate } from '../../domain/time';
import { useForegroundClock } from '../shell/useForegroundClock';
import { DesktopPreferencesControls } from './DesktopPreferencesControls';
import { SettingsSection } from './SettingsSection';
import { LocalDataSettings } from './LocalDataSettings';
import styles from './ProfileRoute.module.css';

export function ProfileRoute({ initialNowMs }: { initialNowMs: number }) {
  const nowMs = useForegroundClock(initialNowMs);
  const { session, requestSignOut, busy, actionError } = useAuth();
  const syncState = useSyncState();
  const localDate = getLocalDate(nowMs, 'Asia/Seoul');
  const localFixture = useMemo(() => createLocalPreviewFixture(localDate), [localDate]);
  const previewState = useLocalPreviewState(localFixture.items);
  const preferences = useDesktopPreferences();
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSignOut() {
    setLocalError(null);
    try {
      await requestSignOut('retain');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '로그아웃을 완료하지 못했습니다.');
    }
  }

  const preview = (
    <main className={styles.preview}>
      <h1>설정</h1>
      <div className={styles.identity}>
        <Image alt="" className={styles.avatar} height={32} src="/design/user.svg" unoptimized width={32} />
        <div className={styles.identityCopy}>
          <strong>{session.status === 'signed-in' ? session.displayName || '사용자' : '로컬 사용'}</strong>
          <span>{session.status === 'signed-in' ? session.email : '일정과 설정은 이 브라우저에 저장되며 다른 기기와 동기화되지 않습니다.'}</span>
        </div>
        <span className={styles.value}>{session.status === 'signed-in' ? '로그인됨' : '이 기기'}</span>
      </div>
      <DesktopPreferencesControls />
      <SettingsSection title="알림">
        <LocalNotificationSettings items={previewState.items} enabled={previewState.remindersEnabled} />
      </SettingsSection>
      <SettingsSection title="데이터 관리">
        <LocalDataSettings fallback={localFixture.items} state={previewState} preferences={preferences} />
      </SettingsSection>
    </main>
  );

  const account = session.status === 'signed-in' ? (
    <main className={styles.page}>
      <h1>설정</h1>
      <div className={styles.identity}>
        <Image alt="" className={styles.avatar} height={32} src="/design/user.svg" unoptimized width={32} />
        <div className={styles.identityCopy}>
          <strong>{session.displayName || 'Google 계정'}</strong>
          <span>{session.email}</span>
        </div>
        <span className={styles.value}>로그인됨</span>
      </div>
      <SettingsSection title="기기 동기화">
        <p className={styles.syncMessage}>{getSyncMessage(syncState.connection, syncState.pendingCount, syncState.conflictCount)}</p>
        {syncState.localJournal === 'unavailable' && <p className={styles.error} role="alert">기기에 변경사항을 저장할 수 없습니다.</p>}
        {syncState.error && <p className={styles.error} role="alert">{syncState.error.message}</p>}
      </SettingsSection>
      <DesktopPreferencesControls />
      <BackupControls />
      <button className={styles.signOut} type="button" disabled={busy} onClick={handleSignOut}>{busy ? '로그아웃 중…' : '로그아웃'}</button>
      {(localError || actionError) && <p className={styles.error} role="alert">{localError || actionError}</p>}
    </main>
  ) : <main className={styles.page}><h1>설정</h1></main>;

  return (
    <AppShell previewItems={localFixture.items} previewContent={preview}>
      {account}
    </AppShell>
  );
}

function getSyncMessage(connection: 'online' | 'offline' | 'unknown', pendingCount: number, conflictCount: number): string {
  if (conflictCount > 0) return `충돌 ${conflictCount}건을 확인해야 합니다.`;
  if (pendingCount > 0) return `기기 저장 완료 · 동기화 대기 ${pendingCount}건`;
  if (connection === 'online') return '동기화 완료';
  if (connection === 'offline') return '오프라인 · 기기 저장 상태를 확인해 주세요.';
  return '연결 상태를 확인하고 있습니다.';
}
