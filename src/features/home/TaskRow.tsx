'use client';

import { Icon } from '../ui/Icon';
import type { DragEventHandler, KeyboardEventHandler, MouseEventHandler, PointerEvent, PointerEventHandler } from 'react';
import type { ItemView } from '../../domain/items';
import styles from './TaskRow.module.css';

type TaskRowProps = {
  item: ItemView;
  completed: boolean;
  canReorder: boolean;
  dragging: boolean;
  dragOver: boolean;
  toggleDisabled: boolean;
  onToggle?: (item: ItemView) => void;
  onOpen?: (item: ItemView) => void;
  onDragStart?: DragEventHandler<HTMLLIElement>;
  onDragEnd?: DragEventHandler<HTMLLIElement>;
  onDragOver?: DragEventHandler<HTMLLIElement>;
  onDrop?: DragEventHandler<HTMLLIElement>;
  onKeyDown?: KeyboardEventHandler<HTMLLIElement>;
  onPointerCancel?: (itemId: string) => void;
  onPointerDown?: (itemId: string, event: PointerEvent<HTMLLIElement>) => void;
  onPointerMove?: PointerEventHandler<HTMLLIElement>;
  onPointerUp?: PointerEventHandler<HTMLLIElement>;
  onClickCapture?: MouseEventHandler<HTMLLIElement>;
};

export function TaskRow({
  item,
  completed,
  canReorder,
  dragging,
  dragOver,
  toggleDisabled,
  onToggle,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClickCapture,
}: TaskRowProps) {
  return (
    <li
      aria-keyshortcuts={canReorder ? 'ArrowUp ArrowDown' : undefined}
      aria-label={`${item.display.title}${item.display.category ? `, ${item.display.category} 카테고리` : ''}, ${completed ? '완료' : '미완료'}${canReorder ? '. 길게 눌러 이동하거나 위아래 화살표로 같은 분류 안에서 이동' : ''}`}
      className={`${styles.row} ${completed ? styles.completed : ''} ${dragging ? styles.dragging : ''} ${dragOver ? styles.dragTarget : ''}`}
      data-task-id={item.display.id}
      data-task-status={completed ? 'completed' : 'pending'}
      data-reorderable={canReorder}
      draggable={canReorder && !dragging}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      onPointerCancel={() => onPointerCancel?.(item.display.id)}
      onPointerDown={(event) => onPointerDown?.(item.display.id, event)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      tabIndex={canReorder ? 0 : undefined}
    >
      <button
        aria-checked={completed}
        aria-label={`${item.display.title}, ${completed ? '완료' : '미완료'}`}
        className={styles.checkbox}
        disabled={toggleDisabled}
        onClick={() => onToggle?.(item)}
        role="checkbox"
        type="button"
      >
        {completed && <Icon name="check" size={14} />}
      </button>
      {onOpen ? (
        <button className={styles.title} onClick={() => onOpen(item)} type="button">{item.display.title}</button>
      ) : <span className={styles.title}>{item.display.title}</span>}
    </li>
  );
}
