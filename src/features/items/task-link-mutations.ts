import type { ItemView, ProposedCalendarItem } from '../../domain/items';

export type TaskLinkDetachment = { period: ItemView; proposal: ProposedCalendarItem };

/** Snapshot linked task state before deleting a task so a period never points at a missing ID. */
export function getTaskLinkDetachments(items: readonly ItemView[], taskId: string): TaskLinkDetachment[] {
  const task = items.find((item) => item.display.id === taskId && item.display.kind === 'task');
  if (!task || task.display.kind !== 'task') return [];
  return items.flatMap((period) => {
    const display = period.display;
    if (display.kind !== 'deadline' && display.kind !== 'window') return [];
    const sourceChecklist = display.checklist;
    const checklist = sourceChecklist.map((entry) => {
      if (entry.linkedTaskId !== taskId) return entry;
      const { linkedTaskId: removedId, ...snapshot } = entry;
      void removedId;
      return { ...snapshot, title: task.display.title, completed: task.display.completion === 'completed' };
    });
    if (checklist.every((entry, index) => entry === sourceChecklist[index])) return [];
    return [{ period, proposal: { ...display, checklist } }];
  });
}
