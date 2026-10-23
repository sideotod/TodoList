'use client';

import type { KeyboardEvent } from 'react';
import { Icon } from '../ui/Icon';
import type { ItemView } from '../../domain/items';
import { DEFAULT_TASK_CATEGORY, getTaskCategoryColor, type TaskCategory } from '../../domain/task-categories';
import { selectCalendarAgenda } from '../../domain/projections';
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
  categories?: readonly TaskCategory[];
};

export function MonthTaskGrid({ items, month, selectedDate, onSelectDate, onChangeMonth, showHeading = true, categories = [DEFAULT_TASK_CATEGORY] }: MonthTaskGridProps) {
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
              <Icon name="chevron-left" />
            </button>
            <button type="button" aria-label="다음 달" onClick={() => navigateMonth(1)}>
              <Icon name="chevron-right" />
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
              // C3: home is a task calendar; schedules stay in the weekly calendar and D-day strip.
              const agenda = selectCalendarAgenda(items, cell.date, 'Asia/Seoul').filter((item) => item.display.kind === 'task');
              const count = agenda.length;
              const categoryColors = new Map<string, string>();
              for (const item of agenda) {
                const categoryName = item.display.category?.trim() || DEFAULT_TASK_CATEGORY.name;
                const categoryKey = categoryName.toLocaleLowerCase('ko-KR');
                if (categoryColors.has(categoryKey)) continue;
                const configuredCategory = categories.find((category) => category.name.toLocaleLowerCase('ko-KR') === categoryKey);
                const color = configuredCategory?.color ?? item.display.categoryColor ?? DEFAULT_TASK_CATEGORY.color;
                categoryColors.set(categoryKey, getTaskCategoryColor(color).color);
              }
              const markerColors = [...categoryColors.values()];
              const accessibleCounts = count > 0 ? `할 일 ${count}개` : '';
              const selected = selectedDate === cell.date;
              return (
                <button
                  aria-describedby={count > 0 ? `month-agenda-${cell.date}` : undefined}
                  aria-label={`${formatKoreanDate(cell.date)}${accessibleCounts ? `, ${accessibleCounts}` : ''}`}
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
                    {markerColors.slice(0, 4).map((color, index) => <span aria-hidden="true" className={styles.dotDesktop} key={`${cell.date}-${index}`} style={{ backgroundColor: color }} />)}
                    {markerColors.length > 4 && <span className={styles.dotOverflow}>+{markerColors.length - 4}</span>}
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
  const kind = item.display.kind === 'task' ? '할 일'
    : item.display.kind === 'event' ? '일정'
      : item.display.kind === 'deadline' ? '마감' : '기간';
  if (timing.type !== 'time') return `${kind} · ${item.display.title}`;
  const instant = timing.startAt ?? timing.endAt;
  if (!instant) return `${kind} · ${item.display.title}`;
  const time = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timing.timeZone }).format(new Date(instant));
  return `${kind} · ${time} ${item.display.title}`;
}
