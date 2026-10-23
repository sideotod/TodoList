'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Temporal } from '@js-temporal/polyfill';
import type { ItemKind, ItemView, ProposedCalendarItem } from '../../domain/items';
import { DEFAULT_TASK_CATEGORY, mergeTaskCategories, type TaskCategory } from '../../domain/task-categories';
import { getLocalDate } from '../../domain/time';
import { useRepository } from '../../lib/repository-context';
import { updateRouteDate, updateRouteSearchParam } from '../../lib/route-date';
import { saveDesktopPreferences, useDesktopPreferences } from '../../lib/desktop-preferences';
import { reorderTaskGroup, transitionTaskGroup, type TaskOrder } from './task-order';
import { movePeriodId } from './period-sort';
import { MonthTaskGrid } from './MonthTaskGrid';
import { PeriodProgressSummary } from './PeriodProgressSummary';
import { SelectedDayTasks } from './SelectedDayTasks';
import { MonthHeader } from './MonthHeader';
import { TopActionMenu } from './TopActionMenu';
import { PeriodSortDialog } from './PeriodSortDialog';
import { formatCalendarHeading, getDateMonth, moveToMonthDate } from '../calendar/calendar-dates';
import { CalendarItemDetailsDialog } from '../calendar/CalendarItemDetailsDialog';
import { ItemEditor } from '../items/ItemEditor';
import { TaskCategoryEditor } from '../items/TaskCategoryEditor';
import { getTaskLinkDetachments } from '../items/task-link-mutations';
import { createDraftInput } from '../items/draft-input';
import { toLocalView, updateLocalPreviewState, useLocalPreviewState } from '../../lib/local-preview-store';
import styles from './HomeExperience.module.css';

type HomeExperienceProps = {
  items: readonly ItemView[];
  nowMs: number;
  initialDate?: string;
  todayDate?: string;
  preview?: boolean;
};

