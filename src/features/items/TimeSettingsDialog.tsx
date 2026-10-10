'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EventCountdown, ItemKind } from '../../domain/items';
import { parseLocalDateTime } from '../../domain/time';
import type { ReminderOffset } from '../../lib/local-preview-store';
import { EventFields } from './EventFields';
import { ItemTimingFields } from './ItemTimingFields';
import { DateTimePickerInput } from './DateTimePickerInput';
import type { FoldChoice, TimingMode } from './item-editor-types';
import styles from './TimeSettingsDialog.module.css';

type TimeSettings = {
  mode: Exclude<TimingMode, 'unscheduled'>;
  startDate: string;
  endDate: string;
  startClock: string;
  endClock: string;
  reminderOffset: ReminderOffset | null;
  eventCountdownEnabled: boolean;
  eventCountdownDaysBefore: number;
  eventCountdownReference: EventCountdown['reference'];
  startFold: FoldChoice;
  endFold: FoldChoice;
  hasDeadlineStart: boolean;
  hasWindowEnd: boolean;
};

type TimeSettingsDialogProps = {
  kind: ItemKind;
  initial: TimeSettings;
  selectedDate: string;
  timeZone: string;
  onApply: (settings: TimeSettings) => void;
  onClose: () => void;
};

const REMINDER_OPTIONS: { value: ReminderOffset | null; label: string }[] = [
  { value: 10, label: '10분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 1440, label: '1일 전' },
  { value: null, label: '없음' },
];

export function TimeSettingsDialog({ kind, initial, selectedDate, timeZone, onApply, onClose }: TimeSettingsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<TimeSettings['mode']>(kind === 'task' || kind === 'event' ? 'time' : initial.mode);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [startClock, setStartClock] = useState(initial.startClock);
  const [endClock, setEndClock] = useState(initial.endClock);
  const [reminderOffset, setReminderOffset] = useState(initial.reminderOffset);
  const [eventCountdownEnabled, setEventCountdownEnabled] = useState(initial.eventCountdownEnabled);
  const eventCountdownDaysBefore = initial.eventCountdownDaysBefore;
  const eventCountdownReference = initial.eventCountdownReference;
  const [startFold, setStartFold] = useState<FoldChoice>(initial.startFold);
  const [endFold, setEndFold] = useState<FoldChoice>(initial.endFold);
  const [hasDeadlineStart, setHasDeadlineStart] = useState(initial.hasDeadlineStart);
  const [hasWindowEnd, setHasWindowEnd] = useState(initial.hasWindowEnd);
  const startResolution = useMemo(() => mode === 'time' && startDate && startClock ? parseLocalDateTime(startDate, startClock, timeZone) : null, [mode, startDate, startClock, timeZone]);
  const endResolution = useMemo(() => mode === 'time' && endDate && endClock ? parseLocalDateTime(endDate, endClock, timeZone) : null, [mode, endDate, endClock, timeZone]);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input, select');
    firstField?.focus();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
      .filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const timingProps = {
    mode,
    unscheduled: false,
    startDate,
    endDate,
    startClock,
    endClock,
    timeZone,
    startResolution,
    endResolution,
    startFold,
    endFold,
    errors: {},
    onMode: setMode,
    onUnscheduled: () => undefined,
    onStartDate: (value: string) => { setStartDate(value); setStartFold(null); },
    onEndDate: (value: string) => { setEndDate(value); setEndFold(null); },
    onStartClock: (value: string) => { setStartClock(value); setStartFold(null); },
    onEndClock: (value: string) => { setEndClock(value); setEndFold(null); },
    onStartFold: setStartFold,
    onEndFold: setEndFold,
  };
  const periodTimingProps = {
    ...timingProps,
    kind: kind === 'deadline' ? 'deadline' as const : 'window' as const,
    startRequired: kind === 'deadline' ? hasDeadlineStart : true,
    endRequired: kind === 'deadline',
    hasWindowEnd,
  };

  function apply() {
    onApply({ mode, startDate, endDate, startClock, endClock, reminderOffset, eventCountdownEnabled, eventCountdownDaysBefore, eventCountdownReference, startFold, endFold, hasDeadlineStart, hasWindowEnd });
  }

  const helperText = kind === 'task'
    ? '할 일의 마감 날짜와 시각, 기기 알림을 설정해요.'
    : kind === 'event'
      ? '일정의 날짜와 시각을 설정해요.'
      : kind === 'deadline'
        ? '마감·시작 날짜와 시각, 알림을 설정해요.'
        : '신청 기간의 시작·종료 날짜와 시각, 알림을 설정해요.';

  return (
    <div className={styles.overlay} onChange={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <section aria-labelledby="time-settings-title" aria-modal="true" className={styles.dialog} ref={dialogRef} role="dialog">
        <header className={styles.header}>
          <div>
            <h2 id="time-settings-title">시간 설정</h2>
            <p>{helperText}</p>
          </div>
        </header>
        <div className={styles.body}>
          {kind === 'task' ? (
            <>
              <div className={styles.dateGrid}>
                <div className={styles.field}><span>마감 날짜</span><DateTimePickerInput kind="date" label="마감 날짜" onChange={setEndDate} value={endDate} /></div>
                <div className={styles.field}>
                  <span>마감 시각</span>
                  <DateTimePickerInput kind="time" label="마감 시각" onChange={setEndClock} value={endClock} />
                  {endResolution?.status === 'invalid' && endResolution.reason === 'nonexistent-time' && <small>이 날짜에는 입력한 시각이 없습니다. 다른 시각을 선택해 주세요.</small>}
                  {endResolution?.status === 'ambiguous' && (
                    <span className={styles.foldChoices}>
                      <span>중복되는 시각입니다.</span>
                      <label><input checked={endFold === 'earlier'} onChange={() => setEndFold('earlier')} type="radio" /> 첫 번째 시각 ({new Intl.DateTimeFormat('ko-KR', { timeZone, timeZoneName: 'short' }).format(new Date(endResolution.earlier))})</label>
                      <label><input checked={endFold === 'later'} onChange={() => setEndFold('later')} type="radio" /> 두 번째 시각 ({new Intl.DateTimeFormat('ko-KR', { timeZone, timeZoneName: 'short' }).format(new Date(endResolution.later))})</label>
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : kind === 'event' ? (
            <EventFields {...timingProps} />
          ) : (
            <>
              {kind === 'deadline' ? (
                <label className={styles.switch}>
                  <input checked={hasDeadlineStart} onChange={(event) => {
                    const enabled = event.currentTarget.checked;
                    setHasDeadlineStart(enabled);
                    if (enabled && !startDate) setStartDate(selectedDate);
                    if (enabled) setStartClock('');
                  }} type="checkbox" />
                  <span>기간 시작일도 기록</span>
                </label>
              ) : mode === 'time' ? (
                <label className={styles.switch}>
                  <input checked={hasWindowEnd} onChange={(event) => {
                    const enabled = event.currentTarget.checked;
                    setHasWindowEnd(enabled);
                    if (enabled && !endDate) setEndDate(selectedDate);
                    if (enabled) setEndClock('');
                  }} type="checkbox" />
                  <span>종료 시각도 기록</span>
                </label>
              ) : null}
              <ItemTimingFields {...periodTimingProps} />
            </>
          )}
          {kind !== 'event' && <ReminderSettings value={reminderOffset} onChange={setReminderOffset} />}
          {kind === 'event' && (
            <section className={styles.countdown} aria-label="시작 카운트다운 설정">
              <label className={styles.countdownToggle}>
                <span>시작 카운트다운</span>
                <input checked={eventCountdownEnabled} onChange={(event) => setEventCountdownEnabled(event.currentTarget.checked)} type="checkbox" />
                <span aria-hidden="true" className={styles.countdownSwitch} />
              </label>
            </section>
          )}
        </div>
        <footer className={styles.footer}>
          <button className={styles.cancel} onClick={onClose} type="button">취소</button>
          <button className={styles.apply} onClick={apply} type="button">적용</button>
        </footer>
      </section>
    </div>
  );
}

export function ReminderSettings({ value, onChange, compact = false }: { value: ReminderOffset | null; onChange: (value: ReminderOffset | null) => void; compact?: boolean }) {
  const selectedValue = value === 0 ? null : value;
  return (
    <section className={compact ? `${styles.reminder} ${styles.reminderCompact}` : styles.reminder} aria-label="알림 설정">
      <span className={styles.reminderLabel}>기기 알림</span>
      <div aria-label="알림 시점" className={styles.reminderChoices} role="group">
        {REMINDER_OPTIONS.map((option) => (
          <button aria-pressed={selectedValue === option.value} className={selectedValue === option.value ? styles.reminderSelected : ''} key={option.label} onClick={() => onChange(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
