'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../auth/session';
import { useItems, useSyncState } from '../../lib/repository-context';
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
import { HomeExperience } from '../home/HomeExperience';
import styles from './ProfileRoute.module.css';

type SettingsTab = 'screen' | 'calendar' | 'data';
const tabs: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: 'screen', label: '화면' },
  { id: 'calendar', label: '캘린더' },
  { id: 'data', label: '데이터' },
];

export function ProfileRoute({ initialNowMs }: { initialNowMs: number }) {
  const nowMs = useForegroundClock(initialNowMs);
  const router = useRouter();
  const serverItems = useItems();
  const { session, requestSignOut, busy, actionError } = useAuth();
  const syncState = useSyncState();
  const localDate = getLocalDate(nowMs, 'Asia/Seoul');
  const localFixture = useMemo(() => createLocalPreviewFixture(localDate), [localDate]);
  const previewState = useLocalPreviewState(localFixture.items);
  const preferences = useDesktopPreferences();
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('screen');
  async function handleSignOut() {
    setLocalError(null);
    try {
      await requestSignOut('retain');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '로그아웃을 완료하지 못했습니다.');
    }
  }

  function closeInspector() {
    router.push(new URLSearchParams(window.location.search).has('preview') ? '/?preview=design' : '/');
  }

  const homePreview = <HomeExperience items={previewState.items} nowMs={nowMs} todayDate={localDate} preview />;
  const homeAccount = <HomeExperience items={serverItems} nowMs={nowMs} todayDate={localDate} />;
  const previewInspector = (
    <SettingsInspector accountTitle="로컬 메모" activeTab={activeTab} onClose={closeInspector} onSelectTab={setActiveTab}>
      {activeTab === 'screen' && <>
        <DesktopPreferencesControls mode="screen" />
        <SettingsSection title="알림"><LocalNotificationSettings enabled={previewState.remindersEnabled} items={previewState.items} /></SettingsSection>
        <p className={styles.note}>이 프로토타입은 기존 GitHub 앱과 달리 서버 계정 동기화를 하지 않습니다. 메모 데이터는 가능한 경우 이 브라우저의 로컬 저장소에 보관됩니다.</p>
      </>}
      {activeTab === 'calendar' && <DesktopPreferencesControls mode="calendar" />}
      {activeTab === 'data' && <>
        <SettingsSection title="데이터 관리"><LocalDataSettings fallback={localFixture.items} preferences={preferences} state={previewState} /></SettingsSection>
      </>}
    </SettingsInspector>
  );
  const accountInspector = (
    <SettingsInspector accountTitle={session.status === 'signed-in' ? session.displayName || session.email || 'Google 계정' : '계정'} activeTab={activeTab} onClose={closeInspector} onSelectTab={setActiveTab}>
      {activeTab === 'screen' && <>
        <DesktopPreferencesControls mode="screen" />
        <SettingsSection title="알림"><p className={styles.note}>계정 연결 환경의 기기 알림은 아직 제공되지 않습니다. 로컬 미리보기에서는 브라우저 권한을 허용했을 때 앱이 열려 있는 동안 알림을 보낼 수 있습니다.</p></SettingsSection>
      </>}
      {activeTab === 'calendar' && <DesktopPreferencesControls mode="calendar" />}
      {activeTab === 'data' && <>
        <SettingsSection title="계정"><p className={styles.syncMessage}>{session.status === 'signed-in' ? session.email || 'Google 계정으로 로그인했습니다.' : '로그인 상태를 확인하고 있습니다.'}</p></SettingsSection>
        <SettingsSection title="기기 동기화">
          <p className={styles.syncMessage}>{getSyncMessage(syncState.connection, syncState.pendingCount, syncState.conflictCount)}</p>
          {syncState.localJournal === 'unavailable' && <p className={styles.error} role="alert">기기에 변경사항을 저장할 수 없습니다.</p>}
          {syncState.error && <p className={styles.error} role="alert">{syncState.error.message}</p>}
        </SettingsSection>
        <BackupControls />
        <button className={styles.signOut} disabled={busy} onClick={() => { void handleSignOut(); }} type="button">{busy ? '로그아웃 중…' : '로그아웃'}</button>
        {(localError || actionError) && <p className={styles.error} role="alert">{localError || actionError}</p>}
      </>}
    </SettingsInspector>
  );

  return (
    <AppShell
      inspector={accountInspector}
      onCloseInspector={closeInspector}
      previewContent={homePreview}
      previewInspector={previewInspector}
      previewItems={localFixture.items}
      todayDate={localDate}
    >
      {homeAccount}
    </AppShell>
  );
}

function SettingsInspector({ accountTitle, activeTab, onClose, onSelectTab, children }: {
  accountTitle: string;
  activeTab: SettingsTab;
  onClose: () => void;
  onSelectTab: (tab: SettingsTab) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className={styles.inspectorHeader}>
        <span>설정 · {accountTitle}</span>
        <button aria-label="설정 닫기" onClick={onClose} type="button">×</button>
      </header>
      <div className={styles.inspectorBody}>
        <span className={styles.eyebrow}>PREFERENCES</span>
        <h2>설정</h2>
        <div aria-label="설정 범주" className={styles.tabs} role="tablist">
          {tabs.map((tab) => <button aria-controls="settings-tab-panel" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? styles.activeTab : ''} id={`settings-tab-${tab.id}`} key={tab.id} onClick={() => onSelectTab(tab.id)} role="tab" type="button">{tab.label}</button>)}
        </div>
        <div aria-labelledby={`settings-tab-${activeTab}`} className={styles.tabPanel} id="settings-tab-panel" role="tabpanel">{children}</div>
      </div>
    </>
  );
}

function getSyncMessage(connection: 'online' | 'offline' | 'unknown', pendingCount: number, conflictCount: number): string {
  if (conflictCount > 0) return `충돌 ${conflictCount}건을 확인해야 합니다.`;
  if (pendingCount > 0) return `기기 저장 완료 · 동기화 대기 ${pendingCount}건`;
  if (connection === 'online') return '동기화 완료';
  if (connection === 'offline') return '오프라인 · 기기 저장 상태를 확인해 주세요.';
  return '연결 상태를 확인하고 있습니다.';
}
