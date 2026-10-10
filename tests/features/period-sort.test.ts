import { describe, expect, it } from 'vitest';
import type { ItemView } from '../../src/domain/items';
import { toLocalView } from '../../src/lib/local-preview-store';
import { movePeriodId, selectCompletedPeriods, sortPeriodsChronologically } from '../../src/features/home/period-sort';
import { makeDeadline } from '../fixtures/items';

describe('period sorting', () => {
  it('moves a dragged period before or after its target', () => {
    expect(movePeriodId(['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b']);
    expect(movePeriodId(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the original order when either period is missing', () => {
    const ids = ['a', 'b'];
    expect(movePeriodId(ids, 'missing', 'a', false)).toBe(ids);
  });

  it('sorts all deadline periods by their end time', () => {
    const items: ItemView[] = [
      toLocalView(makeDeadline({ id: 'later', timing: { type: 'date', startDate: null, endDate: '2026-10-15', timeZone: 'Asia/Seoul' } })),
      toLocalView(makeDeadline({ id: 'earlier', timing: { type: 'date', startDate: null, endDate: '2026-10-04', timeZone: 'Asia/Seoul' } })),
    ];
    expect(sortPeriodsChronologically(items).map((item) => item.display.id)).toEqual(['earlier', 'later']);
  });

  it('includes ended periods in the completed schedule pane', () => {
    const items: ItemView[] = [
      toLocalView(makeDeadline({ id: 'ended', timing: { type: 'date', startDate: null, endDate: '2026-10-04', timeZone: 'Asia/Seoul' } })),
      toLocalView(makeDeadline({ id: 'completed', completion: 'completed', timing: { type: 'date', startDate: null, endDate: '2026-10-15', timeZone: 'Asia/Seoul' } })),
      toLocalView(makeDeadline({ id: 'active', timing: { type: 'date', startDate: '2026-10-04', endDate: '2026-10-15', timeZone: 'Asia/Seoul' } })),
    ];

    expect(selectCompletedPeriods(items, Date.parse('2026-10-10T00:00:00.000Z')).map((item) => item.display.id)).toEqual(['ended', 'completed']);
  });

  it('includes ended events in the completed schedule pane', () => {
    const event = toLocalView({
      id: 'ended-event',
      kind: 'event',
      title: '종료된 일정',
      timing: { type: 'time', startAt: '2026-10-04T10:00:00.000Z', endAt: '2026-10-04T11:00:00.000Z', timeZone: 'Asia/Seoul' },
    });

    expect(selectCompletedPeriods([event], Date.parse('2026-10-05T00:00:00.000Z')).map((item) => item.display.id)).toEqual(['ended-event']);
  });
});
