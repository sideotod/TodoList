'use client';

import Image from 'next/image';
import { TopActionMenu } from '../home/TopActionMenu';
import styles from './WeekCalendarHeader.module.css';

type WeekCalendarHeaderProps = {
  rangeLabel: string;
  onMoveDate: (amount: number) => void;
  onToday: () => void;
  onAddTask: () => void;
  onAddEvent: () => void;
  view: 'day' | 'week' | 'month' | 'year' | 'periods';
  onViewChange: (view: 'day' | 'week' | 'month' | 'year' | 'periods') => void;
};

export function WeekCalendarHeader({ rangeLabel, onMoveDate, onToday, onAddTask, onAddEvent, view, onViewChange }: WeekCalendarHeaderProps) {
  const showingPeriods = view === 'periods';
  const navigationLabel = view === 'day' ? '날' : view === 'week' ? '주' : view === 'month' ? '달' : '년';
  return (
    <header className={styles.header}>
      <div className={styles.identity}><span>YOUR SCHEDULE</span><h1>캘린더</h1></div>
      <div className={styles.dateNavigation}>
        <h2>{showingPeriods ? '기간 일정' : rangeLabel}</h2>
        {!showingPeriods && <>
          <button aria-label={`이전 ${navigationLabel}`} className={styles.arrow} onClick={() => onMoveDate(-1)} type="button">
            <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
          </button>
          <button aria-label={`다음 ${navigationLabel}`} className={`${styles.arrow} ${styles.nextArrow}`} onClick={() => onMoveDate(1)} type="button">
            <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
          </button>
          <button aria-label="오늘로 이동" className={styles.today} onClick={onToday} type="button">오늘</button>
        </>}
      </div>
      <div aria-label="캘린더 보기" className={styles.viewToggle} role="group">
        <button aria-label="일간 캘린더 보기" aria-pressed={view === 'day'} className={view === 'day' ? styles.selectedView : ''} onClick={() => onViewChange('day')} type="button">일</button>
        <button aria-label="주간 캘린더 보기" aria-pressed={view === 'week'} className={view === 'week' ? styles.selectedView : ''} onClick={() => onViewChange('week')} type="button">주</button>
        <button aria-label="월간 캘린더 보기" aria-pressed={view === 'month'} className={view === 'month' ? styles.selectedView : ''} onClick={() => onViewChange('month')} type="button">월</button>
        <button aria-label="연간 캘린더 보기" aria-pressed={view === 'year'} className={view === 'year' ? styles.selectedView : ''} onClick={() => onViewChange('year')} type="button">년</button>
        <button aria-label="기간 일정 보기" aria-pressed={view === 'periods'} className={view === 'periods' ? styles.selectedView : ''} onClick={() => onViewChange('periods')} type="button">기간</button>
      </div>
      <div className={styles.controls}>
        <TopActionMenu onAddTask={onAddTask} onAddEvent={onAddEvent} placement="header" />
      </div>
    </header>
  );
}
