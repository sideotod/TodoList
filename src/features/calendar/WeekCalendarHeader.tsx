'use client';

import Image from 'next/image';
import { TopActionMenu } from '../home/TopActionMenu';
import styles from './WeekCalendarHeader.module.css';

type WeekCalendarHeaderProps = {
  rangeLabel: string;
  onMoveWeek: (amount: number) => void;
  onToday: () => void;
  onAddTask: () => void;
  onAddEvent: () => void;
};

export function WeekCalendarHeader({ rangeLabel, onMoveWeek, onToday, onAddTask, onAddEvent }: WeekCalendarHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.dateNavigation}>
        <h1>{rangeLabel}</h1>
        <button aria-label="이전 주" className={styles.arrow} onClick={() => onMoveWeek(-1)} type="button">
          <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
        </button>
        <button aria-label="다음 주" className={`${styles.arrow} ${styles.nextArrow}`} onClick={() => onMoveWeek(1)} type="button">
          <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
        </button>
        <button aria-label="오늘로 이동" className={styles.today} onClick={onToday} type="button">오늘</button>
      </div>
      <div className={styles.controls}>
        <TopActionMenu onAddTask={onAddTask} onAddEvent={onAddEvent} placement="header" />
      </div>
    </header>
  );
}
