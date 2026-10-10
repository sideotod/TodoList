import { describe, expect, it } from 'vitest';
import type { ItemView, ProposedTaskItem } from '../../src/domain/items';
import { toLocalView } from '../../src/lib/local-preview-store';
import { orderDailyTasks, reorderTaskGroup, transitionTaskGroup, type TaskOrder } from '../../src/features/home/task-order';

function task(id: string, completion: 'pending' | 'completed' = 'pending', endDate = '2026-10-05'): ItemView {
  const proposal: ProposedTaskItem = {
    id,
    kind: 'task',
    title: id,
    timing: { type: 'date', startDate: null, endDate, timeZone: 'Asia/Seoul' },
    completion,
  };
  return toLocalView(proposal);
}

const emptyOrder: TaskOrder = { pending: [], completed: [] };
const date = '2026-10-05';

describe('daily task order', () => {
  it('sorts pending and completed groups independently and excludes tasks from other dates', () => {
    const items = [task('first'), task('second'), task('done', 'completed'), task('other-day', 'pending', '2026-10-06')];
    expect(orderDailyTasks(items, date, { pending: ['second', 'first'], completed: [] }).map((item) => item.display.id)).toEqual(['second', 'first', 'done']);
  });

  it('moves a completed or reopened task to the end of its new group', () => {
    const items = [task('first'), task('second'), task('done', 'completed')];
    const completed = transitionTaskGroup(items, date, { pending: ['first', 'second'], completed: ['done'] }, 'first', 'completed');
    expect(completed).toEqual({ pending: ['second'], completed: ['done', 'first'] });
    const afterComplete = items.map((item) => item.display.id === 'first' && item.display.kind === 'task'
      ? { ...item, display: { ...item.display, completion: 'completed' as const } }
      : item);
    const reopened = transitionTaskGroup(afterComplete, date, completed, 'done', 'pending');
    expect(reopened).toEqual({ pending: ['second', 'done'], completed: ['first'] });
  });

  it('reorders only within the same completion group', () => {
    const items = [task('first'), task('second'), task('done', 'completed')];
    const initial = { pending: ['first', 'second'], completed: ['done'] };
    expect(reorderTaskGroup(items, date, initial, 'first', 'second', true)).toEqual({ pending: ['second', 'first'], completed: ['done'] });
    expect(reorderTaskGroup(items, date, initial, 'first', 'done', true)).toBe(initial);
  });

  it('ignores identifiers that do not belong to the selected date', () => {
    const items = [task('first'), task('other-day', 'pending', '2026-10-06')];
    expect(transitionTaskGroup(items, date, emptyOrder, 'other-day', 'completed')).toBe(emptyOrder);
    expect(reorderTaskGroup(items, date, emptyOrder, 'first', 'other-day', true)).toBe(emptyOrder);
  });
});
