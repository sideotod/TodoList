'use client';

import Image from 'next/image';
import type { PointerEventHandler } from 'react';
import styles from './TaskDragHandle.module.css';

type TaskDragHandleProps = {
  title: string;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
};

export function TaskDragHandle({ title, onPointerCancel, onPointerDown, onPointerMove, onPointerUp }: TaskDragHandleProps) {
  return (
    <button
      aria-label={`${title} 순서 변경. 누른 채로 끌기`}
      className={styles.handle}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="누르고 끌어 순서 변경"
      type="button"
    >
      <Image alt="" height={16} src="/design/figma-task-drag-handle.svg" unoptimized width={16} />
    </button>
  );
}
