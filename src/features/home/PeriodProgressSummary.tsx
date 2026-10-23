'use client';

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { selectUrgentHomeTimeline } from '../../domain/projections';
import { getPeriodPhase, getTimingBounds } from '../../domain/time';
import type { ItemView } from '../../domain/items';
import { PeriodCard } from './PeriodCard';
import { movePeriodId } from './period-sort';
import styles from './PeriodProgressSummary.module.css';

type PeriodProgressSummaryProps = {
  items: readonly ItemView[];
  nowMs: number;
  onOpen?: (item: ItemView) => void;
  onAddSchedule?: () => void;
  onViewAll?: () => void;
  orderIds?: readonly string[];
  onOrderChange?: (orderIds: string[]) => void;
};

export function PeriodProgressSummary({ items, nowMs, onAddSchedule, onViewAll, onOpen, orderIds = [], onOrderChange }: PeriodProgressSummaryProps) {
  const periods = orderPeriods(selectUrgentHomeTimeline(items, nowMs).filter((item) => getPeriodPhase(getTimingBounds(item.display.timing), nowMs) !== 'overdue'), orderIds);
  const primaryPeriods = periods.slice(0, 4);
  const periodIds = periods.map((item) => item.display.id);

  return (
    <section aria-label="임박한 일정" className={styles.summary}>
      <div className={styles.summaryHeader}>
        <h2>가까운 마감과 시작</h2>
        <div className={styles.headerActions}>
          {onViewAll && <button aria-label="전체 D-day 보기" className={styles.viewAll} onClick={onViewAll} type="button">전체 D-day 보기</button>}
        </div>
      </div>
      {periods.length > 0 ? (
        <>
          <div className={styles.cardGrid} data-testid="period-card-grid">
            {primaryPeriods.map((item) => <SortablePeriodCard allItems={items} home item={item} itemIds={periodIds} key={item.display.id} nowMs={nowMs} onOpen={onOpen} onOrderChange={onOrderChange} />)}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>기억할 일정이 없습니다.</p>
          {onAddSchedule && <button onClick={onAddSchedule} type="button">일정을 추가해보세요</button>}
        </div>
      )}
    </section>
  );
}

function SortablePeriodCard({ item, itemIds, nowMs, home = false, allItems, onOpen, onOrderChange }: {
  item: ItemView;
  itemIds: readonly string[];
  nowMs: number;
  allItems: readonly ItemView[];
  home?: boolean;
  onOpen?: (item: ItemView) => void;
  onOrderChange?: (orderIds: string[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const sourceId = useRef<string | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const moved = useRef(false);
  const suppressClick = useRef(false);

  function startHold(event: PointerEvent<HTMLDivElement>) {
    if (!onOrderChange || event.button !== 0) return;
    const row = event.currentTarget;
    const pointerId = event.pointerId;
    sourceId.current = item.display.id;
    origin.current = { x: event.clientX, y: event.clientY };
    held.current = false;
    moved.current = false;
    holdTimer.current = window.setTimeout(() => {
      try { row.setPointerCapture(pointerId); } catch { clearHold(); return; }
      held.current = true;
      setDragging(true);
    }, 320);
  }

  function moveHeld(event: PointerEvent<HTMLDivElement>) {
    if (!sourceId.current) return;
    if (!held.current) {
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) clearHold();
      return;
    }
    moved.current = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-period-card-id]');
    setDropTarget(Boolean(target && target.dataset.periodCardId !== item.display.id));
  }

  function endHold(event: PointerEvent<HTMLDivElement>) {
    const source = sourceId.current;
    const didHold = held.current;
    const target = didHold ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-period-card-id]') : null;
    const targetId = target?.dataset.periodCardId;
    if (source && targetId && source !== targetId && moved.current && target) {
      const bounds = target.getBoundingClientRect();
      const next = movePeriodId(itemIds, source, targetId, event.clientY > bounds.top + bounds.height / 2);
      if (next !== itemIds) onOrderChange?.([...next]);
    }
    suppressClick.current = didHold;
    clearHold();
    setDragging(false);
    setDropTarget(false);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOrderChange || event.target !== event.currentTarget) return;
    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const index = itemIds.indexOf(item.display.id);
    const targetId = itemIds[index + delta];
    if (!delta || !targetId) return;
    event.preventDefault();
    const next = movePeriodId(itemIds, item.display.id, targetId, delta > 0);
    if (next !== itemIds) onOrderChange([...next]);
  }

  function clearHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    sourceId.current = null;
    held.current = false;
  }

  function suppressPostDragClick(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  }

  return (
    <div aria-keyshortcuts={onOrderChange ? 'ArrowUp ArrowDown' : undefined} aria-label={`${item.display.title}${onOrderChange ? ', 길게 눌러 이동하거나 위아래 화살표로 순서 변경' : ''}`} className={styles.sortableCard} data-dragging={dragging} data-drop-target={dropTarget} data-period-card-id={item.display.id} onClickCapture={suppressPostDragClick} onKeyDown={moveWithKeyboard} onPointerCancel={() => { clearHold(); setDragging(false); setDropTarget(false); }} onPointerDown={startHold} onPointerMove={moveHeld} onPointerUp={endHold} role="group" tabIndex={onOrderChange ? 0 : undefined}>
      <PeriodCard allItems={allItems} home={home} item={item} nowMs={nowMs} onOpen={onOpen} />
    </div>
  );
}

function orderPeriods(periods: readonly ItemView[], orderIds: readonly string[]): ItemView[] {
  if (orderIds.length === 0) return [...periods];
  const rank = new Map(orderIds.map((id, index) => [id, index]));
  return [...periods].sort((a, b) => (rank.get(a.display.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.display.id) ?? Number.MAX_SAFE_INTEGER));
}
