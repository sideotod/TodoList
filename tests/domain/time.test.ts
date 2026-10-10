import { describe, expect, it } from 'vitest';
import { makeDeadline, makeEvent, makeWindow } from '../fixtures/items';
import {
  formatDDay,
  getElapsedRatio,
  getEventCountdown,
  getPeriodPhase,
  getStartCountdown,
  getTimingBounds,
  parseLocalDateTime,
} from '../../src/domain/time';
import { validateProposedItem } from '../../src/domain/validation';

const ms = (instant: string): number => Date.parse(instant);
const ZONE = 'Asia/Seoul';

describe('calendar dates and local input', () => {
  it('TIME-01 calculates D-Day in the stored zone', () => {
    const now = ms('2026-10-02T15:00:00.000Z');
    expect(formatDDay('2026-10-03', ZONE, now)).toBe('D-Day');
    expect(formatDDay('2026-10-09', ZONE, now)).toBe('D-6');
    expect(formatDDay('2026-10-02', ZONE, now)).toBe('D+1');
    expect(formatDDay('2026-10-03', 'America/New_York', now)).toBe('D-1');
  });

  it.each([
    ['2026-10-03T14:59:59.999Z', '2026-10-04', 'D-1'],
    ['2026-10-03T15:00:00.000Z', '2026-10-04', 'D-Day'],
    ['2026-10-31T15:00:00.000Z', '2026-11-01', 'D-Day'],
    ['2026-12-31T15:00:00.000Z', '2027-01-01', 'D-Day'],
  ])('TIME-02 respects midnight, month and year boundaries: %s', (now, target, want) => {
    expect(formatDDay(target, ZONE, ms(now))).toBe(want);
  });

  it.each([
    ['2026-03-08T05:00:00.000Z', '2026-03-09'],
    ['2026-11-01T04:00:00.000Z', '2026-11-02'],
  ])('TIME-04 uses calendar days across 23/25-hour days: %s', (now, target) => {
    expect(formatDDay(target, 'America/New_York', ms(now))).toBe('D-1');
  });

  it('TIME-03 preserves the registered instant independently of the device zone', () => {
    expect(parseLocalDateTime('2026-10-03', '09:40', ZONE)).toEqual({
      status: 'valid', instant: '2026-10-03T00:40:00.000Z',
    });
    expect(parseLocalDateTime('2026-10-03', '09:40:12.345', ZONE)).toEqual({
      status: 'valid', instant: '2026-10-03T00:40:12.345Z',
    });
  });

  it('dst_nonexistent_and_ambiguous_input never silently moves a wall time', () => {
    expect(parseLocalDateTime('2026-03-08', '02:30', 'America/New_York')).toEqual({
      status: 'invalid', reason: 'nonexistent-time',
    });
    expect(parseLocalDateTime('2026-11-01', '01:30', 'America/New_York')).toEqual({
      status: 'ambiguous', earlier: '2026-11-01T05:30:00.000Z', later: '2026-11-01T06:30:00.000Z',
    });
  });

  it.each([
    ['2026-02-29', '09:00'], ['2026-04-31', '09:00'],
    ['2026-13-01', '09:00'], ['2026-01-00', '09:00'],
    ['2026-1-01', '09:00'], ['2026-10-03', '24:00'],
    ['2026-10-03', '09:60'], ['2026-10-03', '09:00:60'],
  ])('rejects impossible or malformed local input: %s %s', (date, clock) => {
    expect(parseLocalDateTime(date, clock, ZONE)).toEqual({ status: 'invalid', reason: 'invalid-input' });
  });

  it('rejects an unknown or numeric-offset zone and accepts a Gregorian leap day', () => {
    expect(parseLocalDateTime('2026-10-03', '09:00', 'Mars/Olympus')).toEqual({ status: 'invalid', reason: 'unknown-zone' });
    expect(parseLocalDateTime('2026-10-03', '09:00', '+09:00')).toEqual({ status: 'invalid', reason: 'unknown-zone' });
    expect(parseLocalDateTime('2028-02-29', '09:00', ZONE)).toEqual({ status: 'valid', instant: '2028-02-29T00:00:00.000Z' });
  });

  it('connects actual Gregorian validation to Task 1 proposals', () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00']) {
      expect(validateProposedItem(makeDeadline({ timing: { type: 'date', startDate: null, endDate: date, timeZone: ZONE } })).valid).toBe(false);
      expect(validateProposedItem(makeEvent({ timing: { type: 'date', startDate: date, endDate: '2027-01-01', timeZone: ZONE } })).valid).toBe(false);
    }
    expect(validateProposedItem(makeDeadline({ timing: { type: 'date', startDate: null, endDate: '2028-02-29', timeZone: ZONE } })).valid).toBe(true);
    expect(validateProposedItem(makeDeadline({ timing: { type: 'date', startDate: null, endDate: '2026-10-03', timeZone: 'Mars/Olympus' } })).valid).toBe(false);
  });
});