export function HomeExperience({ items, nowMs, initialDate, todayDate, preview = false }: HomeExperienceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedToday = todayDate ?? getLocalDate(nowMs, 'Asia/Seoul');
  const selectedInitialDate = initialDate ?? selectedToday;
  const repository = useRepository();
  const preferences = useDesktopPreferences();
  const [selectedDate, setSelectedDate] = useState(selectedInitialDate);
  const [month, setMonth] = useState(getDateMonth(selectedInitialDate));
  const localPreview = useLocalPreviewState(items);
  const [taskOrder, setTaskOrder] = useState<TaskOrder>({ pending: [], completed: [] });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItemId, setEditorItemId] = useState<string | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);
  const [editorDefaultKind, setEditorDefaultKind] = useState<ItemKind>('task');
  const [editorDefaultStartDate, setEditorDefaultStartDate] = useState(selectedToday);
  const [editorDefaultStartTime, setEditorDefaultStartTime] = useState('09:00');
  const [periodSortOpen, setPeriodSortOpen] = useState(false);
  const [periodDialogView, setPeriodDialogView] = useState<'sort' | 'all'>('sort');
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [periodOrder, setPeriodOrder] = useState<string[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');
  const handledOpenId = useRef<string | null>(null);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);
  const displayItems = preview ? localPreview.items : items;
  const taskCategories = mergeTaskCategories(displayItems, preferences.taskCategories);
  const orderedTaskCategories = orderTaskCategories(taskCategories, categoryOrder);
  const activeTaskOrder = preview ? (localPreview.taskOrders[selectedDate] ?? { pending: [], completed: [] }) : taskOrder;
  const editorItem = editorItemId ? displayItems.find((item) => item.display.id === editorItemId) ?? null : null;
  const detailsItem = detailsItemId ? displayItems.find((item) => item.display.id === detailsItemId) ?? null : null;
  const requestedOpenId = searchParams.get('open');
  const composeTask = searchParams.get('compose') === 'task';

  useEffect(() => {
    if (!requestedOpenId) { handledOpenId.current = null; return; }
    if (handledOpenId.current === requestedOpenId) return;
    if (displayItems.some((item) => item.display.id === requestedOpenId)) {
      handledOpenId.current = requestedOpenId;
      setDetailsItemId(requestedOpenId);
    }
  }, [displayItems, requestedOpenId]);

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
    updateRouteDate(date);
    const dateMonth = getDateMonth(date);
    if (dateMonth !== month) setMonth(dateMonth);
  }

  function changeMonth(nextMonth: string) {
    const nextDate = moveToMonthDate(selectedDate, nextMonth);
    setMonth(nextMonth);
    setSelectedDate(nextDate);
    updateRouteDate(nextDate);
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

  async function togglePeriodCompletion(item: ItemView) {
    if (item.display.kind !== 'deadline' && item.display.kind !== 'window') return;
    const next: ProposedCalendarItem = { ...item.display, completion: item.display.completion === 'completed' ? 'pending' : 'completed' };
    if (preview) {
      updateLocalPreviewState(items, (current) => ({ ...current, items: current.items.map((entry) => entry.display.id === item.display.id ? toLocalView(next) : entry) }));
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(item, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('완료 상태를 저장하지 못했습니다.');
  }

  async function toggleLinkedTaskCompletion(taskId: string, completed: boolean) {
    const task = displayItems.find((item) => item.display.id === taskId && item.display.kind === 'task');
    if (!task || task.display.kind !== 'task') throw new Error('연결된 할 일을 찾을 수 없습니다. 연결을 해제한 뒤 다시 시도해 주세요.');
    const next: ProposedCalendarItem = { ...task.display, completion: completed ? 'completed' : 'pending' };
    if (preview) {
      updateLocalPreviewState(items, (current) => ({ ...current, items: current.items.map((entry) => entry.display.id === taskId ? toLocalView(next) : entry) }));
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(task, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('연결된 할 일을 저장하지 못했습니다.');
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
        const detachments = getTaskLinkDetachments(displayItems, item.display.id);
        const detached = new Map(detachments.map((entry) => [entry.period.display.id, entry.proposal]));
        updateLocalPreviewState(items, (current) => {
          const { [item.display.id]: _removedReminder, ...reminderOffsets } = current.reminderOffsets;
          void _removedReminder;
          return {
            ...current,
            items: current.items.filter((entry) => entry.display.id !== item.display.id).map((entry) => {
              const proposal = detached.get(entry.display.id);
              return proposal ? toLocalView(proposal) : entry;
            }),
            reminderOffsets,
          };
        });
        setEditorOpen(false);
        setEditorItemId(null);
        setDetailsItemId(null);
      } catch {
        setActionError('브라우저 로컬 저장소를 사용할 수 없어 삭제하지 못했습니다.');
      }
      return;
    }
    if (!repository) return;
    try {
      const detachments = getTaskLinkDetachments(displayItems, item.display.id);
      for (const detachment of detachments) {
        const detached = await repository.saveDraft(createDraftInput(detachment.period, detachment.proposal));
        if (detached.status !== 'saved' && detached.status !== 'queued') throw new Error('연결된 기간을 먼저 저장하지 못해 할 일을 삭제하지 않았습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.');
      }
      const result = await repository.saveDraft(createDraftInput(item, item.display, 'delete'));
      if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') {
        setEditorOpen(false);
        setEditorItemId(null);
        setDetailsItemId(null);
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

  async function quickAddTask(title: string): Promise<boolean> {
    const id = createItemId();
    const proposal: ProposedCalendarItem = {
      id,
      title,
      kind: 'task',
      category: DEFAULT_TASK_CATEGORY.name,
      categoryColor: DEFAULT_TASK_CATEGORY.color,
      completion: 'pending',
      timing: { type: 'date', startDate: null, endDate: selectedDate, timeZone: preferences.timeZone },
    };
    if (preview) {
      updateLocalPreviewState(items, (current) => ({ ...current, items: [...current.items, toLocalView(proposal)] }));
      return true;
    }
    if (!repository) throw new Error('할 일을 저장할 저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft({ itemId: id, expectedLocalSequence: null, baseRevision: null, baseSnapshot: null, mutationKind: 'upsert', proposedSnapshot: proposal });
    if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') return true;
    if (result.status === 'conflict') throw new Error('같은 할 일이 다른 기기에서 먼저 생성되었습니다. 목록을 새로 고쳐 확인해 주세요.');
    throw new Error('다른 탭의 변경 사항을 불러온 뒤 다시 저장해 주세요.');
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

  function openPeriodDialog(view: 'sort' | 'all') {
    setPeriodDialogView(view);
    setPeriodSortOpen(true);
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <span>{formatCalendarHeading(selectedToday)}</span>
          <h1>{selectedToday === selectedDate ? '오늘' : formatCalendarHeading(selectedDate)}</h1>
          {selectedToday === selectedDate && <p>지금 해야 할 일과, 놓치면 안 되는 시간.</p>}
        </div>
        <TopActionMenu onAddTask={openNewTask} onAddEvent={openNewEvent} onSort={() => openPeriodDialog('sort')} onManageCategories={() => setCategoryEditorOpen(true)} />
      </header>
      <div className={styles.workspace} data-testid="home-workspace">
        <section className={styles.primaryColumn}>
          <PeriodProgressSummary items={displayItems} nowMs={nowMs} onAddSchedule={openNewEvent} onViewAll={() => router.push(preview ? '/progress?preview=design' : '/progress')} onOpen={openDetails} orderIds={periodOrder} onOrderChange={persistPeriodOrder} />
          <SelectedDayTasks
            key={composeTask ? 'compose-task' : 'daily-tasks'}
            autoOpenQuickAdd={composeTask}
            categories={orderedTaskCategories}
            categoryOrder={categoryOrder}
            date={selectedDate}
            displayMode="tasks"
            heading={selectedDate === selectedToday ? '오늘 할 일' : `${formatCalendarHeading(selectedDate)} 할 일`}
            items={displayItems}
            onOpen={openDetails}
            onQuickAdd={quickAddTask}
            onQuickAddDismiss={() => updateRouteSearchParam('compose', null)}
            onReorder={reorderTask}
            onReorderCategories={reorderCategory}
            onToggle={toggleTask}
            taskOrder={activeTaskOrder}
          />
          {actionError && <p className={styles.feedback} role="alert">{actionError}</p>}
        </section>
        <aside className={styles.calendarPanel} aria-label="미니 캘린더와 일정">
          <MonthHeader compact items={displayItems} month={month} onChangeMonth={changeMonth} timeZone={preferences.timeZone} />
          <MonthTaskGrid categories={taskCategories} compact items={displayItems} month={month} onChangeMonth={setMonth} onSelectDate={selectDate} showHeading={false} selectedDate={selectedDate} weekStartsOn={preferences.weekStartsOn} />
          <SelectedDayTasks date={selectedDate} displayMode="agenda" heading="선택 날짜 일정" items={displayItems} taskOrder={activeTaskOrder} onAddEvent={openNewEvent} onOpen={openDetails} />
        </aside>
      </div>
      {detailsItem && (
        <CalendarItemDetailsDialog
          key={detailsItem.display.id}
          item={detailsItem}
          allItems={displayItems}
          nowMs={nowMs}
          onToggleCountdown={toggleEventCountdown}
          onClose={() => setDetailsItemId(null)}
          onDelete={() => { void deleteItem(detailsItem); }}
          onComplete={() => {
            const action = detailsItem.display.kind === 'task' ? toggleTask(detailsItem) : togglePeriodCompletion(detailsItem);
            void action.catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : '완료 상태를 저장하지 못했습니다.'));
          }}
          onCalendar={() => {
            const timing = detailsItem.display.timing;
            const date = timing.type === 'date' ? timing.endDate : timing.type === 'time' ? getLocalDate(Date.parse(timing.startAt ?? timing.endAt ?? new Date(nowMs).toISOString()), timing.timeZone) : selectedDate;
            router.push((preview ? '/calendar?preview=design&' : '/calendar?') + 'date=' + encodeURIComponent(date));
            setDetailsItemId(null);
          }}
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
          availableTasks={displayItems}
          onToggleLinkedTask={toggleLinkedTaskCompletion}
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
          initialView={periodDialogView}
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
    </main>
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

function createItemId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
