'use client';

import Image from 'next/image';
import type { ItemView } from '../../domain/items';
import { getLocalDate } from '../../domain/time';
import { getMonthHeading, shiftMonth } from '../calendar/calendar-dates';
import styles from './MonthHeader.module.css';

type MonthHeaderProps = {
  month: string;
  items: readonly ItemView[];
  timeZone: string;
  onChangeMonth: (month: string) => void;
};

export function MonthHeader({ month, items, timeZone, onChangeMonth }: MonthHeaderProps) {
  const completedTasks = items.filter((item) => {
    if (item.display.kind !== 'task' || item.display.completion !== 'completed') return false;
    const timing = item.display.timing;
    const date = timing.type === 'date'
      ? timing.endDate
      : timing.type === 'time' && timing.endAt
        ? getLocalDate(Date.parse(timing.endAt), timeZone)
        : null;
    return date?.startsWith(`${month}-`) ?? false;
  }).length;

  return (
    <header className={styles.header}>
      <div className={styles.headingCopy}>
        <h1>{getMonthHeading(month)}</h1>
        <span>이번 달 {completedTasks}개 완료</span>
      </div>
      <nav aria-label="월 이동" className={styles.controls}>
        <button aria-label="이전 달" onClick={() => onChangeMonth(shiftMonth(month, -1))} type="button">
          <Image alt="" height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
        </button>
        <button aria-label="다음 달" onClick={() => onChangeMonth(shiftMonth(month, 1))} type="button">
          <Image alt="" className={styles.nextIcon} height={16} src="/design/figma-month-previous.svg" unoptimized width={16} />
        </button>
      </nav>
    </header>
  );
}
