'use client';

import type { KeyboardEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { getStableItemColor, getTaskCategoryColor } from '../../domain/task-categories';
import { selectDailyTasks } from '../../domain/projections';
import { isKoreanPublicHoliday } from '../calendar/korean-holidays';
import {
  formatKoreanDate,
  getDateMonth,
  getMonthCells,
  getMonthHeading,
  getWeekdayLabels,
  moveToMonthDate,
  shiftDate,
  shiftMonth,
} from '../calendar/calendar-dates';
import styles from './MonthTaskGrid.module.css';

type MonthTaskGridProps = {
  items: readonly ItemView[];
  month: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onChangeMonth: (month: string) => void;
  showHeading?: boolean;
};

export function MonthTaskGrid({ items, month, selectedDate, onSelectDate, onChangeMonth, showHeading = true }: MonthTaskGridProps) {
  const cells = getMonthCells(month);
  const weekdays = getWeekdayLabels();

  function chooseDate(date: string) {
    onSelectDate(date);
    const selectedMonth = getDateMonth(date);
    if (selectedMonth !== month) onChangeMonth(selectedMonth);
  }

  function navigateMonth(amount: number) {
    const nextMonth = shiftMonth(month, amount);
    onChangeMonth(nextMonth);
    onSelectDate(moveToMonthDate(selectedDate, nextMonth));
  }

  function handleDateKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const nextDate = event.key === 'ArrowLeft' ? shiftDate(date, -1)
      : event.key === 'ArrowRight' ? shiftDate(date, 1)
      : event.key === 'ArrowUp' ? shiftDate(date, -7)
      : event.key === 'ArrowDown' ? shiftDate(date, 7)
      : event.key === 'Home' ? shiftDate(date, -weekday)
      : event.key === 'End' ? shiftDate(date, 6 - weekday)
      : null;
    if (nextDate) {
      event.preventDefault();
      chooseDate(nextDate);
      document.getElementById(`month-day-${nextDate}`)?.focus();
    }
  }

  return (
    <section className={styles.calendar} aria-label="월간 할 일">
      {showHeading && (
        <div className={styles.heading}>
          <h2>{getMonthHeading(month)}</h2>
          <div className={styles.monthControls} aria-label="월 이동">
            <button type="button" aria-label="이전 달" onClick={() => navigateMonth(-1)}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" aria-label="다음 달" onClick={() => navigateMonth(1)}>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      )}
      <div className={styles.days} role="grid" aria-label={`${getMonthHeading(month)} 날짜`}>
        <div className={styles.weekdays} role="row">
          {weekdays.map((day, index) => (
            <span className={index === 0 ? styles.sunday : index === 6 ? styles.saturday : ''} role="columnheader" key={day}>{day}</span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, rowIndex) => (
          <div className={styles.week} key={`week-${rowIndex}`} role="row">
            {cells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell) => {
              const agenda = selectDailyTasks(items, cell.date, 'Asia/Seoul');
              const count = agenda.length;
              const selected = selectedDate === cell.date;
              return (
                <button
                  aria-describedby={count > 0 ? `month-agenda-${cell.date}` : undefined}
                  aria-label={`${formatKoreanDate(cell.date)}${count > 0 ? `, 할 일 ${count}개` : ''}`}
                  aria-selected={selected}
                  className={`${styles.day} ${!cell.inMonth ? styles.outside : ''} ${cell.weekday === 0 ? styles.sunday : ''} ${cell.weekday === 6 ? styles.saturday : ''} ${isKoreanPublicHoliday(cell.date) ? styles.holiday : ''} ${selected ? styles.selected : ''}`}
                  id={`month-day-${cell.date}`}
                  key={cell.date}
                  onClick={() => chooseDate(cell.date)}
                  onKeyDown={(event) => handleDateKey(event, cell.date)}
                  role="gridcell"
                  tabIndex={selected ? 0 : -1}
                  type="button"
                >
                  <span className={styles.dateBadge}>
                    {selected && <span aria-hidden="true" className={styles.selectedFillDesktop} />}
                    {selected && <span aria-hidden="true" className={styles.selectedFillMobile} />}
                    <span className={styles.dayNumber}>{cell.dayOfMonth}</span>
                  </span>
                  <span className={styles.dots} aria-hidden="true">
                    {agenda.slice(0, 4).map((item) => {
                      const color = item.display.categoryColor ? getTaskCategoryColor(item.display.categoryColor)
                        : item.display.category ? getTaskCategoryColor(undefined) : getStableItemColor(item.display.id);
                      return <span aria-hidden="true" className={styles.dotDesktop} key={item.display.id} style={{ backgroundColor: color.color }} />;
                    })}
                    {count > 4 && <span className={styles.dotOverflow}>+{count - 4}</span>}
                  </span>
                  {count > 0 && (
                    <span className={styles.agendaPreview} id={`month-agenda-${cell.date}`} role="tooltip">
                      {agenda.map((item) => <span className={styles.agendaItem} key={item.display.id}>{getAgendaLabel(item)}</span>)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function getAgendaLabel(item: ItemView): string {
  const timing = item.display.timing;
  if (timing.type !== 'time') return item.display.title;
  const instant = timing.startAt ?? timing.endAt;
  if (!instant) return item.display.title;
  const time = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timing.timeZone }).format(new Date(instant));
  return `${time} ${item.display.title}`;
}
