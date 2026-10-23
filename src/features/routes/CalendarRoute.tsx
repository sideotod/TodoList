'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import { getTaskCategories } from '../../domain/task-categories';
import { getLocalDate } from '../../domain/time';
import { useRepository, useItems } from '../../lib/repository-context';
import { parseRouteDate, updateRouteDate, updateRouteSearchParam } from '../../lib/route-date';
import { useForegroundClock } from '../shell/useForegroundClock';
import { AppShell } from '../shell/AppShell';
import { createLocalPreviewFixture } from '../home/preview-data';
import { WeekCalendarView, type CalendarViewMode } from '../calendar/WeekCalendarView';
import { CalendarItemDetailsDialog } from '../calendar/CalendarItemDetailsDialog';
import { ItemEditor } from '../items/ItemEditor';
import { createDraftInput } from '../items/draft-input';
import { getTaskLinkDetachments } from '../items/task-link-mutations';
import { toLocalView, updateLocalPreviewState, useLocalPreviewState, type ReminderOffset } from '../../lib/local-preview-store';
import { useDesktopPreferences } from '../../lib/desktop-preferences';
import styles from '../home/HomeExperience.module.css';

export function CalendarRoute({ initialNowMs }: { initialNowMs: number }) {
  const serverItems = useItems();
  const nowMs = useForegroundClock(initialNowMs);
  const localDate = getLocalDate(nowMs, 'Asia/Seoul');
  const fallback = useMemo(() => createLocalPreviewFixture(localDate).items, [localDate]);
  const localState = useLocalPreviewState(fallback);
  const signedInCalendar = (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarWorkspace items={serverItems} fallback={fallback} nowMs={nowMs} initialDate={localDate} preview={false} />
    </Suspense>
  );
  const previewCalendar = (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarWorkspace items={localState.items} fallback={fallback} nowMs={nowMs} initialDate={localDate} preview reminderOffsets={localState.reminderOffsets} />
    </Suspense>
  );

  return <AppShell previewItems={fallback} previewContent={previewCalendar} todayDate={localDate}>{signedInCalendar}</AppShell>;
}

type CalendarWorkspaceProps = {
  items: readonly ItemView[];
  fallback: readonly ItemView[];
  nowMs: number;
  initialDate: string;
  preview: boolean;
  reminderOffsets?: Readonly<Record<string, ReminderOffset>>;
};

