import { Temporal } from '@js-temporal/polyfill';
import type { ItemTiming, ProposedCalendarItem, ProposedDeadlineItem } from './items';

export type TimingBounds = { startMs: number | null; endExclusiveMs: number | null };
export type PeriodPhase = 'scheduled' | 'active' | 'overdue';
export type CountdownView =
  | { kind: 'hidden' }
  | { kind: 'days'; text: string; nextUpdateMs: number }
  | { kind: 'hours-minutes'; text: string; nextUpdateMs: number }
  | { kind: 'minutes-seconds'; text: string; nextUpdateMs: number };
export type LocalTimeResult =
  | { status: 'valid'; instant: string }
  | { status: 'invalid'; reason: 'invalid-input' | 'unknown-zone' | 'nonexistent-time' }
  | { status: 'ambiguous'; earlier: string; later: string };

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || /^[+-]/.test(value)) return false;
  try {
    // Validate with the same interpreter used by all calculations, including aliases/UTC.
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
    return true;
  } catch {
    return false;
  }
}

function plainDate(date: string): Temporal.PlainDate {
  if (!isValidDateOnly(date)) throw new RangeError('유효한 YYYY-MM-DD 날짜가 필요합니다.');
  return Temporal.PlainDate.from(date);
}

export function addCalendarDays(date: string, days: number): string {
  return plainDate(date).add({ days }).toString();
}

export function getLocalDate(instantMs: number, zone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(instantMs).toZonedDateTimeISO(zone).toPlainDate().toString();
}

export function getDateStartMs(date: string, zone: string): number {
  // Omitting plainTime requests the first valid instant of the local day, even at a midnight gap.
  return plainDate(date).toZonedDateTime(zone).epochMilliseconds;
}

export function parseLocalDateTime(date: string, clock: string, zone: string): LocalTimeResult {
  if (!isValidDateOnly(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(clock)) {
    return { status: 'invalid', reason: 'invalid-input' };
  }
  if (!isValidTimeZone(zone)) return { status: 'invalid', reason: 'unknown-zone' };
  const local = Temporal.PlainDateTime.from(`${date}T${clock}`, { overflow: 'reject' });
  const earlier = local.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = local.toZonedDateTime(zone, { disambiguation: 'later' });
  if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
    return { status: 'invalid', reason: 'nonexistent-time' };
  }
  const earlierIso = earlier.toInstant().toString({ fractionalSecondDigits: 3 });
  if (earlier.epochMilliseconds !== later.epochMilliseconds) {
    return { status: 'ambiguous', earlier: earlierIso, later: later.toInstant().toString({ fractionalSecondDigits: 3 }) };
  }
  return { status: 'valid', instant: earlierIso };
}

export function getTimingBounds(timing: ItemTiming): TimingBounds {
  if (timing.type === 'unscheduled') return { startMs: null, endExclusiveMs: null };
  if (timing.type === 'date') {
    return {
      startMs: timing.startDate === null ? null : getDateStartMs(timing.startDate, timing.timeZone),
      endExclusiveMs: getDateStartMs(addCalendarDays(timing.endDate, 1), timing.timeZone),
    };
  }
  return {
    startMs: timing.startAt === null ? null : Temporal.Instant.from(timing.startAt).epochMilliseconds,
    endExclusiveMs: timing.endAt === null ? null : Temporal.Instant.from(timing.endAt).epochMilliseconds,
  };
}

export function formatDDay(targetDate: string, zone: string, nowMs: number): string {
  const today = plainDate(getLocalDate(nowMs, zone));
  const days = today.until(plainDate(targetDate), { largestUnit: 'days' }).days;
  return days === 0 ? 'D-Day' : days > 0 ? `D-${days}` : `D+${-days}`;
}

export function getElapsedRatio(bounds: TimingBounds, nowMs: number): number | null {
  const { startMs, endExclusiveMs } = bounds;
  if (startMs === null || endExclusiveMs === null || endExclusiveMs <= startMs) return null;
  return Math.max(0, Math.min(1, (nowMs - startMs) / (endExclusiveMs - startMs)));
}

export function getPeriodPhase(bounds: TimingBounds, nowMs: number): PeriodPhase {
  if (bounds.endExclusiveMs !== null && nowMs >= bounds.endExclusiveMs) return 'overdue';
  if (bounds.startMs !== null && nowMs < bounds.startMs) return 'scheduled';
  return 'active';
}

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

