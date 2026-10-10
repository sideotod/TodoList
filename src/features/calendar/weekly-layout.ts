export type TimedEventInterval = { startMinute: number; endMinute: number };

export type TimedEventGroup<T extends TimedEventInterval> = {
  items: T[];
  startMinute: number;
  endMinute: number;
};

export function groupOverlappingTimedEvents<T extends TimedEventInterval>(events: readonly T[]): TimedEventGroup<T>[] {
  const sorted = events.map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.startMinute - b.event.startMinute || a.event.endMinute - b.event.endMinute || a.index - b.index);
  const groups: TimedEventGroup<T>[] = [];
  for (const { event } of sorted) {
    const current = groups.at(-1);
    if (current && event.startMinute < current.endMinute) {
      current.items.push(event);
      current.endMinute = Math.max(current.endMinute, event.endMinute);
    } else {
      groups.push({ items: [event], startMinute: event.startMinute, endMinute: event.endMinute });
    }
  }
  return groups;
}
