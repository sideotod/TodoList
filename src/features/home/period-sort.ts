import type { ItemView } from '../../domain/items';
import { isItemDeleted, selectPeriodGroups } from '../../domain/projections';
import { getPeriodPhase, getTimingBounds } from '../../domain/time';

export function movePeriodId(ids: readonly string[], sourceId: string, targetId: string, afterTarget: boolean): readonly string[] {
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids;

  const next = [...ids];
  next.splice(sourceIndex, 1);
  const nextTargetIndex = next.indexOf(targetId);
  next.splice(nextTargetIndex + Number(afterTarget), 0, sourceId);
  return next;
}

export function sortPeriodsChronologically(periods: readonly ItemView[]): ItemView[] {
  return [...periods].sort((first, second) => {
    const firstTiming = getTimingBounds(first.display.timing);
    const secondTiming = getTimingBounds(second.display.timing);
    return (firstTiming.endExclusiveMs ?? firstTiming.startMs ?? Number.MAX_SAFE_INTEGER)
      - (secondTiming.endExclusiveMs ?? secondTiming.startMs ?? Number.MAX_SAFE_INTEGER)
      || first.display.title.localeCompare(second.display.title, 'ko')
      || first.display.id.localeCompare(second.display.id);
  });
}

export function selectCompletedPeriods(items: readonly ItemView[], nowMs: number): ItemView[] {
  const groups = selectPeriodGroups(items, nowMs);
  const endedEvents = items.filter((item) => !isItemDeleted(item)
    && item.display.kind === 'event'
    && item.display.showInProgressSummary !== false
    && !item.display.recurrence
    && getPeriodPhase(getTimingBounds(item.display.timing), nowMs) === 'overdue');
  return sortPeriodsChronologically([...groups.completed, ...groups.overdue, ...endedEvents]);
}
