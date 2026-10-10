'use client';

import { useEffect, useRef, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { ItemKind, ItemView, ProposedCalendarItem } from '../../domain/items';
import { mergeTaskCategories, type TaskCategory } from '../../domain/task-categories';
import { getLocalDate } from '../../domain/time';
import { useRepository } from '../../lib/repository-context';
import { saveDesktopPreferences, useDesktopPreferences } from '../../lib/desktop-preferences';
import { reorderTaskGroup, transitionTaskGroup, type TaskOrder } from './task-order';
import { movePeriodId } from './period-sort';
import { MonthTaskGrid } from './MonthTaskGrid';
import { PeriodProgressSummary } from './PeriodProgressSummary';
import { SelectedDayTasks } from './SelectedDayTasks';
import { MonthHeader } from './MonthHeader';
import { TopActionMenu } from './TopActionMenu';
import { PeriodSortDialog } from './PeriodSortDialog';
import { getDateMonth } from '../calendar/calendar-dates';
import { CalendarItemDetailsDialog } from '../calendar/CalendarItemDetailsDialog';
import { ItemEditor } from '../items/ItemEditor';
import { TaskCategoryEditor } from '../items/TaskCategoryEditor';
import { createDraftInput } from '../items/draft-input';
import { toLocalView, updateLocalPreviewState, useLocalPreviewState } from '../../lib/local-preview-store';
import styles from './HomeExperience.module.css';

type HomeExperienceProps = {
  items: readonly ItemView[];
  nowMs: number;
  initialDate?: string;
  preview?: boolean;
};

export function HomeExperience({ items, nowMs, initialDate, preview = false }: HomeExperienceProps) {
  const selectedToday = initialDate ?? getLocalDate(nowMs, 'Asia/Seoul');
  const repository = useRepository();
  const preferences = useDesktopPreferences();
  const [selectedDate, setSelectedDate] = useState(selectedToday);
  const [month, setMonth] = useState(getDateMonth(selectedToday));
  const localPreview = useLocalPreviewState(items);
  const [taskOrder, setTaskOrder] = useState<TaskOrder>({ pending: [], completed: [] });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);
  const [editorDefaultKind, setEditorDefaultKind] = useState<ItemKind>('task');
  const [editorDefaultStartDate, setEditorDefaultStartDate] = useState(selectedToday);
  const [editorDefaultStartTime, setEditorDefaultStartTime] = useState('09:00');
  const [periodSortOpen, setPeriodSortOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [periodOrder, setPeriodOrder] = useState<string[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);
  const displayItems = preview ? localPreview.items : items;
  const taskCategories = mergeTaskCategories(displayItems, preferences.taskCategories);
  const orderedTaskCategories = orderTaskCategories(taskCategories, categoryOrder);
  const activeTaskOrder = preview ? (localPreview.taskOrders[selectedDate] ?? { pending: [], completed: [] }) : taskOrder;
  const editorItem = editorItemId ? displayItems.find((item) => item.display.id === editorItemId) ?? null : null;
  const detailsItem = detailsItemId ? displayItems.find((item) => item.display.id === detailsItemId) ?? null : null;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('todolist.period-order');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) setPeriodOrder(parsed);
      }
    } catch {
      setPeriodOrder([]);
    }
    try {
      const saved = window.localStorage.getItem('todolist.category-order');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((name) => typeof name === 'string')) setCategoryOrder(parsed);
      }
    } catch {
      setCategoryOrder([]);
    }
  }, []);

  function updatePreviewState(update: (current: PreviewState) => PreviewState) {
    if (!preview) return;
    try {
      updateLocalPreviewState(items, (current) => {
        const order = current.taskOrders[selectedDate] ?? { pending: [], completed: [] };
        const next = update({ ...order, completedIds: current.items.filter((entry) => entry.display.kind === 'task' && entry.display.completion === 'completed').map((entry) => entry.display.id) });
        return {
          ...current,
          items: current.items.map((entry) => {
            if (entry.display.kind !== 'task') return entry;
            const completion = next.completedIds.includes(entry.display.id) ? 'completed' : 'pending';
            return { ...entry, display: { ...entry.display, completion } };
          }),
          taskOrders: { ...current.taskOrders, [selectedDate]: { pending: next.pending, completed: next.completed } },
        };
      });
    } catch {
      setActionError('브라우저 로컬 저장소를 사용할 수 없어 변경 사항을 저장하지 못했습니다.');
    }
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    const dateMonth = getDateMonth(date);
    if (dateMonth !== month) setMonth(dateMonth);
  }

  async function toggleTask(item: ItemView) {
    if (item.display.kind !== 'task') return;
    const nextCompletion = item.display.completion === 'completed' ? 'pending' : 'completed';
    if (preview) {
      updatePreviewState((current) => {
        const nextOrder = transitionTaskGroup(displayItems, selectedDate, current, item.display.id, nextCompletion);
        const completedIds = new Set(current.completedIds);
        if (nextCompletion === 'completed') completedIds.add(item.display.id);
        else completedIds.delete(item.display.id);
        return { ...nextOrder, completedIds: [...completedIds] };
      });
      return;
    }
    if (!repository) return;
    setActionError('');
    const next: ProposedCalendarItem = { ...item.display, completion: nextCompletion };
    try {
      const result = await repository.saveDraft(createDraftInput(item, next));
      if (result.status === 'saved' || result.status === 'queued') {
        setTaskOrder((current) => transitionTaskGroup(items, selectedDate, current, item.display.id, nextCompletion));
      } else if (result.status === 'conflict') {
        setActionError('다른 기기에서 이 할 일이 바뀌었습니다. 항목을 열어 양쪽 내용을 확인해 주세요.');
        setEditorItemId(item.display.id);
        setEditorOpen(true);
      } else if (result.status === 'stale-local') {
        setActionError('다른 탭에서 이 할 일이 수정되었습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '완료 상태를 저장하지 못했습니다.');
    }
  }

  async function toggleEventCountdown(item: ItemView, enabled: boolean) {
    let next: ProposedCalendarItem;
    if (item.display.kind === 'event') {
      next = { ...item.display, countdown: { enabled, daysBefore: item.display.countdown?.daysBefore ?? 1, reference: item.display.countdown?.reference ?? 'start' } };
    } else if (item.display.kind === 'window') {
      next = { ...item.display, startCountdown: { ...item.display.startCountdown, enabled } };
    } else if (item.display.kind === 'deadline' && item.display.startCountdown) {
      next = { ...item.display, startCountdown: { ...item.display.startCountdown, enabled } };
    } else return;
    if (preview) {
      try {
        updateLocalPreviewState(items, (current) => ({
          ...current,
          items: current.items.map((entry) => entry.display.id === item.display.id ? { ...entry, display: next } : entry),
        }));
        return;
      } catch {
        throw new Error('브라우저 로컬 저장소에 설정을 저장하지 못했습니다.');
      }
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    try {
      const result = await repository.saveDraft(createDraftInput(item, next));
      if (result.status === 'saved' || result.status === 'queued') return;
      throw new Error(result.status === 'conflict'
        ? '다른 기기에서 일정이 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.'
        : '다른 탭에서 일정이 수정되었습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.');
    } catch (error) {
      throw error instanceof Error ? error : new Error('카운트다운 설정을 저장하지 못했습니다.');
    }
  }

  async function deleteItem(item: ItemView) {
    if (!window.confirm(`“${item.display.title}” 항목을 삭제할까요?`)) return;
    setActionError('');
    if (preview) {
      try {
        updateLocalPreviewState(items, (current) => {
          const { [item.display.id]: _removedReminder, ...reminderOffsets } = current.reminderOffsets;
          void _removedReminder;
          return {
            ...current,
            items: current.items.filter((entry) => entry.display.id !== item.display.id),
            reminderOffsets,
          };
        });
        setEditorOpen(false);
        setEditorItemId(null);
      } catch {
        setActionError('브라우저 로컬 저장소를 사용할 수 없어 삭제하지 못했습니다.');
      }
      return;
    }
    if (!repository) return;
    try {
      const result = await repository.saveDraft(createDraftInput(item, item.display, 'delete'));
      if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') {
        setEditorOpen(false);
        setEditorItemId(null);
      } else if (result.status === 'conflict') {
        setActionError('다른 기기에서 이 항목이 변경되었습니다. 삭제 전 양쪽 내용을 확인해 주세요.');
      } else {
        setActionError('다른 탭에서 내용이 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '항목을 삭제하지 못했습니다.');
    }
  }

  function openNewTask() {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setEditorItemId(null);
    setEditorDefaultKind('task');
    setEditorDefaultStartDate(selectedDate);
    setEditorDefaultStartTime('09:00');
    setEditorOpen(true);
  }

  function openNewEvent() {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const defaultTiming = getDefaultEventTiming(selectedDate, nowMs, preferences.timeZone);
    setEditorItemId(null);
    setEditorDefaultKind('event');
    setEditorDefaultStartDate(defaultTiming.date);
    setEditorDefaultStartTime(defaultTiming.time);
    setEditorOpen(true);
  }

  function addTaskCategory(category: TaskCategory): boolean {
    try {
      saveDesktopPreferences({ ...preferences, taskCategories: [...preferences.taskCategories, category] });
      setActionError('');
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '카테고리를 저장하지 못했습니다.');
      return false;
    }
  }

  function openDetails(item: ItemView) {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setDetailsItemId(item.display.id);
  }

  function reorderTask(sourceId: string, targetId: string, afterTarget: boolean) {
    if (preview) {
      updatePreviewState((current) => {
        return { ...current, ...reorderTaskGroup(displayItems, selectedDate, current, sourceId, targetId, afterTarget) };
      });
      return;
    }
    setTaskOrder((current) => reorderTaskGroup(displayItems, selectedDate, current, sourceId, targetId, afterTarget));
  }

  function reorderCategory(sourceName: string, targetName: string, afterTarget: boolean) {
    const currentNames = orderedTaskCategories.map((category) => category.name);
    const nextOrder = movePeriodId(currentNames, sourceName, targetName, afterTarget);
    setCategoryOrder([...nextOrder]);
    try {
      window.localStorage.setItem('todolist.category-order', JSON.stringify(nextOrder));
    } catch {
      setActionError('이 기기에 카테고리 순서를 저장하지 못했습니다.');
    }
  }

  function persistPeriodOrder(nextOrder: string[]) {
    setPeriodOrder(nextOrder);
    try {
      window.localStorage.setItem('todolist.period-order', JSON.stringify(nextOrder));
    } catch {
      setActionError('이 기기에 일정 순서를 저장하지 못했습니다.');
    }
  }

  return (
    <div className={styles.page}>
      <TopActionMenu onAddTask={openNewTask} onAddEvent={openNewEvent} onSort={() => setPeriodSortOpen(true)} onManageCategories={() => setCategoryEditorOpen(true)} />
      <PeriodProgressSummary items={displayItems} nowMs={nowMs} onAddSchedule={openNewEvent} onOpen={openDetails} orderIds={periodOrder} onOrderChange={persistPeriodOrder} />
      {actionError && <p className={styles.feedback} role="alert">{actionError}</p>}
      <div className={styles.workspace} data-testid="home-workspace">
        <section className={styles.calendarPanel}>
          <MonthHeader items={displayItems} month={month} onChangeMonth={setMonth} timeZone={preferences.timeZone} />
          <MonthTaskGrid
            items={displayItems}
            month={month}
            onChangeMonth={setMonth}
            onSelectDate={selectDate}
            showHeading={false}
            selectedDate={selectedDate}
          />
        </section>
        <SelectedDayTasks
          categories={orderedTaskCategories}
          categoryOrder={categoryOrder}
          date={selectedDate}
          items={displayItems}
          taskOrder={activeTaskOrder}
          onAdd={openNewTask}
          onToggle={toggleTask}
          onOpen={openDetails}
          onReorder={reorderTask}
          onReorderCategories={reorderCategory}
        />
      </div>
      {detailsItem && (
        <CalendarItemDetailsDialog
          key={detailsItem.display.id}
          item={detailsItem}
          nowMs={nowMs}
          onToggleCountdown={toggleEventCountdown}
          onClose={() => setDetailsItemId(null)}
          onEdit={() => {
            setEditorItemId(detailsItem.display.id);
            setDetailsItemId(null);
            setEditorOpen(true);
          }}
        />
      )}
      {editorOpen && (
        <ItemEditor
          initial={editorItem}
          returnFocusRef={editorReturnFocusRef}
          selectedDate={selectedDate}
          defaultMode={editorDefaultKind === 'event' ? 'time' : 'date'}
          defaultKind={editorDefaultKind}
          defaultStartDate={editorDefaultStartDate}
          defaultStartTime={editorDefaultStartTime}
          defaultTimeZone={preferences.timeZone}
          onClose={() => setEditorOpen(false)}
          onSaved={(savedItem) => {
            if (editorItem || savedItem.kind === 'task') return;
            const nextOrder = [savedItem.id, ...periodOrder.filter((id) => id !== savedItem.id)];
            persistPeriodOrder(nextOrder);
          }}
          onConflict={(itemId) => { setEditorItemId(itemId); setActionError('동기화 충돌이 있습니다. 양쪽 버전을 확인해 주세요.'); }}
          onDelete={editorItem ? () => { void deleteItem(editorItem); } : undefined}
          initialReminderOffset={editorItem ? localPreview.reminderOffsets[editorItem.display.id] ?? null : null}
          taskCategories={taskCategories}
          onLocalSave={preview ? async (proposal, reminderOffset) => {
            updateLocalPreviewState(items, (current) => {
              const previous = current.items.find((entry) => entry.display.id === proposal.id);
              const nextItems = current.items.some((entry) => entry.display.id === proposal.id)
                ? current.items.map((entry) => entry.display.id === proposal.id ? toLocalView(proposal) : entry)
                : [...current.items, toLocalView(proposal)];
              let taskOrders = current.taskOrders;
              if (previous?.display.kind === 'task' && proposal.kind === 'task' && previous.display.completion !== proposal.completion) {
                const currentOrder = taskOrders[selectedDate] ?? { pending: [], completed: [] };
                taskOrders = {
                  ...taskOrders,
                  [selectedDate]: transitionTaskGroup(current.items, selectedDate, currentOrder, proposal.id, proposal.completion),
                };
              }
              const { [proposal.id]: _previousReminder, ...reminderOffsets } = current.reminderOffsets;
              void _previousReminder;
              return {
                ...current,
                items: nextItems,
                taskOrders,
                reminderOffsets: reminderOffset === null ? reminderOffsets : { ...reminderOffsets, [proposal.id]: reminderOffset },
              };
            });
          } : undefined}
        />
      )}
      {periodSortOpen && (
        <PeriodSortDialog
          items={displayItems}
          nowMs={nowMs}
          orderIds={periodOrder}
          onClose={() => setPeriodSortOpen(false)}
          onSave={(nextOrder) => {
            persistPeriodOrder(nextOrder);
            setPeriodSortOpen(false);
          }}
        />
      )}
      {categoryEditorOpen && (
        <TaskCategoryEditor
          categories={orderedTaskCategories}
          onClose={() => setCategoryEditorOpen(false)}
          onSave={addTaskCategory}
        />
      )}
    </div>
  );
}

type PreviewState = TaskOrder & { completedIds: string[] };

function orderTaskCategories(categories: readonly TaskCategory[], order: readonly string[]): TaskCategory[] {
  if (order.length === 0) return [...categories];
  const rank = new Map(order.map((name, index) => [name.toLocaleLowerCase('ko-KR'), index]));
  return [...categories].sort((first, second) =>
    (rank.get(first.name.toLocaleLowerCase('ko-KR')) ?? Number.MAX_SAFE_INTEGER)
      - (rank.get(second.name.toLocaleLowerCase('ko-KR')) ?? Number.MAX_SAFE_INTEGER),
  );
}

function getDefaultEventTiming(selectedDate: string, nowMs: number, timeZone: string): { date: string; time: string } {
  const now = Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(timeZone);
  const today = now.toPlainDate().toString();
  if (selectedDate !== today) return { date: selectedDate, time: '09:00' };

  const roundedMinutes = Math.ceil((now.hour * 60 + now.minute + 30) / 15) * 15;
  if (roundedMinutes > 23 * 60 + 15) return { date: now.toPlainDate().add({ days: 1 }).toString(), time: '00:00' };
  return {
    date: selectedDate,
    time: `${String(Math.floor(roundedMinutes / 60)).padStart(2, '0')}:${String(roundedMinutes % 60).padStart(2, '0')}`,
  };
}