export function getStartCountdown(item: ProposedCalendarItem, nowMs: number): CountdownView {
  if (item.kind !== 'deadline' && item.kind !== 'window') return { kind: 'hidden' };
  const settings = item.startCountdown;
  if (item.completion === 'completed' || !settings?.enabled || settings.daysBefore === 0) return { kind: 'hidden' };
  const { startMs } = getTimingBounds(item.timing);
  if (startMs === null || nowMs >= startMs) return { kind: 'hidden' };
  if (item.timing.type === 'date') {
    const startDate = item.timing.startDate;
    if (startDate === null) return { kind: 'hidden' };
    const zone = item.timing.timeZone;
    const revealMs = getDateStartMs(addCalendarDays(startDate, -settings.daysBefore), zone);
    if (nowMs < revealMs) return { kind: 'hidden' };
    const today = getLocalDate(nowMs, zone);
    return { kind: 'days', text: formatDDay(startDate, zone, nowMs), nextUpdateMs: getDateStartMs(addCalendarDays(today, 1), zone) };
  }
  const remainingMs = startMs - nowMs;
  if (remainingMs > settings.daysBefore * DAY_MS) return { kind: 'hidden' };
  if (remainingMs >= DAY_MS) {
    const days = Math.ceil(remainingMs / DAY_MS);
    const nextDelta = remainingMs === DAY_MS ? 1 : remainingMs - (days - 1) * DAY_MS;
    return { kind: 'days', text: `D-${days}`, nextUpdateMs: nowMs + nextDelta };
  }
  const seconds = Math.ceil(remainingMs / 1_000);
  if (remainingMs >= 10 * MINUTE_MS) {
    const minutes = Math.floor(seconds / 60);
    const untilMinuteChange = remainingMs - (minutes * 60 - 1) * 1_000;
    const untilSecondMode = remainingMs - 10 * MINUTE_MS + 1;
    return {
      kind: 'hours-minutes', text: `${padded(Math.floor(minutes / 60))}:${padded(minutes % 60)}`,
      nextUpdateMs: nowMs + Math.min(untilMinuteChange, untilSecondMode),
    };
  }
  return {
    kind: 'minutes-seconds', text: `${padded(Math.floor(seconds / 60))}:${padded(seconds % 60)}`,
    nextUpdateMs: nowMs + remainingMs - (seconds - 1) * 1_000,
  };
}

export function getEventCountdown(item: ProposedCalendarItem, nowMs: number): CountdownView {
  if (item.kind !== 'event' || !item.countdown?.enabled || item.countdown.daysBefore === 0) return { kind: 'hidden' };
  const timing = item.timing;
  let targetMs: number | null = null;
  if (timing.type === 'time') {
    const instant = item.countdown.reference === 'start' ? timing.startAt : timing.endAt;
    targetMs = instant ? Temporal.Instant.from(instant).epochMilliseconds : null;
  } else if (timing.type === 'date') {
    const date = item.countdown.reference === 'start' ? timing.startDate : timing.endDate;
    targetMs = date ? getDateStartMs(date, timing.timeZone) : null;
  }
  if (targetMs === null || targetMs <= nowMs) return { kind: 'hidden' };
  const remainingMs = targetMs - nowMs;
  if (remainingMs > item.countdown.daysBefore * DAY_MS) return { kind: 'hidden' };
  if (remainingMs >= DAY_MS) {
    const days = Math.ceil(remainingMs / DAY_MS);
    return { kind: 'days', text: `D-${days}`, nextUpdateMs: nowMs + remainingMs - (days - 1) * DAY_MS };
  }
  const seconds = Math.ceil(remainingMs / 1_000);
  if (remainingMs >= 10 * MINUTE_MS) {
    const minutes = Math.floor(seconds / 60);
    const untilMinuteChange = remainingMs - (minutes * 60 - 1) * 1_000;
    const untilSecondMode = remainingMs - 10 * MINUTE_MS + 1;
    return {
      kind: 'hours-minutes',
      text: `${padded(Math.floor(minutes / 60))}:${padded(minutes % 60)}`,
      nextUpdateMs: nowMs + Math.min(untilMinuteChange, untilSecondMode),
    };
  }
  return {
    kind: 'minutes-seconds',
    text: `${padded(Math.floor(seconds / 60))}:${padded(seconds % 60)}`,
    nextUpdateMs: nowMs + remainingMs - (seconds - 1) * 1_000,
  };
}

export function getDeadlineCountdown(item: ProposedDeadlineItem, nowMs: number): CountdownView {
  const settings = item.startCountdown;
  if (item.focus !== 'deadline' || !settings?.enabled || settings.daysBefore === 0) return { kind: 'hidden' };
  const timing = item.timing.type === 'date'
    ? { ...item.timing, startDate: item.timing.startDate ?? item.timing.endDate }
    : { ...item.timing, startAt: item.timing.startAt ?? item.timing.endAt };
  return getEventCountdown({
    id: item.id,
    kind: 'event',
    title: item.title,
    timing,
    countdown: { ...settings, reference: 'end' },
  }, nowMs);
}