describe('timing bounds and elapsed time', () => {
  it('TIME-07 includes the whole stored end date', () => {
    const bounds = getTimingBounds({ type: 'date', startDate: '2026-10-01', endDate: '2026-10-03', timeZone: ZONE });
    expect(bounds).toEqual({ startMs: ms('2026-09-30T15:00:00.000Z'), endExclusiveMs: ms('2026-10-03T15:00:00.000Z') });
    expect(getPeriodPhase(bounds, ms('2026-10-03T14:59:59.999Z'))).toBe('active');
    expect(getPeriodPhase(bounds, ms('2026-10-03T15:00:00.000Z'))).toBe('overdue');
  });

  it.each([
    ['2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z'],
    ['2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z'],
  ])('adds one calendar day instead of 24 hours at DST: %s', (date, start, end) => {
    expect(getTimingBounds({ type: 'date', startDate: date, endDate: date, timeZone: 'America/New_York' })).toEqual({ startMs: ms(start), endExclusiveMs: ms(end) });
  });

  it('uses the first valid local instant when midnight is skipped', () => {
    expect(getTimingBounds({ type: 'date', startDate: '2026-03-08', endDate: '2026-03-08', timeZone: 'America/Havana' })).toEqual({
      startMs: ms('2026-03-08T05:00:00.000Z'), endExclusiveMs: ms('2026-03-09T04:00:00.000Z'),
    });
    expect(parseLocalDateTime('2026-03-08', '00:00', 'America/Havana')).toEqual({ status: 'invalid', reason: 'nonexistent-time' });
  });

  it('TIME-05 exact end phase takes precedence over a same-day D-Day', () => {
    const now = ms('2026-10-03T02:00:00.000Z');
    const bounds = getTimingBounds({ type: 'time', startAt: null, endAt: '2026-10-03T01:00:00.000Z', timeZone: ZONE });
    expect(formatDDay('2026-10-03', ZONE, now)).toBe('D-Day');
    expect(getPeriodPhase(bounds, now)).toBe('overdue');
  });

  it.each([[-1, 0], [0, 0], [500, 0.5], [1_000, 1], [1_001, 1]])('TIME-06 clamps elapsed ratio at %s', (now, want) => {
    expect(getElapsedRatio({ startMs: 0, endExclusiveMs: 1_000 }, now)).toBe(want);
  });

  it('TIME-08 returns no progress for absent or unusable bounds', () => {
    expect(getTimingBounds({ type: 'unscheduled' })).toEqual({ startMs: null, endExclusiveMs: null });
    expect(getElapsedRatio({ startMs: null, endExclusiveMs: 1_000 }, 500)).toBeNull();
    expect(getElapsedRatio({ startMs: 0, endExclusiveMs: null }, 500)).toBeNull();
    expect(getElapsedRatio({ startMs: 1_000, endExclusiveMs: 1_000 }, 1_000)).toBeNull();
  });
});

