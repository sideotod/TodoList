'use client';

import { deriveChecklistStatus } from '../../domain/projections';
import { addCalendarDays, getDateStartMs, getDeadlineCountdown, getElapsedRatio, getEventCountdown, getPeriodPhase, getStartCountdown, getTimingBounds } from '../../domain/time';
import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import styles from './PeriodCard.module.css';

type PeriodCardProps = {
  item: ItemView;
  nowMs: number;
  onOpen?: (item: ItemView) => void;
  titleId?: string;
  expanded?: boolean;
};

export function PeriodCard({ item, nowMs, onOpen, titleId, expanded = false }: PeriodCardProps) {
  const display = item.display;
  if (display.kind !== 'deadline' && display.kind !== 'window' && display.kind !== 'event') return null;
  const bounds = getTimingBounds(display.timing);
  const phase = getPeriodPhase(bounds, nowMs);
  const ratio = getElapsedRatio(bounds, nowMs);
  const scheduledProgress = phase === 'scheduled'
    ? display.kind === 'event'
      ? getScheduledEventProgress(display, nowMs)
      : display.kind === 'deadline' && display.focus === 'deadline'
        ? ratio
      : getScheduledProgress(display, bounds.startMs, nowMs)
    : null;
  const countdown = display.kind === 'event'
    ? getEventCountdown(display, nowMs)
    : display.kind === 'deadline' && display.focus === 'deadline'
      ? getDeadlineCountdown(display, nowMs)
      : getStartCountdown(display, nowMs);
  const checklist = display.kind === 'deadline' || display.kind === 'window'
    ? deriveChecklistStatus(display.checklist)
    : { kind: 'none' as const, total: 0 as const };
  const isComplete = ('completion' in display && display.completion === 'completed') || checklist.kind === 'complete';
  const fillRatio = phase === 'scheduled' ? scheduledProgress : phase === 'active' ? ratio : 1;
  const state = getVisualState(phase, bounds.startMs, bounds.endExclusiveMs, nowMs);
  const countdownUrgency = getCountdownUrgency(display, countdown);
  const phaseClass = phase === 'scheduled' ? styles.scheduled : phase === 'active' ? styles.active : styles.ended;
  const trackClass = phase === 'scheduled' ? styles.scheduledTrack : phase === 'active' ? styles.activeTrack : styles.endedTrack;

  return (
    <article aria-label={display.title} className={`${styles.card} ${phaseClass}${expanded ? ` ${styles.expanded}` : ''}`} data-expanded={expanded} data-period-phase={phase} data-period-state={state}>
      {onOpen && <button aria-label={display.title} className={styles.cardAction} onClick={() => onOpen(item)} type="button" />}
      <div className={styles.heading}>
        <h3 className={styles.title} id={titleId}>{display.title}</h3>
        <div className={styles.meta}>
          {isComplete && <span className={styles.complete}>완료</span>}
          {!isComplete && phase === 'overdue' && <span className={styles.endedLabel}>종료</span>}
          {checklist.kind !== 'none' && (
            checklist.kind !== 'complete' && <span className={styles.incomplete}>미완료 {checklist.remaining}/{checklist.total}</span>
          )}
          {countdown.kind !== 'hidden' && <strong className={styles.countdown} data-countdown-urgency={countdownUrgency}><span className={styles.countdownLabel}>남은 시간</span>{countdown.text}</strong>}
        </div>
      </div>
      {fillRatio === null ? (
        <div className={`${styles.track} ${trackClass}`} aria-label="시작 예정" role="img" />
      ) : (
        <div
          aria-label={phase === 'scheduled' && !(display.kind === 'deadline' && display.focus === 'deadline') ? '시작까지 남은 기간' : '기간 진행률'}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(fillRatio * 100)}
          className={`${styles.track} ${trackClass}`}
          role="progressbar"
        >
          <span className={styles.fill} style={{ transform: `scaleX(${fillRatio})` }} />
        </div>
      )}
      <div className={styles.endpoints}>
        <span>{formatEndpoint(display, 'start')}</span>
        <span>{formatEndpoint(display, 'end')}</span>
      </div>
    </article>
  );
}

type VisualState = 'before' | 'start-soon' | 'active' | 'end-soon' | 'ended';

