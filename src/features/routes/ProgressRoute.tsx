'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import { deriveChecklistStatus, isItemDeleted, resolvePeriodChecklist } from '../../domain/projections';
import { getDeadlineCountdown, getElapsedRatio, getPeriodPhase, getStartCountdown, getTimingBounds } from '../../domain/time';
import { getLocalDate } from '../../domain/time';
import { getTaskCategories } from '../../domain/task-categories';
import { useItems, useRepository } from '../../lib/repository-context';
import { useForegroundClock } from '../shell/useForegroundClock';
import { AppShell } from '../shell/AppShell';
import { createLocalPreviewFixture } from '../home/preview-data';
import { useLocalPreviewState, updateLocalPreviewState, toLocalView } from '../../lib/local-preview-store';
import { useDesktopPreferences } from '../../lib/desktop-preferences';
import { CalendarItemDetailsDialog } from '../calendar/CalendarItemDetailsDialog';
import { ItemEditor } from '../items/ItemEditor';
import { createDraftInput } from '../items/draft-input';
import { getTaskLinkDetachments } from '../items/task-link-mutations';
import { Icon } from '../ui/Icon';
import styles from './ProgressRoute.module.css';

type PeriodFilter = 'all' | 'deadline' | 'start' | 'window' | 'completed';
type PeriodSort = 'ending' | 'starting' | 'title' | 'recent';

export function ProgressRoute({ initialNowMs }: { initialNowMs: number }) {
  const serverItems = useItems();
  const nowMs = useForegroundClock(initialNowMs);
  const today = getLocalDate(nowMs, 'Asia/Seoul');
  const fallback = useMemo(() => createLocalPreviewFixture(today).items, [today]);
  const localState = useLocalPreviewState(fallback);
  const signedIn = <ProgressWorkspace items={serverItems} fallback={fallback} nowMs={nowMs} today={today} preview={false} />;
  const preview = <ProgressWorkspace items={localState.items} fallback={fallback} nowMs={nowMs} today={today} preview />;
  return <AppShell previewItems={fallback} previewContent={preview} todayDate={today}>{signedIn}</AppShell>;
}

