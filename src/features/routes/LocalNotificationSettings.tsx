'use client';

import { useState } from 'react';
import type { ItemView } from '../../domain/items';
import { updateLocalPreviewState } from '../../lib/local-preview-store';
import styles from './LocalNotificationSettings.module.css';

export function LocalNotificationSettings({ items, enabled }: { items: readonly ItemView[]; enabled: boolean }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function changeEnabled(next: boolean) {
    setStatus('');
    if (!next) {
      try {
        updateLocalPreviewState(items, (current) => ({ ...current, remindersEnabled: false }));
      } catch {
        setStatus('브라우저 로컬 저장소에 설정을 저장하지 못했습니다.');
      }
      return;
    }
    if (!window.isSecureContext || typeof Notification === 'undefined') {
      setStatus('이 환경에서는 기기 알림을 지원하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? '브라우저 설정에서 알림 권한을 허용한 뒤 다시 켜 주세요.' : '알림 권한을 허용하면 사용할 수 있습니다.');
        return;
      }
      updateLocalPreviewState(items, (current) => ({ ...current, remindersEnabled: true }));
    } catch {
      setStatus('알림 권한을 확인하지 못했습니다. 브라우저 설정을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="local-reminder-title" className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2 id="local-reminder-title">기기 알림</h2>
          <p>항목별로 고른 시작·마감 알림을 이 기기에서 보냅니다.</p>
        </div>
        <label className={styles.toggle}>
          <span className={styles.srOnly}>기기 알림 사용</span>
          <input checked={enabled} disabled={busy} onChange={(event) => { void changeEnabled(event.currentTarget.checked); }} type="checkbox" />
          <span aria-hidden="true" className={styles.track}><span className={styles.thumb} /></span>
        </label>
      </div>
      <p className={styles.note}>기본은 꺼짐입니다. 켜면 앱이 열려 있는 동안 확인하며, 앱을 닫은 상태의 예약 알림은 제공하지 않습니다.</p>
      {status && <p className={styles.status} role="status">{status}</p>}
      {enabled && <p className={styles.enabled} role="status">알림 사용 중 · 앱이 열려 있을 때만 동작합니다.</p>}
    </section>
  );
}
