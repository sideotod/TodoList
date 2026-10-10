import { describe, expect, it } from 'vitest';
import { groupOverlappingTimedEvents } from '../../src/features/calendar/weekly-layout';

describe('groupOverlappingTimedEvents', () => {
  it('groups chained overlaps and keeps endpoint-touching events separate', () => {
    const events = [
      { id: 'first', startMinute: 540, endMinute: 600 },
      { id: 'second', startMinute: 570, endMinute: 630 },
      { id: 'third', startMinute: 615, endMinute: 675 },
      { id: 'next', startMinute: 675, endMinute: 720 },
    ];

    expect(groupOverlappingTimedEvents(events)).toEqual([
      { items: events.slice(0, 3), startMinute: 540, endMinute: 675 },
      { items: [events[3]], startMinute: 675, endMinute: 720 },
    ]);
  });

  it('groups nested intervals into one conflict summary', () => {
    const events = [
      { id: 'outer', startMinute: 540, endMinute: 780 },
      { id: 'middle', startMinute: 600, endMinute: 720 },
      { id: 'inner', startMinute: 630, endMinute: 660 },
    ];

    expect(groupOverlappingTimedEvents(events)).toEqual([
      { items: events, startMinute: 540, endMinute: 780 },
    ]);
  });
});