function getVisualState(phase: 'scheduled' | 'active' | 'overdue', startMs: number | null, endMs: number | null, nowMs: number): VisualState {
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (phase === 'overdue') return 'ended';
  if (phase === 'scheduled') return startMs !== null && startMs - nowMs <= oneDayMs ? 'start-soon' : 'before';
  return endMs !== null && endMs - nowMs <= oneDayMs ? 'end-soon' : 'active';
}

function getCountdownUrgency(item: ProposedCalendarItem, countdown: ReturnType<typeof getEventCountdown> | ReturnType<typeof getStartCountdown>): 'normal' | 'start' | 'end' {
  if (countdown.kind === 'hidden') return 'normal';
  const imminent = countdown.kind === 'hours-minutes' || countdown.kind === 'minutes-seconds' || countdown.text === 'D-1';
  if (!imminent) return 'normal';
  if (item.kind === 'event') return item.countdown?.reference === 'end' ? 'end' : 'start';
  if (item.kind === 'deadline' && item.focus === 'deadline') return 'end';
  return item.kind === 'deadline' ? 'end' : 'start';
}

function getScheduledEventProgress(item: Extract<ProposedCalendarItem, { kind: 'event' }>, nowMs: number): number | null {
  const countdown = item.countdown;
  if (!countdown?.enabled || countdown.daysBefore <= 0) return null;

  let targetMs: number | null;
  let revealMs: number;
  if (item.timing.type === 'date') {
    const targetDate = countdown.reference === 'start' ? item.timing.startDate : item.timing.endDate;
    targetMs = getDateStartMs(targetDate, item.timing.timeZone);
    revealMs = getDateStartMs(addCalendarDays(targetDate, -countdown.daysBefore), item.timing.timeZone);
  } else {
    const targetAt = countdown.reference === 'start' ? item.timing.startAt : item.timing.endAt;
    targetMs = targetAt ? Date.parse(targetAt) : null;
    revealMs = targetMs === null ? 0 : targetMs - countdown.daysBefore * 86_400_000;
  }
  if (targetMs === null || nowMs < revealMs || nowMs >= targetMs || targetMs <= revealMs) return null;
  return Math.max(0, Math.min(1, (nowMs - revealMs) / (targetMs - revealMs)));
}

function getScheduledProgress(
  item: Extract<ProposedCalendarItem, { kind: 'deadline' | 'window' }>,
  startMs: number | null,
  nowMs: number,
): number | null {
  const countdown = item.startCountdown;
  if (!countdown?.enabled || countdown.daysBefore <= 0 || startMs === null) return null;
  if (item.timing.type === 'date' && item.timing.startDate !== null) {
    const revealMs = getDateStartMs(addCalendarDays(item.timing.startDate, -countdown.daysBefore), item.timing.timeZone);
    return Math.max(0, Math.min(1, (nowMs - revealMs) / (startMs - revealMs)));
  }
  if (item.timing.type === 'time') {
    const revealMs = startMs - countdown.daysBefore * 86_400_000;
    return Math.max(0, Math.min(1, (nowMs - revealMs) / (startMs - revealMs)));
  }
  return null;
}

function formatEndpoint(item: ProposedCalendarItem, endpoint: 'start' | 'end'): string {
  const timing = item.timing;
  if (timing.type === 'unscheduled') return endpoint === 'start' ? '시작일 미정' : '종료일 미정';
  if (timing.type === 'date') {
    const date = endpoint === 'start' ? timing.startDate : timing.endDate;
    return date ? formatCompactDate(date, timing.timeZone, false) : endpoint === 'start' ? '시작일 미정' : '종료일 미정';
  }
  const instant = endpoint === 'start' ? timing.startAt : timing.endAt;
  return instant ? formatCompactDate(instant, timing.timeZone, true) : endpoint === 'start' ? '시작일 미정' : '종료일 미정';
}

function formatCompactDate(value: string, timeZone: string, instant: boolean): string {
  const date = instant ? new Date(value) : new Date(`${value}T12:00:00.000Z`);
  const options: Intl.DateTimeFormatOptions = {
    month: '2-digit',
    day: '2-digit',
    ...(instant ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    timeZone,
  };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const dateText = `${values.get('month') ?? ''}.${values.get('day') ?? ''}`;
  return instant && values.has('hour') ? `${dateText} ${values.get('hour')}:${values.get('minute')}` : dateText;
}
