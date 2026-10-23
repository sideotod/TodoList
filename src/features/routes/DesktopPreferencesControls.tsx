'use client';

import { useState } from 'react';
import { DEFAULT_DESKTOP_PREFERENCES, saveDesktopPreferences, useDesktopPreferences } from '../../lib/desktop-preferences';
import { SettingsControl } from './SettingsControl';
import { SettingsDropdown } from './SettingsDropdown';
import { SettingsSection } from './SettingsSection';
import { formatTimeZoneLabel, getTimeZoneOptions } from './time-zone-label';
import styles from './DesktopPreferencesControls.module.css';

export function DesktopPreferencesControls() {
  const preferences = useDesktopPreferences();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function update(patch: Partial<typeof preferences>) {
    const next = { ...preferences, ...patch };
    try {
      saveDesktopPreferences(next);
      setMessage('이 기기에 저장됨');
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '설정을 저장하지 못했습니다.');
      setMessage('');
    }
  }

  return (
    <>
      <SettingsSection title="캘린더 설정">
        <SettingsControl label="주 시작일" description="주간 시간표 날짜 순서" control={(
          <SettingsDropdown ariaLabel="주 시작일" onChange={(value) => update({ weekStartsOn: Number(value) as 0 | 1 })} options={[{ value: '0', label: '일요일' }, { value: '1', label: '월요일' }]} value={preferences.weekStartsOn} />
        )} />
        <SettingsControl label="시간 표시" control={(
          <SettingsDropdown ariaLabel="시간 표시" onChange={(value) => update({ timeFormat: value as '12h' | '24h' })} options={[{ value: '24h', label: '24시간' }, { value: '12h', label: '12시간' }]} value={preferences.timeFormat} />
        )} />
        <SettingsControl label="시간대" description="날짜와 시각을 해석하는 기준" control={(
          <SettingsDropdown ariaLabel="시간대" onChange={(value) => update({ timeZone: value })} options={getTimeZoneOptions(preferences.timeZone).map(({ value, label }) => ({ value, label: formatTimeZoneLabel(value, label) }))} value={preferences.timeZone} />
        )} />
      </SettingsSection>
      <p className={styles.accentNote}>
        <span aria-hidden="true" className={styles.accentSwatch} />
        <span>강조색</span>
        <strong>Apple Blue</strong>
      </p>
      {message && <p className={styles.status} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.reset} onClick={() => update(DEFAULT_DESKTOP_PREFERENCES)} type="button">기본 설정 복원</button>
    </>
  );
}
