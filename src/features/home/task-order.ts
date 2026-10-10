import type { Completion, ItemView } from '../../domain/items';
import { isItemDeleted, selectDailyTasks } from '../../domain/projections';

export type TaskOrder = {
  pending: string[];
  completed: string[];
};

type TaskGroup = keyof TaskOrder;

function getDailyTasks(items: readonly ItemView[], date: string): ItemView[] {
  return selectDailyTasks(items, date, 'Asia/Seoul').filter((item) => !isItemDeleted(item));
}

function getGroupIds(items: readonly ItemView[], group: TaskGroup, savedOrder: readonly string[]): string[] {
  const groupIds = items
    .filter((item) => item.display.kind === 'task' && item.display.completion === group)
    .map((item) => item.display.id);
  const available = new Set(groupIds);
  const ordered = savedOrder.filter((id) => available.has(id));
  const orderedSet = new Set(ordered);
  return [...ordered, ...groupIds.filter((id) => !orderedSet.has(id))];
}

export function orderDailyTasks(items: readonly ItemView[], date: string, order: TaskOrder): ItemView[] {
  return orderTaskCollection(getDailyTasks(items, date), order);
}

function orderTaskCollection(items: readonly ItemView[], order: TaskOrder): ItemView[] {
  const pending = getGroupIds(items, 'pending', order.pending);
  const completed = getGroupIds(items, 'completed', order.completed);
  const orderedIds = new Set([...pending, ...completed]);
  const taskById = new Map(items.map((item) => [item.display.id, item]));
  return [...pending, ...completed]
    .filter((id) => orderedIds.has(id))
    .map((id) => taskById.get(id))
    .filter((item): item is ItemView => item !== undefined);
}

export function transitionTaskGroup(
  items: readonly ItemView[],
  date: string,
  order: TaskOrder,
  itemId: string,
  completion: Completion,
): TaskOrder {
  return transitionTaskCollection(getDailyTasks(items, date), order, itemId, completion);
}

function transitionTaskCollection(items: readonly ItemView[], order: TaskOrder, itemId: string, completion: Completion): TaskOrder {
  const item = items.find((task) => task.display.id === itemId);
  if (!item || item.display.kind !== 'task') return order;

  const source: TaskGroup = item.display.completion;
  const destination: TaskGroup = completion;
  if (source === destination) return order;

  const sourceIds = getGroupIds(items, source, order[source]).filter((id) => id !== itemId);
  const destinationIds = [...getGroupIds(items, destination, order[destination]).filter((id) => id !== itemId), itemId];
  return source === 'pending'
    ? { pending: sourceIds, completed: destinationIds }
    : { pending: destinationIds, completed: sourceIds };
}

export function reorderTaskGroup(
  items: readonly ItemView[],
  date: string,
  order: TaskOrder,
  sourceId: string,
  targetId: string,
  afterTarget: boolean,
): TaskOrder {
  return reorderTaskCollection(getDailyTasks(items, date), order, sourceId, targetId, afterTarget);
}

function reorderTaskCollection(items: readonly ItemView[], order: TaskOrder, sourceId: string, targetId: string, afterTarget: boolean): TaskOrder {
  if (sourceId === targetId) return order;
  const sourceItem = items.find((item) => item.display.id === sourceId);
  const targetItem = items.find((item) => item.display.id === targetId);
  if (sourceItem?.display.kind !== 'task' || targetItem?.display.kind !== 'task') return order;
  const group: TaskGroup = sourceItem.display.completion;
  if (group !== targetItem.display.completion) return order;

  const ids = getGroupIds(items, group, order[group]);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return order;

  ids.splice(sourceIndex, 1);
  let insertionIndex = targetIndex + (afterTarget ? 1 : 0);
  if (sourceIndex < insertionIndex) insertionIndex -= 1;
  ids.splice(insertionIndex, 0, sourceId);
  return group === 'pending' ? { ...order, pending: ids } : { ...order, completed: ids };
}
