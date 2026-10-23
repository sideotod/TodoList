'use client';

import { useRef, useState } from 'react';
import type { DragEvent, FormEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { DEFAULT_TASK_CATEGORY, getStableItemColor, getTaskCategoryColor, type TaskCategory } from '../../domain/task-categories';
import { selectCalendarAgenda } from '../../domain/projections';
import { getLocalDate } from '../../domain/time';
import { formatCalendarHeading } from '../calendar/calendar-dates';
import { orderDailyTasks, type TaskOrder } from './task-order';
import { TaskRow } from './TaskRow';
import { Icon } from '../ui/Icon';
import styles from './SelectedDayTasks.module.css';

type SelectedDayTasksProps = {
  items: readonly ItemView[];
  categories?: readonly TaskCategory[];
  date: string;
  taskOrder: TaskOrder;
  onAdd?: () => void;
  onToggle?: (item: ItemView) => void;
  onOpen?: (item: ItemView) => void;
  onReorder?: (sourceId: string, targetId: string, afterTarget: boolean) => void;
  categoryOrder?: readonly string[];
  onReorderCategories?: (sourceName: string, targetName: string, afterTarget: boolean) => void;
  readOnly?: boolean;
  displayMode?: 'all' | 'tasks' | 'agenda';
  heading?: string;
  onQuickAdd?: (title: string) => Promise<boolean>;
  autoOpenQuickAdd?: boolean;
  onQuickAddDismiss?: () => void;
  onAddEvent?: () => void;
};

export function SelectedDayTasks({ items, categories = [], date, taskOrder, onAdd, onToggle, onOpen, onReorder, categoryOrder = [], onReorderCategories, readOnly = false, displayMode = 'all', heading, onQuickAdd, autoOpenQuickAdd = false, onQuickAddDismiss, onAddEvent }: SelectedDayTasksProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const holdTimer = useRef<number | null>(null);
  const pointerSource = useRef<string | null>(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const pointerDragging = useRef(false);
  const suppressClick = useRef(false);
  const categoryHoldTimer = useRef<number | null>(null);
  const categorySource = useRef<string | null>(null);
  const categoryOrigin = useRef({ x: 0, y: 0 });
  const categoryDraggingRef = useRef(false);
  const [categoryDragging, setCategoryDragging] = useState<string | null>(null);
  const [categoryDropTarget, setCategoryDropTarget] = useState<string | null>(null);
  const [quickAddOverride, setQuickAddOverride] = useState<boolean | null>(null);
  const quickAddOpen = quickAddOverride ?? autoOpenQuickAdd;
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const tasks = displayMode === 'agenda' ? [] : orderDailyTasks(items, date, taskOrder);
  // C4: deadlines/windows are already in D-day; keep the secondary agenda limited to events.
  const schedules = displayMode === 'tasks' ? [] : selectCalendarAgenda(items, date, 'Asia/Seoul').filter((item) => item.display.kind === 'event');
  const pending = tasks.filter((item) => item.display.kind === 'task' && item.display.completion === 'pending');
  const completed = tasks.filter((item) => item.display.kind === 'task' && item.display.completion === 'completed');
  const disabled = readOnly || (!onAdd && !onQuickAdd);
  const canReorder = !readOnly && Boolean(onReorder);
  const canReorderCategories = !readOnly && Boolean(onReorderCategories);
  const orderedCategories = orderCategories(categories, categoryOrder);

  async function submitQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickAddTitle.trim();
    if (!title || !onQuickAdd || quickAddSaving) return;
    setQuickAddSaving(true);
    setQuickAddError('');
    try {
      const saved = await onQuickAdd(title);
      if (saved) { setQuickAddTitle(''); setQuickAddOverride(false); onQuickAddDismiss?.(); }
      else setQuickAddError('할 일을 저장하지 못했습니다.');
    } catch (failure) {
      setQuickAddError(failure instanceof Error ? failure.message : '할 일을 저장하지 못했습니다.');
    } finally { setQuickAddSaving(false); }
  }

  function beginDrag(event: DragEvent<HTMLLIElement>, itemId: string) {
    if (!canReorder) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggingId(itemId);
  }

  function dropOnTask(event: DragEvent<HTMLLIElement>, itemId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    const bounds = event.currentTarget.getBoundingClientRect();
    onReorder?.(sourceId, itemId, event.clientY > bounds.top + bounds.height / 2);
    setDraggingId(null);
    setDragOverId(null);
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLLIElement>, item: ItemView) {
    if (!canReorder || event.target !== event.currentTarget) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const itemCompleted = item.display.kind === 'task' && item.display.completion === 'completed';
    const categoryName = (item.display.category?.trim() || DEFAULT_TASK_CATEGORY.name).toLocaleLowerCase('ko-KR');
    const group = (itemCompleted ? completed : pending).filter((candidate) =>
      (candidate.display.category?.trim() || DEFAULT_TASK_CATEGORY.name).toLocaleLowerCase('ko-KR') === categoryName,
    );
    const index = group.findIndex((candidate) => candidate.display.id === item.display.id);
    const target = event.key === 'ArrowUp' ? group[index - 1] : group[index + 1];
    if (target) onReorder?.(item.display.id, target.display.id, event.key === 'ArrowDown');
  }

  function startPointerReorder(event: PointerEvent<HTMLLIElement>, itemId: string) {
    if (!canReorder || event.button !== 0) return;
    const row = event.currentTarget;
    const pointerId = event.pointerId;
    pointerSource.current = itemId;
    pointerDragging.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = window.setTimeout(() => {
      try {
        row.setPointerCapture(pointerId);
      } catch {
        clearPointerHold();
        return;
      }
      pointerDragging.current = true;
      setDraggingId(itemId);
    }, 280);
  }

  function movePointerReorder(event: PointerEvent<HTMLLIElement>) {
    const sourceId = pointerSource.current;
    if (!sourceId) return;
    if (!pointerDragging.current) {
      if (Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) > 10) clearPointerHold();
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-id]');
    setDragOverId(target?.dataset.taskId ?? null);
  }

  function endPointerReorder(event: PointerEvent<HTMLLIElement>) {
    const sourceId = pointerSource.current;
    const didDrag = pointerDragging.current;
    const target = didDrag ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-id]') : null;
    if (sourceId && target?.dataset.taskId) {
      const bounds = target.getBoundingClientRect();
      onReorder?.(sourceId, target.dataset.taskId, event.clientY > bounds.top + bounds.height / 2);
    }
    if (didDrag) suppressClick.current = true;
    clearPointerHold();
    setDraggingId(null);
    setDragOverId(null);
  }

  function suppressPostDragClick(event: MouseEvent<HTMLLIElement>) {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  }

  function clearPointerHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointerSource.current = null;
    pointerDragging.current = false;
  }

  function cancelPointerReorder() {
    clearPointerHold();
    setDraggingId(null);
    setDragOverId(null);
  }

  function startCategoryReorder(event: PointerEvent<HTMLHeadingElement>, name: string) {
    if (!canReorderCategories || event.button !== 0) return;
    categorySource.current = name;
    categoryDraggingRef.current = false;
    categoryOrigin.current = { x: event.clientX, y: event.clientY };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { clearCategoryHold(); return; }
    categoryHoldTimer.current = window.setTimeout(() => {
      categoryDraggingRef.current = true;
      setCategoryDragging(name);
    }, 300);
  }

  function moveCategoryReorder(event: PointerEvent<HTMLHeadingElement>) {
    if (!categorySource.current) return;
    if (!categoryDraggingRef.current) {
      if (Math.hypot(event.clientX - categoryOrigin.current.x, event.clientY - categoryOrigin.current.y) > 10) clearCategoryHold();
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-category-name]');
    setCategoryDropTarget(target?.dataset.categoryName ?? null);
  }

  function endCategoryReorder(event: PointerEvent<HTMLHeadingElement>) {
    const source = categorySource.current;
    const target = categoryDraggingRef.current
      ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-category-name]')
      : null;
    const targetName = target?.dataset.categoryName;
    if (source && targetName && source !== targetName) {
      const bounds = target.getBoundingClientRect();
      onReorderCategories?.(source, targetName, event.clientY > bounds.top + bounds.height / 2);
    }
    clearCategoryHold();
    setCategoryDragging(null);
    setCategoryDropTarget(null);
  }

  function moveCategoryWithKeyboard(event: KeyboardEvent<HTMLHeadingElement>, name: string) {
    if (!canReorderCategories || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const index = orderedCategories.findIndex((category) => category.name === name);
    const target = orderedCategories[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (!target) return;
    event.preventDefault();
    onReorderCategories?.(name, target.name, event.key === 'ArrowDown');
  }

  function clearCategoryHold() {
    if (categoryHoldTimer.current !== null) window.clearTimeout(categoryHoldTimer.current);
    categoryHoldTimer.current = null;
    categorySource.current = null;
    categoryDraggingRef.current = false;
  }

  function renderCategoryGroup(name: string, color: string, group: readonly ItemView[]) {
    const orderedGroup = [
      ...group.filter((item) => item.display.kind === 'task' && item.display.completion === 'pending'),
      ...group.filter((item) => item.display.kind === 'task' && item.display.completion === 'completed'),
    ];
    return (
      <section aria-label={`카테고리 ${name}`} className={styles.categoryGroup} data-category-name={name} data-dragging={categoryDragging === name} data-drop-target={categoryDropTarget === name && categoryDragging !== name} data-task-category={name} key={name}>
        <h3 aria-keyshortcuts={canReorderCategories ? 'ArrowUp ArrowDown' : undefined} aria-label={`카테고리 ${name}${canReorderCategories ? ', 길게 눌러 순서 변경' : ''}`} className={styles.categoryHeading} onKeyDown={(event) => moveCategoryWithKeyboard(event, name)} onPointerCancel={() => { clearCategoryHold(); setCategoryDragging(null); setCategoryDropTarget(null); }} onPointerDown={(event) => startCategoryReorder(event, name)} onPointerMove={moveCategoryReorder} onPointerUp={endCategoryReorder} tabIndex={canReorderCategories ? 0 : undefined}>
          <span aria-hidden="true" className={styles.categoryMark} style={{ backgroundColor: color }} />
          <span>{name}</span>
          {group.length > 0 && <span className={styles.categoryCount}>{group.length}</span>}
        </h3>
        {orderedGroup.length === 0 ? <div aria-hidden="true" className={styles.categoryEmpty} /> : (
          <ul className={styles.list}>
            {orderedGroup.map((item) => {
              const completedItem = item.display.kind === 'task' && item.display.completion === 'completed';
              return (
                <TaskRow
                  canReorder={canReorder}
                  completed={completedItem}
                  dragging={draggingId === item.display.id}
                  dragOver={dragOverId === item.display.id && draggingId !== item.display.id}
                  item={item}
                  key={item.display.id}
                  toggleDisabled={readOnly || !onToggle}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  onDragOver={(event) => { event.preventDefault(); setDragOverId(item.display.id); }}
                  onDragStart={(event) => beginDrag(event, item.display.id)}
                  onDrop={(event) => dropOnTask(event, item.display.id)}
                  onClickCapture={suppressPostDragClick}
                  onKeyDown={(event) => moveWithKeyboard(event, item)}
                  onOpen={onOpen}
                  onPointerCancel={cancelPointerReorder}
                  onPointerDown={(itemId, event) => startPointerReorder(event, itemId)}
                  onPointerMove={movePointerReorder}
                  onPointerUp={endPointerReorder}
                  onToggle={onToggle}
                />
              );
            })}
          </ul>
        )}
      </section>
    );
  }

  const categoryGroups = orderedCategories.flatMap((category) => {
    const group = tasks.filter((item) => item.display.kind === 'task' && (item.display.category?.trim() || DEFAULT_TASK_CATEGORY.name).toLocaleLowerCase('ko-KR') === category.name.toLocaleLowerCase('ko-KR'));
    return group.length > 0 ? [renderCategoryGroup(category.name, getTaskCategoryColor(category.color).color, group)] : [];
  });

  function renderSchedule(item: ItemView) {
    const color = item.display.categoryColor
      ? getTaskCategoryColor(item.display.categoryColor)
      : item.display.category
        ? getTaskCategoryColor(undefined)
        : getStableItemColor(item.display.id);
    return (
      <li key={item.display.id}>
        <button className={styles.scheduleRow} onClick={() => onOpen?.(item)} type="button">
          <span aria-hidden="true" className={`${styles.scheduleMark} ${styles[`mark_${item.display.kind}`]}`} style={{ backgroundColor: color.color }} />
          <span className={styles.scheduleCopy}>
            <span className={styles.scheduleTitle}>{item.display.title}</span>
            <span className={styles.scheduleMeta}>{formatScheduleMeta(item, date)}</span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <section className={styles.section} aria-label="선택한 날짜의 일정과 할 일">
      <div className={styles.heading}>
        <h2>{heading ?? formatCalendarHeading(date)}</h2>
        {displayMode !== 'agenda' && <button aria-label="할 일 추가" className={styles.add} disabled={disabled} onClick={() => onQuickAdd ? setQuickAddOverride(true) : onAdd?.()} type="button"><Icon name="plus" size={17} /><span>새 할 일</span></button>}
        {(displayMode === 'agenda' || displayMode === 'all') && onAddEvent && <button aria-label="새 일정 추가" className={styles.add} onClick={onAddEvent} type="button"><Icon name="plus" size={16} /><span>새 일정</span></button>}
      </div>
      {quickAddOpen && onQuickAdd && <form className={styles.quickAdd} onSubmit={(event) => { void submitQuickAdd(event); }}><input aria-label="새 할 일 제목" autoFocus maxLength={200} onChange={(event) => setQuickAddTitle(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setQuickAddOverride(false); setQuickAddTitle(''); onQuickAddDismiss?.(); } }} placeholder="할 일 제목" value={quickAddTitle} /><button disabled={!quickAddTitle.trim() || quickAddSaving} type="submit">추가</button><button aria-label="입력 닫기" onClick={() => { setQuickAddOverride(false); setQuickAddTitle(''); onQuickAddDismiss?.(); }} type="button">취소</button></form>}
      {quickAddError && <p className={styles.empty} role="alert">{quickAddError}</p>}
      <section aria-label="할 일" className={styles.taskSection}>
        {tasks.length > 0 && categoryGroups.length > 0 ? (
          <div className={styles.groups}>{categoryGroups}</div>
        ) : <p className={styles.empty}>등록된 할 일이 없습니다.</p>}
      </section>
      {(schedules.length > 0 || displayMode === 'agenda') && (
        <section aria-label="일정" className={styles.agendaSection}>
          <div className={styles.subheading}><h3>선택 날짜 일정 <span className={styles.categoryCount}>{schedules.length}</span></h3></div>
          {schedules.length > 0 ? <ul className={styles.scheduleList}>{schedules.map(renderSchedule)}</ul> : <p className={styles.empty}>이 날짜에 등록된 일정이 없습니다.</p>}
        </section>
      )}
    </section>
  );
}

function formatScheduleMeta(item: ItemView, selectedDate: string): string {
  const timing = item.display.timing;
  if (timing.type === 'unscheduled') return '날짜 미정';
  if (timing.type === 'date') {
    const start = timing.startDate ?? timing.endDate;
    const end = timing.endDate;
    const startText = formatShortDate(start);
    const endText = formatShortDate(end);
    if (item.display.kind === 'event' && start === end && start === selectedDate) return '종일';
    if (item.display.kind === 'event' && start === end) return `종일 · ${startText}`;
    if (item.display.kind === 'deadline') return `마감 · ${endText}`;
    return start === end ? startText : `${startText}–${endText}`;
  }
  const start = timing.startAt;
  const end = timing.endAt;
  const startText = start ? formatShortInstant(start, timing.timeZone, selectedDate) : '';
  const endText = end ? formatShortInstant(end, timing.timeZone, selectedDate) : '';
  if (item.display.kind === 'deadline') return `마감 · ${endText || startText}`;
  if (item.display.kind === 'window') return `기간 · ${startText || '시작 미정'}–${endText || '종료 미정'}`;
  return endText ? `${startText}–${endText}` : startText;
}

function formatShortDate(value: string): string {
  const [, month = '', day = ''] = value.split('-');
  return `${Number(month)}.${Number(day)}`;
}

function formatShortInstant(value: string, timeZone: string, selectedDate: string): string {
  const date = getLocalDate(Date.parse(value), timeZone);
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(value));
  return date === selectedDate ? time : `${formatShortDate(date)} ${time}`;
}

function orderCategories(categories: readonly TaskCategory[], order: readonly string[]): TaskCategory[] {
  if (order.length === 0) return [...categories];
  const rank = new Map(order.map((name, index) => [name.toLocaleLowerCase('ko-KR'), index]));
  return [...categories].sort((first, second) =>
    (rank.get(first.name.toLocaleLowerCase('ko-KR')) ?? Number.MAX_SAFE_INTEGER)
      - (rank.get(second.name.toLocaleLowerCase('ko-KR')) ?? Number.MAX_SAFE_INTEGER),
  );
}
