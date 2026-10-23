'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { resolvePeriodChecklist } from '../../domain/projections';
import { formatKoreanDate } from './calendar-dates';
import { PeriodCard } from '../home/PeriodCard';
import { getCountdownTargetLabel, getCountdownWindowLabel } from '../items/countdown-copy';
import styles from './CalendarItemDetailsDialog.module.css';

type CalendarItemDetailsDialogProps = {
  item: ItemView;
  nowMs: number;
  onClose: () => void;
  onEdit: () => void;
  onToggleCountdown?: (item: ItemView, enabled: boolean) => Promise<void>;
  onDelete?: () => void;
  onComplete?: () => void;
  onCalendar?: () => void;
  allItems?: readonly ItemView[];
};

export function CalendarItemDetailsDialog({ item, nowMs, onClose, onEdit, onToggleCountdown, onDelete, onComplete, onCalendar, allItems = [] }: CalendarItemDetailsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const display = item.display;
  const timing = display.timing;
  const initialCountdownEnabled = display.kind === 'event'
    ? display.countdown?.enabled === true
    : display.kind === 'window'
      ? display.startCountdown.enabled
      : display.kind === 'deadline' && display.startCountdown?.enabled === true;
  const [countdownEnabled, setCountdownEnabled] = useState(initialCountdownEnabled);
  const [countdownSaving, setCountdownSaving] = useState(false);
  const [countdownError, setCountdownError] = useState('');
  const [countdownStatus, setCountdownStatus] = useState('');
  const countdownTarget = getCountdownTargetLabel(display.kind, display.kind === 'event' ? display.countdown?.reference : undefined, display.kind === 'deadline' || display.kind === 'window' ? display.focus : undefined);
  const countdownDays = display.kind === 'event' ? display.countdown?.daysBefore ?? 1 : display.kind === 'window' || display.kind === 'deadline' ? display.startCountdown?.daysBefore ?? 1 : 1;
  const dateLabel = timing.type === 'date'
    ? timing.startDate && timing.startDate !== timing.endDate
      ? `${formatKoreanDate(timing.startDate, timing.timeZone)} – ${formatKoreanDate(timing.endDate, timing.timeZone)}`
      : formatKoreanDate(timing.endDate, timing.timeZone)
    : timing.type === 'time'
      ? formatTimedRange(timing.startAt, timing.endAt, timing.timeZone)
      : '날짜 미정';

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  async function toggleCountdown() {
    if (!onToggleCountdown || display.kind === 'task' || countdownSaving) return;
    if (display.kind === 'deadline' && !display.startCountdown) return;
    const previous = countdownEnabled;
    const next = !previous;
    setCountdownEnabled(next);
    setCountdownSaving(true);
    setCountdownError('');
    setCountdownStatus('설정 저장 중…');
    try {
      await onToggleCountdown(item, next);
      setCountdownStatus('설정을 저장했습니다.');
    } catch (failure) {
      setCountdownEnabled(previous);
      setCountdownStatus('');
      setCountdownError(failure instanceof Error ? failure.message : '카운트다운 설정을 저장하지 못했습니다.');
    } finally {
      setCountdownSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
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

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="calendar-item-title" aria-modal="true" className={styles.dialog} ref={dialogRef} role="dialog">
        <header className={styles.inspectorHeader}><span>DETAILS</span><button aria-label="상세 패널 닫기" onClick={onClose} type="button">×</button></header>
        <div className={styles.body}>
          {display.kind === 'task' ? (
            <article className={styles.taskSummary}>
              <div className={styles.taskHeading}>
                <h2 id="calendar-item-title">{display.title}</h2>
                <span>{display.completion === 'completed' ? '완료' : '진행 중'}</span>
              </div>
              <div aria-label="할 일 완료 상태" aria-valuemax={100} aria-valuemin={0} aria-valuenow={display.completion === 'completed' ? 100 : 0} className={styles.taskTrack} role="progressbar">
                <span className={styles.taskFill} data-complete={display.completion === 'completed'} />
              </div>
            </article>
          ) : display.kind === 'event' && display.showInProgressSummary === false ? (
            <article className={styles.taskSummary}>
              <div className={styles.taskHeading}><h2 id="calendar-item-title">{display.title}</h2><span>일정</span></div>
              <p className={styles.date}>{dateLabel}</p>
            </article>
          ) : <PeriodCard allItems={allItems} expanded item={item} nowMs={nowMs} titleId="calendar-item-title" />}
          {display.kind === 'task' && <p className={styles.date}>{dateLabel}</p>}
          {(display.category || timing.type === 'time') && <section aria-label="분류와 시간대" className={styles.metadata}>
            {display.category && <span><small>카테고리</small><strong>{display.category}</strong></span>}
            {(timing.type === 'time' || timing.type === 'date') && <span><small>시간대</small><strong>{timing.timeZone}</strong></span>}
          </section>}
          {display.kind !== 'task' && (
            <section aria-label="빠른 설정" className={styles.quickSettings}>
              <div className={styles.quickSettingCopy}>
                <strong>남은 시간 표시</strong>
                <span>{display.kind === 'deadline' && !display.startCountdown
                    ? '시작 날짜를 설정하면 사용할 수 있어요'
                    : `${countdownTarget} 기준 · ${getCountdownWindowLabel(countdownDays)}`}</span>
              </div>
              <button aria-checked={countdownEnabled} aria-label="카운트다운" className={styles.quickSwitch} data-enabled={countdownEnabled} disabled={!onToggleCountdown || countdownSaving || display.kind === 'deadline' && !display.startCountdown} onClick={() => { void toggleCountdown(); }} role="switch" type="button">
                <span aria-hidden="true" />
              </button>
              {countdownError && <p className={styles.quickError} role="alert">{countdownError}</p>}
              {countdownStatus && <p className={styles.quickStatus} role="status">{countdownStatus}</p>}
            </section>
          )}
          {(display.kind === 'deadline' || display.kind === 'window') && display.checklist.length > 0 && <section aria-label="연결된 할 일 상태" className={styles.section}><h3>연결된 할 일</h3><ul className={styles.linkedTasks}>{resolvePeriodChecklist(display.checklist, allItems).map((entry) => <li key={entry.id}><span aria-hidden="true" data-complete={entry.completed}>{entry.completed ? '✓' : '○'}</span><span>{entry.title}</span></li>)}</ul></section>}
          {display.notes && <section className={styles.section}><h3>메모</h3><p>{display.notes}</p></section>}
          {display.sourceUrl && <section className={styles.section}><h3>관련 링크</h3><a href={display.sourceUrl} rel="noreferrer" target="_blank">{display.sourceUrl}</a></section>}
        </div>
        <footer className={styles.footer}>
          {onCalendar && <button className={styles.secondary} onClick={onCalendar} type="button">캘린더</button>}
          {onDelete && <button className={styles.danger} onClick={onDelete} type="button">삭제</button>}
          <button className={styles.secondary} onClick={onClose} ref={closeRef} type="button">닫기</button>
          <button className={styles.primary} onClick={onEdit} type="button">수정</button>
          {onComplete && display.kind !== 'event' && <button aria-pressed={'completion' in display && display.completion === 'completed'} className={styles.complete} onClick={onComplete} type="button">{'completion' in display && display.completion === 'completed' ? '완료 취소' : '완료 처리'}</button>}
        </footer>
      </section>
    </div>
  );
}

function formatTimedRange(startAt: string | null, endAt: string | null, timeZone: string): string {
  const dateFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone });
  const timeFormatter = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
  if (!startAt && !endAt) return '날짜 미정';
  if (!startAt && endAt) return `${dateFormatter.format(new Date(endAt))} · 마감 ${timeFormatter.format(new Date(endAt))}`;
  if (startAt && !endAt) return `${dateFormatter.format(new Date(startAt))} · ${timeFormatter.format(new Date(startAt))} 시작`;
  const start = new Date(startAt!);
  const end = new Date(endAt!);
  const startDate = dateFormatter.format(start);
  const endDate = dateFormatter.format(end);
  const startTime = timeFormatter.format(start);
  const endTime = timeFormatter.format(end);
  return startDate === endDate ? `${startDate} · ${startTime} – ${endTime}` : `${startDate} ${startTime} – ${endDate} ${endTime}`;
}
