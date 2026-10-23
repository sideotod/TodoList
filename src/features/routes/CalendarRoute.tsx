'use client';

import { Suspense, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import { getTaskCategories } from '../../domain/task-categories';
import { getLocalDate } from '../../domain/time';
import { useRepository, useItems } from '../../lib/repository-context';
import { parseRouteDate, updateRouteSearchParam } from '../../lib/route-date';
import { useForegroundClock } from '../shell/useForegroundClock';
import { AppShell } from '../shell/AppShell';
import { createLocalPreviewFixture } from '../home/preview-data';
import { WeekCalendarView } from '../calendar/WeekCalendarView';
import { CalendarItemDetailsDialog } from '../calendar/CalendarItemDetailsDialog';
import { ItemEditor } from '../items/ItemEditor';
import { createDraftInput } from '../items/draft-input';
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

  return <AppShell previewItems={fallback} previewContent={previewCalendar}>{signedInCalendar}</AppShell>;
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
  const searchParams = useSearchParams();
  const routeDate = parseRouteDate(searchParams.get('date'));
  const showingPeriods = searchParams.get('filter') === 'period';
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
    setEditorItem(item);
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
    let next: ProposedCalendarItem;
    if (item.display.kind === 'event') {
      next = { ...item.display, countdown: { enabled, daysBefore: item.display.countdown?.daysBefore ?? 1, reference: item.display.countdown?.reference ?? 'start' } };
    } else if (item.display.kind === 'window') {
      next = { ...item.display, startCountdown: { ...item.display.startCountdown, enabled } };
    } else if (item.display.kind === 'deadline' && item.display.startCountdown) {
      next = { ...item.display, startCountdown: { ...item.display.startCountdown, enabled } };
    } else return;
    if (preview) {
      await saveLocal(next, reminderOffsets?.[item.display.id] ?? null);
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(item, next));
    if (result.status === 'saved' || result.status === 'queued') return;
    throw new Error(result.status === 'conflict'
      ? '다른 기기에서 일정이 바뀌었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.'
      : '다른 탭에서 일정이 수정되었습니다. 최신 내용을 불러온 뒤 다시 시도해 주세요.');
  }

  async function deleteItem(item: ItemView) {
    if (!window.confirm(`“${item.display.title}” 항목을 삭제할까요?`)) return;
    try {
      if (preview) {
        updateLocalPreviewState(fallback, (current) => ({
          ...current,
          items: current.items.filter((entry) => entry.display.id !== item.display.id),
          reminderOffsets: Object.fromEntries(Object.entries(current.reminderOffsets).filter(([id]) => id !== item.display.id)),
        }));
        setEditorOpen(false);
        setEditorItem(null);
        return;
      }
      if (!repository) return;
      const result = await repository.saveDraft(createDraftInput(item, item.display, 'delete'));
      if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') {
        setEditorOpen(false);
        setEditorItem(null);
      } else setActionError('다른 기기에서 수정되었습니다. 충돌을 확인한 뒤 다시 삭제해 주세요.');
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : '일정을 삭제하지 못했습니다.');
    }
  }

  return (
    <>
      <WeekCalendarView
        items={items}
        nowMs={nowMs}
        initialDate={routeDate ?? initialDate}
        showingPeriods={showingPeriods}
        weekStartsOn={preferences.weekStartsOn}
        timeFormat={preferences.timeFormat}
        timeZone={preferences.timeZone}
        onAddTask={addTask}
        onAddEvent={(date) => addOn(date)}
        onAdd={addOn}
        onOpen={openItem}
        onViewChange={(view) => updateRouteSearchParam('filter', view === 'periods' ? 'period' : null)}
      />
      {detailsItem && <CalendarItemDetailsDialog key={detailsItem.display.id} item={detailsItem} nowMs={nowMs} onClose={() => setDetailsItem(null)} onEdit={editDetailsItem} onToggleCountdown={toggleEventCountdown} />}
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