function ProgressWorkspace({ items, fallback, nowMs, today, preview }: { items: readonly ItemView[]; fallback: readonly ItemView[]; nowMs: number; today: string; preview: boolean }) {
  const repository = useRepository();
  const router = useRouter();
  const preferences = useDesktopPreferences();
  const [filter, setFilter] = useState<PeriodFilter>('all');
  const [sort, setSort] = useState<PeriodSort>('ending');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKind, setEditorKind] = useState<'deadline' | 'window'>('deadline');
  const [editorItem, setEditorItem] = useState<ItemView | null>(null);
  const [detailsItem, setDetailsItem] = useState<ItemView | null>(null);
  const [error, setError] = useState('');
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const periods = items.filter((item) => !isItemDeleted(item) && (item.display.kind === 'deadline' || item.display.kind === 'window'));
  const visible = periods.filter((item) => {
    if (item.display.kind !== 'deadline' && item.display.kind !== 'window') return false;
    const checklist = deriveChecklistStatus(resolvePeriodChecklist(item.display.checklist, items));
    const isComplete = item.display.completion === 'completed' || checklist.kind === 'complete';
    if (filter === 'completed') return isComplete;
    if (filter !== 'all' && isComplete) return false;
    if (item.display.kind === 'window') return filter === 'all' || filter === 'window';
    if (filter === 'deadline') return item.display.focus === 'deadline' || item.display.focus === undefined;
    if (filter === 'start') return item.display.focus === 'start';
    return filter === 'all';
  }).sort((a, b) => comparePeriod(a, b, sort));

  function addPeriod(kind: 'deadline' | 'window') { setEditorKind(kind); setEditorItem(null); setEditorOpen(true); }
  function edit(item: ItemView) { setDetailsItem(null); setEditorItem(item); setEditorOpen(true); }
  function open(item: ItemView) { returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDetailsItem(item); }

  async function saveCompletion(item: ItemView) {
    if (item.display.kind !== 'deadline' && item.display.kind !== 'window') return;
    const next: ProposedCalendarItem = { ...item.display, completion: item.display.completion === 'completed' ? 'pending' : 'completed' };
    if (preview) {
      updateLocalPreviewState(fallback, (current) => ({ ...current, items: current.items.map((entry) => entry.display.id === item.display.id ? toLocalView(next) : entry) }));
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(item, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('다른 기기에서 내용이 바뀌었습니다. 새로 고친 뒤 다시 시도해 주세요.');
  }

  async function deleteItem(item: ItemView) {
    if (!window.confirm('“' + item.display.title + '” 항목을 삭제할까요?')) return;
    try {
      if (preview) {
        const detachments = getTaskLinkDetachments(items, item.display.id);
        const detached = new Map(detachments.map((entry) => [entry.period.display.id, entry.proposal]));
        updateLocalPreviewState(fallback, (current) => ({ ...current, items: current.items.filter((entry) => entry.display.id !== item.display.id).map((entry) => { const proposal = detached.get(entry.display.id); return proposal ? toLocalView(proposal) : entry; }) }));
      } else if (repository) {
        const detachments = getTaskLinkDetachments(items, item.display.id);
        for (const detachment of detachments) {
          const detached = await repository.saveDraft(createDraftInput(detachment.period, detachment.proposal));
          if (detached.status !== 'saved' && detached.status !== 'queued') throw new Error('연결된 기간을 먼저 저장하지 못해 할 일을 삭제하지 않았습니다.');
        }
        const result = await repository.saveDraft(createDraftInput(item, item.display, 'delete'));
        if (result.status !== 'saved' && result.status !== 'queued' && result.status !== 'cancelled') throw new Error('동기화 상태를 확인한 뒤 다시 삭제해 주세요.');
      }
      setEditorOpen(false); setEditorItem(null); setDetailsItem(null); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : '삭제하지 못했습니다.'); }
  }

  async function toggleCountdown(item: ItemView, enabled: boolean) {
    if ((item.display.kind !== 'deadline' && item.display.kind !== 'window') || !item.display.startCountdown) return;
    const next: ProposedCalendarItem = { ...item.display, startCountdown: { ...item.display.startCountdown, enabled } };
    if (preview) {
      updateLocalPreviewState(fallback, (current) => ({ ...current, items: current.items.map((entry) => entry.display.id === item.display.id ? toLocalView(next) : entry) }));
      return;
    }
    if (!repository) throw new Error('저장소에 연결할 수 없습니다.');
    const result = await repository.saveDraft(createDraftInput(item, next));
    if (result.status !== 'saved' && result.status !== 'queued') throw new Error('설정을 저장하지 못했습니다.');
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>DATES THAT MATTER</span><h1>Progress</h1><p>마감과 진행 기간을 한눈에 확인하세요.</p></div>
        <div className={styles.addActions}>
          <button onClick={() => addPeriod('deadline')} type="button"><Icon name="plus" size={15} />마감 추가</button>
          <button onClick={() => addPeriod('window')} type="button"><Icon name="plus" size={15} />기간 추가</button>
        </div>
      </header>
      <div className={styles.toolbar}>
        <div aria-label="Progress 필터" className={styles.filters} role="group">
          {([['all', '전체'], ['deadline', '마감'], ['start', '시작 대기'], ['window', '진행 기간'], ['completed', '완료']] as const).map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? styles.activeFilter : ''} key={value} onClick={() => setFilter(value)} type="button">{label}</button>)}
        </div>
        <label className={styles.sort}>정렬 <select aria-label="Progress 정렬" onChange={(event) => setSort(event.currentTarget.value as PeriodSort)} value={sort}><option value="ending">가까운 날짜순</option><option value="starting">시작일 순</option><option value="title">이름 순</option><option value="recent">최근 추가순</option></select></label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {visible.length ? <div className={styles.grid}>{visible.map((item) => <ProgressCard allItems={items} item={item} key={item.display.id} nowMs={nowMs} onComplete={() => { void saveCompletion(item).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : '완료 상태를 저장하지 못했습니다.')); }} onDelete={() => { void deleteItem(item); }} onOpen={() => open(item)} onViewCalendar={() => router.push((preview ? '/calendar?preview=design&' : '/calendar?') + 'date=' + encodeURIComponent(periodDate(item)))} />)}</div> : <div className={styles.empty}><strong>표시할 일정이 없습니다</strong><span>마감이나 진행 기간을 추가해 보세요.</span><button onClick={() => addPeriod('deadline')} type="button">마감 추가</button></div>}
      {detailsItem && <CalendarItemDetailsDialog allItems={items} item={detailsItem} nowMs={nowMs} onClose={() => setDetailsItem(null)} onDelete={() => { void deleteItem(detailsItem); }} onComplete={() => { void saveCompletion(detailsItem).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : '완료 상태를 저장하지 못했습니다.')); }} onCalendar={() => { router.push((preview ? '/calendar?preview=design&' : '/calendar?') + 'date=' + encodeURIComponent(periodDate(detailsItem))); setDetailsItem(null); }} onEdit={() => edit(detailsItem)} onToggleCountdown={toggleCountdown} />}
      {editorOpen && <ItemEditor defaultKind={editorKind} defaultMode="date" defaultStartDate={today} defaultTimeZone={preferences.timeZone} initial={editorItem} returnFocusRef={returnFocusRef} selectedDate={today} taskCategories={getTaskCategories(items)} availableTasks={items} onToggleLinkedTask={toggleLinkedTaskCompletion} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setEditorItem(null); }} onConflict={() => setError('동기화 충돌을 해결한 뒤 다시 저장해 주세요.')} onDelete={editorItem ? () => { void deleteItem(editorItem); } : undefined} onLocalSave={preview ? async (proposal) => { updateLocalPreviewState(fallback, (current) => ({ ...current, items: current.items.some((entry) => entry.display.id === proposal.id) ? current.items.map((entry) => entry.display.id === proposal.id ? toLocalView(proposal) : entry) : [...current.items, toLocalView(proposal)] })); } : undefined} />}
    </main>
  );
}

