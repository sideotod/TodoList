'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { deriveChecklistStatus, resolvePeriodChecklist, selectPeriodGroups, selectUrgentHomeTimeline } from '../../domain/projections';
import { movePeriodId, selectCompletedPeriods } from './period-sort';
import { PeriodCard } from './PeriodCard';
import { Icon } from '../ui/Icon';
import styles from './PeriodSortDialog.module.css';

type PeriodSortDialogProps = {
  items: readonly ItemView[];
  nowMs: number;
  orderIds: readonly string[];
  initialView?: 'sort' | 'all';
  onClose: () => void;
  onSave: (orderIds: string[]) => void;
};

export function PeriodSortDialog({ items, nowMs, orderIds, initialView = 'sort', onClose, onSave }: PeriodSortDialogProps) {
  const initialFocus = useRef<HTMLButtonElement>(null);
  const completedToggleRef = useRef<HTMLButtonElement>(null);
  const completedCloseRef = useRef<HTMLButtonElement>(null);
  const completedPaneWasOpen = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);
  const previousPositions = useRef<Map<string, number> | null>(null);
  const groups = selectPeriodGroups(items, nowMs);
  const completedOrEndedIds = new Set([...groups.completed, ...groups.overdue].map((item) => item.display.id));
  const upcomingTimeline = selectUrgentHomeTimeline(items, nowMs).filter((item) => !completedOrEndedIds.has(item.display.id));
  // Checklist-complete periods belong in the completed pane, never in both columns.
  const completedChecklistPeriods = upcomingTimeline.filter((item) => isChecklistCompletePeriod(item, items));
  const allUpcoming = upcomingTimeline.filter((item) => !isChecklistCompletePeriod(item, items));
  const periods = allUpcoming;
  const rank = new Map(orderIds.map((id, index) => [id, index]));
  const defaultIds = [...periods].sort((a, b) => (rank.get(a.display.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.display.id) ?? Number.MAX_SAFE_INTEGER));
  const [ids, setIds] = useState(() => defaultIds.map((item) => item.display.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [allPeriodsOpen, setAllPeriodsOpen] = useState(initialView === 'all');
  const holdTimer = useRef<number | null>(null);
  const dragStarted = useRef(false);
  const pointerItemId = useRef<string | null>(null);
  const pointerOrigin = useRef({ x: 0, y: 0 });
  const pointerY = useRef(0);
  const grabOffsetY = useRef(0);
  const dragOffsetRef = useRef(0);
  const flipFrame = useRef<number | null>(null);
  const movedAfterHold = useRef(false);
  const byId = new Map(periods.map((item) => [item.display.id, item]));
  const completedPeriods = mergeItems(
    selectCompletedPeriods(items, nowMs),
    completedChecklistPeriods,
  );

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocus.current?.focus();
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      if (flipFrame.current !== null) window.cancelAnimationFrame(flipFrame.current);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (allPeriodsOpen) {
      completedCloseRef.current?.focus();
    } else if (completedPaneWasOpen.current) {
      completedToggleRef.current?.focus();
    }
    completedPaneWasOpen.current = allPeriodsOpen;
  }, [allPeriodsOpen]);

  useLayoutEffect(() => {
    const before = previousPositions.current;
    const list = listRef.current;
    if (!before || !list) return;
    previousPositions.current = null;

    const rows = [...list.querySelectorAll<HTMLElement>('[data-period-id]')];
    for (const row of rows) {
      const id = row.dataset.periodId;
      if (!id) continue;
      if (id === draggingId) {
        const layoutTop = row.getBoundingClientRect().top - dragOffsetRef.current;
        const nextOffset = pointerY.current - grabOffsetY.current - layoutTop;
        dragOffsetRef.current = nextOffset;
        setDragOffset(nextOffset);
        continue;
      }
      const priorTop = before.get(id);
      if (priorTop === undefined) continue;
      const delta = priorTop - row.getBoundingClientRect().top;
      if (delta !== 0) row.style.setProperty('--flip-offset-y', `${delta}px`);
    }
    void list.offsetHeight;
    flipFrame.current = window.requestAnimationFrame(() => {
      for (const row of rows) row.style.setProperty('--flip-offset-y', '0px');
    });
  }, [ids, draggingId]);

  function startHold(event: PointerEvent<HTMLLIElement>, id: string) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerItemId.current = id;
    dragStarted.current = false;
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    pointerY.current = event.clientY;
    grabOffsetY.current = event.clientY - event.currentTarget.getBoundingClientRect().top;
    movedAfterHold.current = false;
    holdTimer.current = window.setTimeout(() => {
      dragStarted.current = true;
      setDraggingId(id);
    }, 320);
  }

  function moveHeldItem(event: PointerEvent<HTMLLIElement>) {
    const id = pointerItemId.current;
    if (!id) return;
    if (!dragStarted.current) {
      if (Math.hypot(event.clientX - pointerOrigin.current.x, event.clientY - pointerOrigin.current.y) <= 8) return;
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
      dragStarted.current = true;
      setDraggingId(id);
    }
    movedAfterHold.current = true;
    pointerY.current = event.clientY;
    const currentRow = listRef.current?.querySelector<HTMLElement>(`[data-period-id="${CSS.escape(id)}"]`);
    const layoutTop = currentRow ? currentRow.getBoundingClientRect().top - dragOffsetRef.current : pointerOrigin.current.y;
    const nextOffset = event.clientY - grabOffsetY.current - layoutTop;
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
    const target = findTargetAtPoint(event.clientX, event.clientY, id);
    setDragTargetId(target?.dataset.periodId ?? null);
    if (target?.dataset.periodId) moveToTarget(id, target, event.clientY);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLLIElement>, id: string) {
    const movement = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (movement === 0) return;
    const index = ids.indexOf(id);
    const target = ids[index + movement];
    if (!target) return;
    event.preventDefault();
    moveToTarget(id, document.querySelector<HTMLElement>(`[data-period-id="${CSS.escape(target)}"]`), movement < 0 ? 0 : Number.MAX_SAFE_INTEGER);
  }

  function endHold(event: PointerEvent<HTMLLIElement>) {
    const sourceId = pointerItemId.current;
    const didDrag = dragStarted.current && movedAfterHold.current;
    const target = didDrag && sourceId ? findTargetAtPoint(event.clientX, event.clientY, sourceId) : null;
    const targetId = target?.dataset.periodId;
    if (sourceId && targetId && sourceId !== targetId) moveToTarget(sourceId, target, event.clientY);
    clearHold();
    setDraggingId(null);
    setDragTargetId(null);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }

  function clearHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointerItemId.current = null;
    dragStarted.current = false;
  }

  function cancelHold() {
    clearHold();
    setDraggingId(null);
    setDragTargetId(null);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  }

  function moveToTarget(sourceId: string, target: HTMLElement | null, pointerPosition: number) {
    const targetId = target?.dataset.periodId;
    if (!target || !targetId || sourceId === targetId) return;
    const bounds = target.getBoundingClientRect();
    const afterTarget = pointerPosition > bounds.top + bounds.height / 2;
    const next = movePeriodId(ids, sourceId, targetId, afterTarget);
    if (next === ids) return;
    if (!previousPositions.current) {
      previousPositions.current = new Map([...listRef.current?.querySelectorAll<HTMLElement>('[data-period-id]') ?? []]
        .flatMap((row) => row.dataset.periodId ? [[row.dataset.periodId, row.getBoundingClientRect().top] as const] : []));
    }
    setIds([...next]);
  }

  function findTargetAtPoint(x: number, y: number, excludeId: string) {
    return [...document.querySelectorAll<HTMLElement>('[data-period-id]')].find((row) => {
      if (row.dataset.periodId === excludeId) return false;
      const bounds = row.getBoundingClientRect();
      return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    }) ?? null;
  }

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)')];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={styles.overlay} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-describedby={allPeriodsOpen ? 'period-all-description' : 'period-sort-description'} aria-labelledby="period-sort-title" aria-modal="true" className={styles.dialog} data-view={allPeriodsOpen ? 'all' : 'sort'} onKeyDown={trapFocus} role="dialog">
        <header className={styles.header}>
          <h2 id="period-sort-title">{allPeriodsOpen ? '전체 D-day' : '디데이 정렬'}</h2>
          {!allPeriodsOpen && <span className={styles.badge}>상단 3개 표시</span>}
          {!allPeriodsOpen && <button aria-label="전체 D-day 보기" className={styles.completedToggle} onClick={() => setAllPeriodsOpen(true)} ref={completedToggleRef} type="button">전체 D-day <Icon name="chevron-right" size={14} /></button>}
          {allPeriodsOpen && <button aria-label="순서 편집" className={styles.allPeriodsClose} onClick={() => setAllPeriodsOpen(false)} ref={completedCloseRef} type="button">순서 편집</button>}
        </header>
        <div className={styles.body} data-view={allPeriodsOpen ? 'all' : 'sort'}>
          <div className={styles.activePane} data-testid="active-periods-pane">
            {allPeriodsOpen ? (
              <>
                <p className={styles.visuallyHidden} id="period-all-description">예정 및 진행 중인 D-day와 완료되었거나 종료된 항목을 확인합니다.</p>
                <h3 className={styles.paneTitle}>예정 및 진행 중</h3>
                {allUpcoming.length > 0 ? (
                  <ol className={styles.allPeriodsList} data-testid="active-periods-list">
                    {allUpcoming.map((item) => <li key={item.display.id}><PeriodCard allItems={items} item={item} nowMs={nowMs} /></li>)}
                  </ol>
                ) : <p className={styles.empty}>예정되거나 진행 중인 D-day가 없습니다.</p>}
              </>
            ) : (
              <>
                <p className={styles.description} id="period-sort-description">끌어서 순서를 바꾸세요.</p>
                {ids.length > 0 ? (
              <ol className={styles.list} ref={listRef}>
                {ids.map((id, index) => {
                  const item = byId.get(id);
                  if (!item) return null;
                  return (
                    <li
                      aria-label={`${item.display.title}, ${index + 1}번째`}
                      className={`${draggingId === id ? styles.dragging : ''} ${dragTargetId === id && draggingId !== id ? styles.dropTarget : ''}`}
                      data-period-id={id}
                      key={id}
                      onKeyDown={(event) => moveWithKeyboard(event, id)}
                      onPointerCancel={cancelHold}
                      onPointerDown={(event) => startHold(event, id)}
                      onPointerMove={moveHeldItem}
                      onPointerUp={endHold}
                      tabIndex={0}
                      style={draggingId === id ? { '--drag-offset-y': `${dragOffset}px` } as CSSProperties : undefined}
                    >
                      <PeriodCard allItems={items} item={item} nowMs={nowMs} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className={styles.empty}>정렬할 일정이 없습니다. 새 일정이나 기간 일정을 추가하면 여기서 순서를 바꿀 수 있어요.</p>
            )}
              </>
            )}
          </div>
          <aside aria-hidden={!allPeriodsOpen} aria-label="완료 및 종료" className={styles.allPeriodsPane} data-open={allPeriodsOpen} inert={!allPeriodsOpen}>
            <h3 className={styles.paneTitle}>완료 및 종료</h3>
            {completedPeriods.length > 0 ? (
              <ol className={styles.allPeriodsList} data-testid="all-periods-list">
                {completedPeriods.map((item) => <li key={item.display.id}><PeriodCard allItems={items} item={item} nowMs={nowMs} /></li>)}
              </ol>
            ) : <p className={styles.empty}>완료된 일정이 없습니다.</p>}
          </aside>
        </div>
        <footer className={styles.footer}>
          {allPeriodsOpen
            ? <button className={styles.cancel} onClick={onClose} ref={initialFocus} type="button">닫기</button>
            : <>
              <button className={styles.cancel} onClick={onClose} ref={initialFocus} type="button">취소</button>
              <button className={styles.save} onClick={() => onSave(ids)} type="button">저장</button>
            </>}
        </footer>
      </section>
    </div>
  );
}

function mergeItems(...groups: readonly ItemView[][]): ItemView[] {
  const byId = new Map<string, ItemView>();
  for (const item of groups.flat()) byId.set(item.display.id, item);
  return [...byId.values()];
}

function isChecklistCompletePeriod(item: ItemView, items: readonly ItemView[]): boolean {
  return (item.display.kind === 'deadline' || item.display.kind === 'window')
    && deriveChecklistStatus(resolvePeriodChecklist(item.display.checklist, items)).kind === 'complete';
}
