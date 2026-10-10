import type { ChecklistStatus, ItemView, PeriodChecklistItem } from './items';
import { addCalendarDays, getDateStartMs, getPeriodPhase, getTimingBounds } from './time';
import { getNextWeeklyOccurrence, getWeeklyOccurrenceForDate } from './recurrence';

export type HomePeriodSelection = { visible: ItemView[]; hiddenIncompleteCount: number };
export type PeriodGroups = { scheduled: ItemView[]; active: ItemView[]; overdue: ItemView[]; completed: ItemView[] };

export function deriveChecklistStatus(items: readonly PeriodChecklistItem[]): ChecklistStatus {
  const total = items.length;
  if (total === 0) return { kind: 'none', total: 0 };
  const remaining = items.filter((item) => !item.completed).length;
  return remaining === 0 ? { kind: 'complete', remaining: 0, total } : { kind: 'incomplete', remaining, total };
}

export function isItemDeleted(item: ItemView): boolean {
  return item.canonical?.deletedAt != null || item.localDraft?.mutationKind === 'delete';
}

function isPeriod(item: ItemView): boolean {
  return item.display.kind === 'deadline' || item.display.kind === 'window';
}

function compareIds(a: ItemView, b: ItemView): number {
  return a.display.id < b.display.id ? -1 : a.display.id > b.display.id ? 1 : 0;
}

type PeriodRank = { group: number; boundary: number; anchor: 'start' | 'end' };

function periodRank(item: ItemView, nowMs: number): PeriodRank {
  const bounds = getTimingBounds(item.display.timing);
  const phase = getPeriodPhase(bounds, nowMs);
  if (phase === 'overdue') return { group: 2, boundary: bounds.endExclusiveMs!, anchor: 'end' };
  if (phase === 'scheduled') {
    if (item.display.kind === 'deadline' && item.display.focus === 'deadline' && bounds.endExclusiveMs !== null) {
      return { group: 0, boundary: bounds.endExclusiveMs, anchor: 'end' };
    }
    return { group: 0, boundary: bounds.startMs!, anchor: 'start' };
  }
  if (bounds.endExclusiveMs !== null) return { group: 0, boundary: bounds.endExclusiveMs, anchor: 'end' };
  return { group: 1, boundary: bounds.startMs!, anchor: 'start' };
}

function comparePeriods(a: ItemView, b: ItemView, nowMs: number): number {
  const left = periodRank(a, nowMs);
  const right = periodRank(b, nowMs);
  if (left.group !== right.group) return left.group - right.group;
  const boundaryDifference = left.group === 2 ? right.boundary - left.boundary : left.boundary - right.boundary;
  if (boundaryDifference !== 0) return boundaryDifference;
  if (left.anchor !== right.anchor) return left.anchor === 'start' ? -1 : 1;
  return compareIds(a, b);
}

export function selectHomePeriods(items: readonly ItemView[], nowMs: number): HomePeriodSelection {
  const candidates = selectUrgentHomePeriods(items, nowMs);
  return { visible: candidates.slice(0, 2), hiddenIncompleteCount: Math.max(0, candidates.length - 2) };
}

export function selectUrgentHomePeriods(items: readonly ItemView[], nowMs: number): ItemView[] {
  const candidates = items.filter((item) => !isItemDeleted(item) && isPeriod(item) && item.display.completion === 'pending');
  candidates.sort((a, b) => comparePeriods(a, b, nowMs));
  return candidates;
}

export function selectUrgentHomeTimeline(items: readonly ItemView[], nowMs: number): ItemView[] {
  const candidates = items.flatMap((item) => {
    if (isItemDeleted(item)) return [];
    if (isPeriod(item)) return item.display.completion === 'pending' ? [item] : [];
    if (item.display.kind !== 'event') return [];
    if (item.display.showInProgressSummary === false) return [];
    const candidate = item.display.recurrence ? getNextWeeklyOccurrence(item, nowMs) : item;
    if (!candidate) return [];
    const timing = candidate.display.timing;
    if (timing.type === 'time' && timing.endAt === null) {
      const start = getTimingBounds(timing).startMs;
      return start !== null && start > nowMs ? [candidate] : [];
    }
    return getPeriodPhase(getTimingBounds(timing), nowMs) !== 'overdue' ? [candidate] : [];
  });
  candidates.sort((a, b) => comparePeriods(a, b, nowMs));
  return candidates;
}

function selectDayItems(items: readonly ItemView[], date: string, zone: string): ItemView[] {
  const dayStartMs = getDateStartMs(date, zone);
  const dayEndMs = getDateStartMs(addCalendarDays(date, 1), zone);
  const dayItems = items.flatMap((item) => {
    if (item.display.kind !== 'event' || !item.display.recurrence) return [item];
    const occurrence = getWeeklyOccurrenceForDate(item, date);
    return occurrence ? [occurrence] : [];
  });
  const selected = dayItems.filter((item) => {
    if (isItemDeleted(item)) return false;
    const timing = item.display.timing;
    if (timing.type === 'unscheduled') return false;
    if (timing.type === 'date') return (timing.startDate ?? timing.endDate) <= date && date <= timing.endDate;
    const { startMs, endExclusiveMs } = getTimingBounds(timing);
    if (item.display.kind === 'event' && timing.endAt === null) {
      return startMs !== null && dayStartMs <= startMs && startMs < dayEndMs;
    }
    // A deadline/task without a start is a due instant, rather than an unbounded range.
    if (startMs === null) return endExclusiveMs !== null && dayStartMs <= endExclusiveMs && endExclusiveMs < dayEndMs;
    return startMs < dayEndMs && (endExclusiveMs === null || dayStartMs < endExclusiveMs);
  });
  function dayOrder(item: ItemView): number {
    if (item.display.timing.type === 'date') return dayStartMs;
    const bounds = getTimingBounds(item.display.timing);
    return Math.max(dayStartMs, bounds.startMs ?? bounds.endExclusiveMs ?? dayStartMs);
  }
  return selected.sort((a, b) => dayOrder(a) - dayOrder(b) || compareIds(a, b));
}

export function selectDailyTasks(items: readonly ItemView[], date: string, zone: string): ItemView[] {
  return selectDayItems(items.filter((item) => item.display.kind === 'task'), date, zone);
}

export function selectCalendarAgenda(items: readonly ItemView[], date: string, zone: string): ItemView[] {
  return selectDayItems(items, date, zone);
}

export function selectPeriodGroups(items: readonly ItemView[], nowMs: number): PeriodGroups {
  const groups: PeriodGroups = { scheduled: [], active: [], overdue: [], completed: [] };
  for (const item of items) {
    if (isItemDeleted(item) || !isPeriod(item)) continue;
    if (item.display.completion === 'completed') groups.completed.push(item);
    else groups[getPeriodPhase(getTimingBounds(item.display.timing), nowMs)].push(item);
  }
  for (const group of [groups.scheduled, groups.active, groups.overdue]) {
    group.sort((a, b) => comparePeriods(a, b, nowMs));
  }
  const target = (item: ItemView): number => {
    const bounds = getTimingBounds(item.display.timing);
    return bounds.endExclusiveMs ?? bounds.startMs!;
  };
  groups.completed.sort((a, b) => target(b) - target(a) || compareIds(a, b));
  return groups;
}