function ProgressCard({ item, allItems, nowMs, onOpen, onComplete, onDelete, onViewCalendar }: { item: ItemView; allItems: readonly ItemView[]; nowMs: number; onOpen: () => void; onComplete: () => void; onDelete: () => void; onViewCalendar: () => void }) {
  const display = item.display;
  if (display.kind !== 'deadline' && display.kind !== 'window') return null;
  const bounds = getTimingBounds(display.timing);
  const phase = getPeriodPhase(bounds, nowMs);
  const countdown = display.kind === 'deadline' && display.focus === 'deadline' ? getDeadlineCountdown(display, nowMs) : getStartCountdown(display, nowMs);
  const elapsed = bounds.startMs !== null && bounds.endExclusiveMs !== null && bounds.endExclusiveMs > bounds.startMs && phase === 'active' ? getElapsedRatio(bounds, nowMs) : null;
  const checklist = deriveChecklistStatus(resolvePeriodChecklist(display.checklist, allItems));
  const done = display.completion === 'completed' || checklist.kind === 'complete';
  const cardType = display.kind === 'window' ? '진행 기간' : display.focus === 'start' ? '시작 대기' : '마감 목표';
  return (
    <article className={styles.card} data-phase={phase}>
      <div className={styles.cardTop}><span className={styles.type}>{display.category ? `${display.category}　/　` : ''}{cardType}</span><span className={styles.countdown}>{countdown.kind === 'hidden' ? phaseLabel(phase) : countdown.text}</span></div>
      <button className={styles.cardTitle} onClick={onOpen} type="button">{display.title}</button>
      <div className={styles.dateLine}><span>{periodDateLabel(display, 'start')}</span><span aria-hidden="true">→</span><span>{periodDateLabel(display, 'end')}</span></div>
      {elapsed !== null && <div className={styles.metric}><div><span>기간 경과</span><b>{Math.round(elapsed * 100)}%</b></div><span aria-label="기간 경과" className={styles.track}><i style={{ width: Math.round(elapsed * 100) + '%' }} /></span></div>}
      {checklist.kind !== 'none' && <div className={styles.metric}><div><span>연결된 할 일</span><b>{checklist.total - checklist.remaining}/{checklist.total}</b></div><span aria-label="할 일 완료율" className={styles.track + ' ' + styles.taskTrack}><i style={{ width: Math.round((checklist.total - checklist.remaining) / checklist.total * 100) + '%' }} /></span></div>}
      <div className={styles.cardActions}>
        <button onClick={onViewCalendar} type="button">캘린더에서 보기</button>
        <button aria-label={done ? '완료 취소' : '완료 처리'} aria-pressed={done} onClick={onComplete} type="button">{done ? '완료됨' : '완료'}</button>
        <button aria-label={display.title + ' 수정'} onClick={onOpen} type="button">상세</button>
        <button aria-label={display.title + ' 삭제'} onClick={onDelete} type="button">삭제</button>
      </div>
    </article>
  );
}

function periodDate(item: ItemView): string { const timing = item.display.timing; return timing.type === 'date' ? timing.startDate ?? timing.endDate : timing.type === 'time' ? getLocalDate(Date.parse(timing.startAt ?? timing.endAt ?? new Date().toISOString()), timing.timeZone) : getLocalDate(Date.now(), 'Asia/Seoul'); }
function periodDateLabel(item: Extract<ProposedCalendarItem, { kind: 'deadline' | 'window' }>, edge: 'start' | 'end'): string { const timing = item.timing; const date = timing.type === 'date' ? edge === 'start' ? timing.startDate : timing.endDate : timing.type === 'time' ? edge === 'start' ? timing.startAt : timing.endAt : null; if (!date) return edge === 'start' ? '시작일 미정' : '종료일 미정'; const instant = timing.type === 'time'; return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', ...(instant ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const, timeZone: timing.timeZone } : { timeZone: 'UTC' }) }).format(new Date(instant ? date : date + 'T12:00:00Z')); }
function phaseLabel(phase: 'scheduled' | 'active' | 'overdue'): string { return phase === 'scheduled' ? '예정' : phase === 'active' ? '진행 중' : '종료'; }
function comparePeriod(a: ItemView, b: ItemView, sort: PeriodSort): number { if (sort === 'title') return a.display.title.localeCompare(b.display.title, 'ko-KR'); if (sort === 'recent') return Date.parse(b.localDraft?.updatedAt ?? b.canonical?.updatedAt ?? '') - Date.parse(a.localDraft?.updatedAt ?? a.canonical?.updatedAt ?? '') || b.display.id.localeCompare(a.display.id); const left = getTimingBounds(a.display.timing); const right = getTimingBounds(b.display.timing); const first = sort === 'ending' ? left.endExclusiveMs ?? left.startMs ?? 0 : left.startMs ?? left.endExclusiveMs ?? 0; const second = sort === 'ending' ? right.endExclusiveMs ?? right.startMs ?? 0 : right.startMs ?? right.endExclusiveMs ?? 0; return first - second || a.display.title.localeCompare(b.display.title, 'ko-KR'); }
