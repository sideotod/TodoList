'use client';

import type { CSSProperties } from 'react';
import type { ItemView } from '../../domain/items';
import { selectCalendarAgenda } from '../../domain/projections';
import { getTaskCategoryColor } from '../../domain/task-categories';
import { formatKoreanDate, getMonthCells, getMonthHeading, getWeekdayLabels } from './calendar-dates';
import styles from './CalendarMonthGrid.module.css';

type CalendarMonthGridProps = {
  items: readonly ItemView[];
  month: string;
  selectedDate: string;
  timeZone: string;
  weekStartsOn: 0 | 1;
  onSelectDate: (date: string) => void;
  onAddEvent: (date: string) => void;
  onOpen: (item: ItemView) => void;
};

export function CalendarMonthGrid({ items, month, selectedDate, timeZone, weekStartsOn, onSelectDate, onAddEvent, onOpen }: CalendarMonthGridProps) {
  const cells = getMonthCells(month, weekStartsOn);
  const weekdays = getWeekdayLabels(weekStartsOn);

  return (
    <section aria-label="월간 캘린더" className={styles.calendar}>
      <div aria-hidden="true" className={styles.weekdays}>{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div aria-label={`${getMonthHeading(month)} 일정`} className={styles.days} role="grid">
        {cells.map((cell) => {
          const dayItems = selectCalendarAgenda(items, cell.date, timeZone);
          const visible = dayItems.slice(0, 3);
          const overflow = Math.max(0, dayItems.length - visible.length);
          return (
            <article aria-selected={cell.date === selectedDate} className={styles.day} data-outside={!cell.inMonth} data-selected={cell.date === selectedDate} key={cell.date} role="gridcell">
              <header className={styles.dayHeader}>
                <button aria-label={formatKoreanDate(cell.date)} className={styles.dayNumber} onClick={() => onSelectDate(cell.date)} type="button">{cell.dayOfMonth}</button>
                {cell.date === selectedDate && <span className={styles.selectedLabel}>선택</span>}
              </header>
              <div className={styles.events}>
                {visible.map((item) => {
                  const color = getTaskCategoryColor(item.display.categoryColor);
                  return <button className={styles.event} key={`${item.display.id}:${cell.date}`} onClick={() => onOpen(item)} style={{ '--event-color': color.color, '--event-soft': color.soft } as CSSProperties} title={item.display.title} type="button"><span className={styles.eventTime}>{getEventTime(item, cell.date, timeZone)}</span><span className={styles.eventTitle}>{item.display.title}</span></button>;
                })}
                {overflow > 0 && <button aria-label={`${formatKoreanDate(cell.date)} 일정 ${overflow}개 더 보기`} className={styles.more} onClick={() => onSelectDate(cell.date)} type="button">+{overflow}개 더 보기</button>}
              </div>
              <button aria-label={`${formatKoreanDate(cell.date)} 일정 추가`} className={styles.add} onClick={() => onAddEvent(cell.date)} type="button">+</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getEventTime(item: ItemView, date: string, timeZone: string): string {
  const timing = item.display.timing;
  if (timing.type === 'unscheduled') return '날짜 미정';
  if (timing.type === 'date') {
    if (item.display.kind === 'event') return '종일';
    if (item.display.kind === 'deadline') return '마감';
    return item.display.kind === 'window' ? '기간' : '할 일';
  }
  const instant = timing.startAt ?? timing.endAt;
  if (!instant) return item.display.kind === 'deadline' ? '마감' : '종일';
  if (item.display.kind === 'task' || item.display.kind === 'deadline') return item.display.kind === 'task' ? '할 일' : '마감';
  const startDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(instant));
  if (startDate !== date) return item.display.kind === 'window' ? '기간' : '종일';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(instant));
}
