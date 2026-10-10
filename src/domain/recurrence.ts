import { Temporal } from '@js-temporal/polyfill';
import type { ItemView, TimeTiming } from './items';
import { getLocalDate, getTimingBounds } from './time';

export function getWeeklyOccurrenceForDate(item: ItemView, date: string): ItemView | null {
  const display = item.display;
  if (display.kind !== 'event' || !display.recurrence) return null;
  const recurrence = display.recurrence;
  const targetDate = Temporal.PlainDate.from(date);
  const weekday = targetDate.dayOfWeek % 7;
  const timing = display.timing;
  const baseStartDate = timing.type === 'date'
    ? Temporal.PlainDate.from(timing.startDate)
    : Temporal.Instant.from(timing.startAt).toZonedDateTimeISO(timing.timeZone).toPlainDate();
  if (Temporal.PlainDate.compare(targetDate, baseStartDate) < 0) return null;
  if (recurrence.untilDate && Temporal.PlainDate.compare(targetDate, Temporal.PlainDate.from(recurrence.untilDate)) > 0) return null;
  if (!recurrence.daysOfWeek.includes(weekday)) return null;

  if (timing.type === 'date') {
    const durationDays = baseStartDate.until(Temporal.PlainDate.from(timing.endDate)).days;
    return {
      ...item,
      display: {
        ...display,
        timing: { ...timing, startDate: date, endDate: targetDate.add({ days: durationDays }).toString() },
      },
    };
  }

  const startZoned = Temporal.Instant.from(timing.startAt).toZonedDateTimeISO(timing.timeZone);
  const startAt = toOccurrenceInstant(targetDate, startZoned.toPlainTime(), timing.timeZone);
  const endAt = timing.endAt
    ? (() => {
        const endZoned = Temporal.Instant.from(timing.endAt!).toZonedDateTimeISO(timing.timeZone);
        const endDateOffset = baseStartDate.until(endZoned.toPlainDate()).days;
        return toOccurrenceInstant(targetDate.add({ days: endDateOffset }), endZoned.toPlainTime(), timing.timeZone);
      })()
    : null;
  return { ...item, display: { ...display, timing: { ...timing, startAt, endAt } } };
}

export function getNextWeeklyOccurrence(item: ItemView, nowMs: number): ItemView | null {
  if (item.display.kind !== 'event' || !item.display.recurrence) return null;
  const timing = item.display.timing;
  const timeZone = timing.timeZone;
  const today = Temporal.PlainDate.from(getLocalDate(nowMs, timeZone));
  for (let offset = 0; offset <= 7; offset++) {
    const occurrence = getWeeklyOccurrenceForDate(item, today.add({ days: offset }).toString());
    if (!occurrence) continue;
    const bounds = getTimingBounds(occurrence.display.timing);
    if (occurrence.display.timing.type === 'time' && occurrence.display.timing.endAt === null) {
      if (bounds.startMs !== null && bounds.startMs >= nowMs) return occurrence;
      continue;
    }
    if (bounds.endExclusiveMs !== null && bounds.endExclusiveMs > nowMs) return occurrence;
  }
  return null;
}

function toOccurrenceInstant(date: Temporal.PlainDate, time: Temporal.PlainTime, timeZone: string): string {
  return date.toPlainDateTime(time).toZonedDateTime(timeZone, { disambiguation: 'compatible' }).toInstant().toString({ fractionalSecondDigits: 3 });
}

export function hasNoEventEnd(timing: TimeTiming): boolean {
  return timing.endAt === null;
}
