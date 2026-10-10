'use client';

import { useState } from 'react';
import { useRepository } from '../../lib/repository-context';
import styles from './BackupControls.module.css';

const message = (error: unknown) => typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : '데이터를 내보내지 못했습니다.';

export function BackupControls() {
  const repository = useRepository();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');

  async function download() {
    if (!repository) return;
    setBusy(true);
    setError('');
    try {
      const backup = await repository.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `todolist-backup-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setSource(`내보낸 자료: ${backup.canonicalSource === 'server' ? '서버 확인' : '기기 캐시'} · 서버 항목 ${backup.canonicalItems.length} · 기기 변경 ${backup.pendingLocalChanges.length}`);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.backup} aria-label="데이터 백업">
      <h2>데이터 백업</h2>
      <p>일정과 동기화 대기 중인 기기 변경을 JSON 파일로 다운로드합니다.</p>
      <button type="button" disabled={!repository || busy} onClick={download}>{busy ? '백업 준비 중…' : 'JSON 백업 다운로드'}</button>
      {source && <p role="status">{source}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