describe('start countdown', () => {
  const start = ms('2026-10-03T01:00:00.000Z');
  const item = makeWindow({ timing: { type: 'time', startAt: '2026-10-03T01:00:00.000Z', endAt: null, timeZone: ZONE } });

  it.each([
    [86_400_000, 'days', 'D-1'], [86_400_001, 'days', 'D-2'],
    [86_399_999, 'hours-minutes', '24:00'], [3_599_000, 'hours-minutes', '00:59'],
    [600_000, 'hours-minutes', '00:10'], [599_000, 'minutes-seconds', '09:59'],
    [100, 'minutes-seconds', '00:01'],
  ])('TIME-11/12 formats %s remaining without zero or negative countdowns', (remaining, kind, text) => {
    const result = getStartCountdown({ ...item, startCountdown: { enabled: true, daysBefore: 30 } }, start - remaining);
    expect(result).toMatchObject({ kind, text });
    if (result.kind !== 'hidden') {
      expect(result.nextUpdateMs).toBeGreaterThan(start - remaining);
      expect(result.nextUpdateMs).toBeLessThanOrEqual(start);
    }
  });

  it('TIME-10 honors disabled, 0-day and the exact 24-hour reveal boundary', () => {
    expect(getStartCountdown({ ...item, startCountdown: { enabled: false, daysBefore: 30 } }, start - 1)).toEqual({ kind: 'hidden' });
    expect(getStartCountdown({ ...item, startCountdown: { enabled: true, daysBefore: 0 } }, start - 1)).toEqual({ kind: 'hidden' });
    expect(getStartCountdown(item, start - 86_400_001)).toEqual({ kind: 'hidden' });
    expect(getStartCountdown(item, start - 86_400_000)).toMatchObject({ kind: 'days', text: 'D-1' });
    expect(getStartCountdown(makeDeadline(), start - 1)).toEqual({ kind: 'hidden' });
  });

  it('TIME-13 stops countdown at the start with and without a known end', () => {
    expect(getStartCountdown(item, start)).toEqual({ kind: 'hidden' });
    const bounded = makeWindow({ timing: { type: 'time', startAt: '2026-10-03T01:00:00.000Z', endAt: '2026-10-03T02:00:00.000Z', timeZone: ZONE } });
    expect(getStartCountdown(bounded, start)).toEqual({ kind: 'hidden' });
    expect(getElapsedRatio(getTimingBounds(bounded.timing), start)).toBe(0);
    expect(getElapsedRatio(getTimingBounds(item.timing), start)).toBeNull();
  });

  it('TIME-15 date-only countdown follows calendar reveal and midnight, never seconds', () => {
    const dated = makeWindow({ timing: { type: 'date', startDate: '2026-03-09', endDate: '2026-03-10', timeZone: 'America/New_York' } });
    expect(getStartCountdown(dated, ms('2026-03-08T04:59:59.999Z'))).toEqual({ kind: 'hidden' });
    expect(getStartCountdown(dated, ms('2026-03-08T05:00:00.000Z'))).toEqual({ kind: 'days', text: 'D-1', nextUpdateMs: ms('2026-03-09T04:00:00.000Z') });
    expect(getStartCountdown(dated, ms('2026-03-09T03:59:59.900Z'))).toMatchObject({ kind: 'days', text: 'D-1' });
    expect(getStartCountdown(dated, ms('2026-03-09T04:00:00.000Z'))).toEqual({ kind: 'hidden' });
  });

  it('completion suppresses countdown without changing timing or elapsed ratio', () => {
    const completed = { ...item, completion: 'completed' as const };
    expect(getStartCountdown(completed, start - 100)).toEqual({ kind: 'hidden' });
    expect(completed.timing).toEqual(item.timing);
  });
});

describe('event countdown', () => {
  const event = makeEvent({
    timing: { type: 'time', startAt: '2026-10-03T01:00:00.000Z', endAt: '2026-10-03T02:00:00.000Z', timeZone: ZONE },
    countdown: { enabled: true, daysBefore: 1, reference: 'end' },
  });

  it('uses the selected reference instant and stays hidden while disabled or outside the reveal window', () => {
    expect(getEventCountdown(event, ms('2026-10-03T00:30:00.000Z'))).toMatchObject({ kind: 'hours-minutes', text: '01:30' });
    expect(getEventCountdown({ ...event, countdown: { ...event.countdown!, reference: 'start' } }, ms('2026-10-03T00:30:00.000Z'))).toMatchObject({ kind: 'hours-minutes', text: '00:30' });
    expect(getEventCountdown({ ...event, countdown: { ...event.countdown!, enabled: false } }, ms('2026-10-03T00:30:00.000Z'))).toEqual({ kind: 'hidden' });
    expect(getEventCountdown(event, ms('2026-10-01T00:00:00.000Z'))).toEqual({ kind: 'hidden' });
    expect(getEventCountdown(event, ms('2026-10-03T02:00:00.000Z'))).toEqual({ kind: 'hidden' });
  });

  it('validates the event reference and the countdown display range', () => {
    expect(validateProposedItem(event).valid).toBe(true);
    expect(validateProposedItem({ ...event, countdown: { enabled: true, daysBefore: 31, reference: 'start' } }).valid).toBe(false);
    expect(validateProposedItem({ ...event, countdown: { enabled: true, daysBefore: 1, reference: 'middle' } }).valid).toBe(false);
  });
});
