'use client';

import { useState } from 'react';
import { COLOR_THEMES } from '../../domain/color-themes';
import { DEFAULT_DESKTOP_PREFERENCES, saveDesktopPreferences, useDesktopPreferences } from '../../lib/desktop-preferences';
import { SettingsControl } from './SettingsControl';
import { SettingsDropdown } from './SettingsDropdown';
import { SettingsSection } from './SettingsSection';
import { formatTimeZoneLabel, getTimeZoneOptions } from './time-zone-label';
import styles from './DesktopPreferencesControls.module.css';

export function DesktopPreferencesControls({ mode = 'all' }: { mode?: 'all' | 'screen' | 'calendar' }) {
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
      {mode !== 'screen' && <SettingsSection title="캘린더 설정">
        <SettingsControl label="주 시작일" description="주간 시간표 날짜 순서" control={(
          <SettingsDropdown ariaLabel="주 시작일" onChange={(value) => update({ weekStartsOn: Number(value) as 0 | 1 })} options={[{ value: '0', label: '일요일' }, { value: '1', label: '월요일' }]} value={preferences.weekStartsOn} />
        )} />
        <SettingsControl label="시간 표시" control={(
          <SettingsDropdown ariaLabel="시간 표시" onChange={(value) => update({ timeFormat: value as '12h' | '24h' })} options={[{ value: '24h', label: '24시간' }, { value: '12h', label: '12시간' }]} value={preferences.timeFormat} />
        )} />
        <SettingsControl label="시간대" description="날짜와 시각을 해석하는 기준" control={(
          <SettingsDropdown ariaLabel="시간대" onChange={(value) => update({ timeZone: value })} options={getTimeZoneOptions(preferences.timeZone).map(({ value, label }) => ({ value, label: formatTimeZoneLabel(value, label) }))} value={preferences.timeZone} />
        )} />
      </SettingsSection>}
      {mode !== 'screen' && <SettingsSection title="캘린더에 표시">
        <SettingsControl label="할 일" control={<input aria-label="캘린더에 할 일 표시" checked={preferences.calendarVisibility.tasks} onChange={(event) => update({ calendarVisibility: { ...preferences.calendarVisibility, tasks: event.currentTarget.checked } })} type="checkbox" />} />
        <SettingsControl label="일정" control={<input aria-label="캘린더에 일정 표시" checked={preferences.calendarVisibility.events} onChange={(event) => update({ calendarVisibility: { ...preferences.calendarVisibility, events: event.currentTarget.checked } })} type="checkbox" />} />
        <SettingsControl label="Progress" control={<input aria-label="캘린더에 Progress 표시" checked={preferences.calendarVisibility.progress} onChange={(event) => update({ calendarVisibility: { ...preferences.calendarVisibility, progress: event.currentTarget.checked } })} type="checkbox" />} />
      </SettingsSection>}
      {mode !== 'calendar' && <fieldset className={styles.accentPicker}>
        <legend>강조 색상</legend>
        <div className={styles.accentOptions} role="radiogroup" aria-label="강조 색상">
          {COLOR_THEMES.map((theme) => (
            <button
              aria-checked={preferences.colorTheme === theme.id}
              className={styles.accentOption}
              data-selected={preferences.colorTheme === theme.id}
              key={theme.id}
              onClick={() => update({ colorTheme: theme.id })}
              role="radio"
              style={{ '--theme-accent': theme.accent } as React.CSSProperties}
              type="button"
            >
              <span aria-hidden="true" className={styles.accentSwatch} />{theme.name}
            </button>
          ))}
        </div>
      </fieldset>}
      {message && <p className={styles.status} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.reset} onClick={() => update(DEFAULT_DESKTOP_PREFERENCES)} type="button">기본 설정 복원</button>
    </>
  );
}
