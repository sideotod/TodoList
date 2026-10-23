'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ItemView } from '../../domain/items';
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../../auth/session';
import { isDesignPreview, subscribeToLocationChanges } from '../../lib/design-preview';
import { useItems, useRepository, useRepositoryStatus } from '../../lib/repository-context';
import { ConflictResolutionDialog } from '../items/ConflictResolutionDialog';
import { LocalReminderScheduler } from './LocalReminderScheduler';
import { SupabaseSetupGuide } from './SupabaseSetupGuide';
import { SignInScreen } from './SignInScreen';
import { useLocalPreviewState } from '../../lib/local-preview-store';
import { useDesktopPreferences } from '../../lib/desktop-preferences';
import { TodoLogo } from './TodoLogo';
import styles from './AppShell.module.css';

type AppShellProps = {
  children: ReactNode;
  previewContent?: ReactNode;
  previewItems?: readonly ItemView[];
};

export function AppShell({ children, previewContent, previewItems = [] }: AppShellProps) {
  const pathname = usePathname();
  const { config, session } = useAuth();
  const repository = useRepositoryStatus();
  const itemRepository = useRepository();
  const items = useItems();
  const [dismissedConflicts, setDismissedConflicts] = useState<Set<string>>(() => new Set());
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const designPreview = useSyncExternalStore(subscribeToLocationChanges, isDesignPreview, () => false);
  const localOnlyMode = config?.status === 'missing';
  const useLocalWorkspace = designPreview || localOnlyMode;
  const localPreview = useLocalPreviewState(previewItems);
  const desktopPreferences = useDesktopPreferences();
  const conflicts = designPreview ? [] : items.filter((item) => item.syncState === 'conflict');
  const activeConflict = conflicts.find((item) => !dismissedConflicts.has(item.display.id)) ?? null;
  const hideBrand = pathname === '/settings' || pathname.startsWith('/settings/') || pathname === '/calendar' || pathname.startsWith('/calendar/');
  const routeType = pathname.startsWith('/calendar') ? 'calendar' : pathname.startsWith('/settings') ? 'settings' : pathname.startsWith('/tasks') ? 'tasks' : 'home';

  useLayoutEffect(() => {
    document.documentElement.dataset.colorTheme = desktopPreferences.colorTheme;
  }, [desktopPreferences.colorTheme]);

  if (!designPreview && config === null) return <LoadingScreen />;
  if (!designPreview && config?.status === 'invalid') {
    return (
      <>
        <SupabaseSetupGuide />
        {config?.status === 'invalid' && <p className={styles.configError} role="alert">설정값을 확인해 주세요: {config.issues.join(' ')}</p>}
      </>
    );
  }
  if (!useLocalWorkspace && session.status === 'resolving') return <LoadingScreen />;
  if (!useLocalWorkspace && session.status === 'signed-out') return <SignInScreen />;
  if (!useLocalWorkspace && session.status === 'error') {
    return <main className={styles.errorScreen} role="alert">로그인 상태를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</main>;
  }
  if (!useLocalWorkspace && session.status === 'signed-in' && repository.phase !== 'ready') {
    return repository.phase === 'error'
      ? <main className={styles.errorScreen} role="alert">{repository.error ?? '계정 저장소를 시작하지 못했습니다.'}</main>
      : <LoadingScreen label="기기 저장소와 일정을 불러오고 있습니다" />;
  }

  const content = useLocalWorkspace ? previewContent ?? <PreviewAccount /> : children;

  async function resolveConflict(choice: 'keep-remote' | 'use-local' | 'restore-as-new') {
    if (!itemRepository || !activeConflict || resolvingConflict) return;
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const result = choice === 'keep-remote'
        ? await itemRepository.resolveConflict(activeConflict.display.id, { choice: 'keep-remote' })
        : choice === 'use-local'
          ? await itemRepository.resolveConflict(activeConflict.display.id, { choice: 'use-local' })
          : await itemRepository.resolveConflict(activeConflict.display.id, { choice: 'restore-as-new' });
      if (result.status === 'stale-local') setConflictError('다른 탭에서 충돌 상태가 바뀌었습니다. 새 상태를 불러와 주세요.');
    } catch (error) {
      setConflictError(error instanceof Error ? error.message : '충돌을 해결하지 못했습니다.');
    } finally {
      setResolvingConflict(false);
    }
  }

  function dismissConflict() {
    if (!activeConflict) return;
    setDismissedConflicts((current) => new Set(current).add(activeConflict.display.id));
    setConflictError(null);
  }

  function reopenConflict() {
    setDismissedConflicts(new Set());
    setConflictError(null);
  }

  return (
    <div className={styles.frame} data-app-state={designPreview ? 'design-preview' : localOnlyMode ? 'local-only' : 'signed-in'} data-color-theme={desktopPreferences.colorTheme}>
      {useLocalWorkspace && (
        <div className={styles.previewBanner} role="status">
          로컬 모드 · 변경 내용은 이 브라우저에 저장되며 기기 간 동기화되지 않음
        </div>
      )}
      <div className={styles.route} data-route={routeType} key={pathname}>
        {!hideBrand && (
          <div className={styles.brandBar}>
            <Link aria-label="Todo 홈" className={styles.brand} href={designPreview ? '/?preview=design' : '/'}>
              <TodoLogo />
            </Link>
          </div>
        )}
        {content}
      </div>
      {conflicts.length > 0 && !activeConflict && (
        <button className={styles.conflictNotice} onClick={reopenConflict} type="button">
          충돌 {conflicts.length}건 확인
        </button>
      )}
      {activeConflict && (
        <ConflictResolutionDialog
          busy={resolvingConflict}
          error={conflictError}
          item={activeConflict}
          onClose={dismissConflict}
          onKeepRemote={() => resolveConflict('keep-remote')}
          onRestoreAsNew={() => resolveConflict('restore-as-new')}
          onUseLocal={() => resolveConflict('use-local')}
        />
      )}
      {useLocalWorkspace && <LocalReminderScheduler enabled={localPreview.remindersEnabled} items={localPreview.items} offsets={localPreview.reminderOffsets} />}
    </div>
  );
}

function LoadingScreen({ label = '로그인 상태를 확인하고 있습니다' }: { label?: string }) {
  return <main className={styles.loading} aria-busy="true"><TodoLogo loading /><span>{label}</span></main>;
}

function PreviewAccount() {
  return (
    <section className={styles.previewAccount}>
      <p>계정 화면</p>
      <span>미리보기에서는 계정 정보와 설정을 표시하지 않습니다.</span>
    </section>
  );
}