function CalendarWorkspace({ items, fallback, nowMs, initialDate, preview, reminderOffsets }: CalendarWorkspaceProps) {
  const repository = useRepository();
  const preferences = useDesktopPreferences();
  const calendarItems = items.filter((item) => item.display.kind === 'task' ? preferences.calendarVisibility.tasks : item.display.kind === 'event' ? preferences.calendarVisibility.events : preferences.calendarVisibility.progress);
  const searchParams = useSearchParams();
  const routeDate = parseRouteDate(searchParams.get('date'));
  const viewParam = searchParams.get('view');
  const view: CalendarViewMode = viewParam === 'day' || viewParam === 'week' || viewParam === 'month' || viewParam === 'year'
    ? viewParam : searchParams.get('filter') === 'period' ? 'periods' : 'week';
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<ItemView | null>(null);
  const [detailsItem, setDetailsItem] = useState<ItemView | null>(null);
  const [editorDate, setEditorDate] = useState(routeDate ?? initialDate);
  const [editorStartTime, setEditorStartTime] = useState('09:00');
  const [editorKind, setEditorKind] = useState<'task' | 'event'>('event');
  const [actionError, setActionError] = useState('');
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);

  function addOn(date: string, startTime = '09:00') {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setEditorDate(date);
    setEditorStartTime(startTime);
    setEditorKind('event');
    setEditorItem(null);
    setEditorOpen(true);
  }

  function addTask(date: string) {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setEditorDate(date);
    setEditorStartTime('09:00');
    setEditorKind('task');
    setEditorItem(null);
    setEditorOpen(true);
  }

  function openItem(item: ItemView) {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const series = item.display.kind === 'event' && item.display.recurrence
      ? items.find((candidate) => candidate.display.id === item.display.id) ?? item
      : item;
    setEditorItem(series);
    setDetailsItem(item);
  }

  function editDetailsItem() {
    setDetailsItem(null);
    setEditorOpen(true);
  }

  function saveLocal(proposal: ProposedCalendarItem, reminderOffset: ReminderOffset | null): Promise<void> {
    updateLocalPreviewState(fallback, (current) => {
      const { [proposal.id]: _previousReminder, ...reminderOffsets } = current.reminderOffsets;
      void _previousReminder;
      return {
        ...current,
        items: current.items.some((entry) => entry.display.id === proposal.id)
          ? current.items.map((entry) => entry.display.id === proposal.id ? toLocalView(proposal) : entry)
          : [...current.items, toLocalView(proposal)],
        reminderOffsets: reminderOffset === null ? reminderOffsets : { ...reminderOffsets, [proposal.id]: reminderOffset },
      };
    });
    return Promise.resolve();
  }

  async function toggleEventCountdown(item: ItemView, enabled: boolean) {
    const source = item.display.kind === 'event' && item.display.recurrence
      ? items.find((candidate) => candidate.display.id === item.display.id) ?? item
      : item;
    let next: ProposedCalendarItem;
    if (source.display.kind === 'event') {
      next = { ...source.display, countdown: { enabled, daysBefore: source.display.countdown?.daysBefore ?? 1, reference: source.display.countdown?.reference ?? 'start' } };
    } else if (source.display.kind === 'window') {
      next = { ...source.display, startCountdown: { ...source.display.startCountdown, enabled } };
    } else if (source.display.kind === 'deadline' && source.display.startCountdown) {
      next = { ...source.display, startCountdown: { ...source.display.startCountdown, enabled } };
    } else return;
    if (preview) {
      await saveLocal(next, reminderOffsets?.[item.display.id] ?? null);
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
      const result = await repository.saveDraft(createDraftInput(source, next));
    if (result.status === 'saved' || result.status === 'queued') return;
    throw new Error(result.status === 'conflict'
      ? '다른 기기에서 일정이 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.'
      : '다른 탭에서 일정이 수정되었습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.');
  }

  async function toggleCompletion(item: ItemView) {
    if (item.display.kind !== 'task' && item.display.kind !== 'deadline' && item.display.kind !== 'window') return;
    const next: ProposedCalendarItem = { ...item.display, completion: item.display.completion === 'completed' ? 'pending' : 'completed' };
    if (preview) { await saveLocal(next, reminderOffsets?.[item.display.id] ?? null); return; }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(item, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('완료 상태를 저장하지 못했습니다.');
  }

  async function toggleLinkedTaskCompletion(taskId: string, completed: boolean) {
    const task = items.find((candidate) => candidate.display.id === taskId && candidate.display.kind === 'task');
    if (!task || task.display.kind !== 'task') throw new Error('연결된 할 일을 찾을 수 없습니다. 연결을 해제한 뒤 다시 시도해 주세요.');
    const next: ProposedCalendarItem = { ...task.display, completion: completed ? 'completed' : 'pending' };
    if (preview) {
      updateLocalPreviewState(fallback, (current) => ({ ...current, items: current.items.map((entry) => entry.display.id === taskId ? toLocalView(next) : entry) }));
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(task, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('연결된 할 일을 저장하지 못했습니다.');
  }

  async function deleteItem(item: ItemView) {
    if (!window.confirm(`“${item.display.title}” 항목을 삭제할까요?`)) return;
    try {
      const source = item.display.kind === 'event' && item.display.recurrence
        ? items.find((candidate) => candidate.display.id === item.display.id) ?? item
        : item;
      if (preview) {
        const detachments = getTaskLinkDetachments(items, source.display.id);
        const detached = new Map(detachments.map((entry) => [entry.period.display.id, entry.proposal]));
        updateLocalPreviewState(fallback, (current) => ({
          ...current,
          items: current.items.filter((entry) => entry.display.id !== source.display.id).map((entry) => { const proposal = detached.get(entry.display.id); return proposal ? toLocalView(proposal) : entry; }),
          reminderOffsets: Object.fromEntries(Object.entries(current.reminderOffsets).filter(([id]) => id !== item.display.id)),
        }));
        setEditorOpen(false);
        setEditorItem(null);
        setDetailsItem(null);
        return;
      }
      if (!repository) return;
      const detachments = getTaskLinkDetachments(items, source.display.id);
      for (const detachment of detachments) {
        const detached = await repository.saveDraft(createDraftInput(detachment.period, detachment.proposal));
        if (detached.status !== 'saved' && detached.status !== 'queued') throw new Error('연결된 기간을 먼저 저장하지 못해 할 일을 삭제하지 않았습니다.');
      }
      const result = await repository.saveDraft(createDraftInput(source, source.display, 'delete'));
      if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') {
        setEditorOpen(false);
        setEditorItem(null);
        setDetailsItem(null);
      } else setActionError('다른 기기에서 수정되었습니다. 충돌을 확인한 뒤 다시 삭제해 주세요.');
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : '일정을 삭제하지 못했습니다.');
    }
  }

  return (
    <>
      <WeekCalendarView
        items={calendarItems}
        nowMs={nowMs}
        initialDate={routeDate ?? initialDate}
        view={view}
        weekStartsOn={preferences.weekStartsOn}
        timeFormat={preferences.timeFormat}
        timeZone={preferences.timeZone}
        onAddTask={addTask}
        onAddEvent={(date) => addOn(date)}
        onAdd={addOn}
        onOpen={openItem}
        onToggleTask={(item) => { void toggleCompletion(item).catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : '완료 상태를 저장하지 못했습니다.')); }}
        onViewChange={(nextView) => {
          updateRouteSearchParam('filter', nextView === 'periods' ? 'period' : null);
          updateRouteSearchParam('view', nextView === 'week' || nextView === 'periods' ? null : nextView);
        }}
      />
      {detailsItem && <CalendarItemDetailsDialog key={detailsItem.display.id} allItems={items} item={detailsItem} nowMs={nowMs} onClose={() => setDetailsItem(null)} onDelete={() => { void deleteItem(detailsItem); }} onComplete={() => { void toggleCompletion(detailsItem).catch((failure: unknown) => setActionError(failure instanceof Error ? failure.message : '완료 상태를 저장하지 못했습니다.')); }} onCalendar={() => { const timing = detailsItem.display.timing; const date = timing.type === 'date' ? timing.endDate : timing.type === 'time' ? getLocalDate(Date.parse(timing.startAt ?? timing.endAt ?? new Date(nowMs).toISOString()), timing.timeZone) : initialDate; updateRouteDate(date); updateRouteSearchParam('view', 'day'); setDetailsItem(null); }} onEdit={editDetailsItem} onToggleCountdown={toggleEventCountdown} />}
      {actionError && <p className={styles.feedback} role="alert">{actionError}</p>}
      {editorOpen && (
        <ItemEditor
          defaultKind={editorKind}
          defaultTimeZone={preferences.timeZone}
          defaultMode={editorKind === 'event' ? 'time' : 'date'}
          defaultStartTime={editorStartTime}
          initial={editorItem}
          returnFocusRef={editorReturnFocusRef}
          initialReminderOffset={editorItem ? reminderOffsets?.[editorItem.display.id] ?? null : null}
          selectedDate={editorDate}
          taskCategories={getTaskCategories(items)}
          availableTasks={items}
          onToggleLinkedTask={toggleLinkedTaskCompletion}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); setEditorItem(null); }}
          onConflict={() => setActionError('동기화 충돌이 있습니다. 양쪽 버전을 확인해 주세요.')}
          onLocalSave={preview ? saveLocal : undefined}
          onDelete={editorItem ? () => { void deleteItem(editorItem); } : undefined}
        />
      )}
    </>
  );
}

function CalendarLoading() {
  return <main aria-busy="true">캘린더를 불러오고 있습니다.</main>;
}
