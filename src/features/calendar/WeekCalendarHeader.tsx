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
  showingPeriods: boolean;
  onViewChange: (view: 'week' | 'periods') => void;
};

export function WeekCalendarHeader({ rangeLabel, onMoveWeek, onToday, onAddTask, onAddEvent, showingPeriods, onViewChange }: WeekCalendarHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.dateNavigation}>
        <h1>{showingPeriods ? '기간 일정' : rangeLabel}</h1>
        {!showingPeriods && <>
          <button aria-label="이전 주" className={styles.arrow} onClick={() => onMoveWeek(-1)} type="button">
            <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
          </button>
          <button aria-label="다음 주" className={`${styles.arrow} ${styles.nextArrow}`} onClick={() => onMoveWeek(1)} type="button">
            <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
          </button>
          <button aria-label="오늘로 이동" className={styles.today} onClick={onToday} type="button">오늘</button>
        </>}
      </div>
      <div aria-label="캘린더 보기" className={styles.viewToggle} role="group">
        <button aria-label="주간 캘린더 보기" aria-pressed={!showingPeriods} className={!showingPeriods ? styles.selectedView : ''} onClick={() => onViewChange('week')} type="button">주간</button>
        <button aria-label="기간 일정 보기" aria-pressed={showingPeriods} className={showingPeriods ? styles.selectedView : ''} onClick={() => onViewChange('periods')} type="button">기간</button>
      </div>
      <div className={styles.controls}>
        <TopActionMenu onAddTask={onAddTask} onAddEvent={onAddEvent} placement="header" />
      </div>
    </header>
  );
}
