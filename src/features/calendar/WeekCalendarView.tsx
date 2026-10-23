'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, UIEvent } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { ItemView } from '../../domain/items';
import { getLocalDate } from '../../domain/time';
import { updateRouteDate } from '../../lib/route-date';
import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from './calendar-time-range';
import { PeriodList } from './PeriodList';
import { shiftDate } from './calendar-dates';
import { formatCalendarHeading, getDateMonth, getMonthCells, getMonthHeading, getWeekdayLabels, moveToMonthDate, shiftMonth } from './calendar-dates';
import { isKoreanPublicHoliday } from './korean-holidays';
import { WeekAllDayLane } from './WeekAllDayLane';
import { WeekCalendarHeader } from './WeekCalendarHeader';
import { WeekTimeGrid } from './WeekTimeGrid';
import { WeekTaskLane } from './WeekTaskLane';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import styles from './WeekCalendarView.module.css';
import { selectCalendarAgenda } from '../../domain/projections';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year' | 'periods';
export type WeekCalendarViewProps = {
  items: readonly ItemView[];
  nowMs: number;
  initialDate?: string;
  view: CalendarViewMode;
  weekStartsOn: 0 | 1;
  timeFormat: '24h' | '12h';
  timeZone: string;
  onAddTask: (date: string) => void;
  onAddEvent: (date: string) => void;
  onAdd(date: string, startTime: string): void;
  onOpen(item: ItemView): void;
  onToggleTask(item: ItemView): void;
  onViewChange: (view: CalendarViewMode) => void;
};

export function WeekCalendarView({
  items,
  nowMs,
  initialDate,
  view,
  weekStartsOn,
  timeFormat,
  timeZone,
  onAddTask,
  onAddEvent,
  onAdd,
  onOpen,
  onToggleTask,
  onViewChange,
}: WeekCalendarViewProps) {
  const today = getLocalDate(nowMs, timeZone);
  const [anchorDate, setAnchorDate] = useState(initialDate ?? today);
  const [isTimeScrolling, setIsTimeScrolling] = useState(false);
  const timeScrollerRef = useRef<HTMLDivElement>(null);
  const nowMsRef = useRef(nowMs);
  const currentDate = Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(timeZone).toPlainDate().toString();
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dates = getWeekDates(anchorDate, weekStartsOn);
  const displayDates = view === 'day' ? [anchorDate] : dates;
  const startDate = displayDates[0] ?? anchorDate;
  const endDate = displayDates[displayDates.length - 1] ?? anchorDate;
  const showingPeriods = view === 'periods';

  function moveDate(amount: number) {
    const nextDate = view === 'day' ? shiftDate(anchorDate, amount)
      : view === 'month' ? moveToMonthDate(anchorDate, shiftMonth(getDateMonth(anchorDate), amount))
        : view === 'year' ? moveToMonthDate(anchorDate, shiftMonth(getDateMonth(anchorDate), amount * 12))
          : shiftDate(anchorDate, amount * 7);
    setAnchorDate(nextDate);
    updateRouteDate(nextDate);
  }

  function moveToToday() {
    setAnchorDate(today);
    updateRouteDate(today);
  }

  function handleTimeScroll() {
    setIsTimeScrolling(true);
    if (scrollTimer.current !== null) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      setIsTimeScrolling(false);
    }, 750);
  }

  function handleWeekHorizontalScroll(event: UIEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty('--week-scroll-offset', `${event.currentTarget.scrollLeft}px`);
  }

  useEffect(() => () => {
    if (scrollTimer.current !== null) clearTimeout(scrollTimer.current);
  }, []);

  useLayoutEffect(() => {
    nowMsRef.current = nowMs;
  }, [nowMs]);

  useLayoutEffect(() => {
    if (showingPeriods) return;
    const scroller = timeScrollerRef.current;
    if (!scroller) return;
    const currentTime = Temporal.Instant.fromEpochMilliseconds(nowMsRef.current).toZonedDateTimeISO(timeZone);
    const isCurrentWeek = startDate <= currentDate && currentDate <= endDate;
    const preferredStartHour = isCurrentWeek ? currentTime.hour + currentTime.minute / 60 - 1 : null;
    scroller.scrollTop = getInitialScrollTop(preferredStartHour, scroller.clientHeight);
  }, [currentDate, endDate, showingPeriods, startDate, timeZone, view]);

  const rangeLabel = view === 'day' ? formatCalendarHeading(anchorDate)
    : view === 'month' ? getMonthHeading(getDateMonth(anchorDate))
      : view === 'year' ? anchorDate.slice(0, 4) + '년'
        : view === 'periods' ? '기간 일정'
          : formatRange(startDate, endDate);

  return (
    <main className={styles.page} data-view={view}>
      <WeekCalendarHeader
        rangeLabel={rangeLabel}
        onMoveDate={moveDate}
        onToday={moveToToday}
        onAddTask={() => onAddTask(anchorDate)}
        onAddEvent={() => onAddEvent(anchorDate)}
        view={view}
        onViewChange={onViewChange}
      />
      {showingPeriods ? (
        <PeriodList items={items} nowMs={nowMs} onOpen={onOpen} />
      ) : view === 'month' ? (
        <CalendarMonthGrid items={items} month={getDateMonth(anchorDate)} selectedDate={anchorDate} timeZone={timeZone} weekStartsOn={weekStartsOn} onSelectDate={(date) => { setAnchorDate(date); updateRouteDate(date); onViewChange('day'); }} onAddEvent={onAddEvent} onOpen={onOpen} />
      ) : view === 'year' ? (
        <YearCalendar items={items} year={Number(anchorDate.slice(0, 4))} selectedDate={anchorDate} weekStartsOn={weekStartsOn} onSelectDate={(date) => { setAnchorDate(date); updateRouteDate(date); onViewChange('month'); }} />
      ) : (
        <div aria-label={view === 'day' ? '일간 캘린더 시간표' : '주간 캘린더 가로 스크롤 영역'} className={styles.weekViewport} onScroll={handleWeekHorizontalScroll} role="region" tabIndex={0}>
          <div className={styles.weekCanvas}>
            <div aria-label="요일" className={styles.weekdayHeader} style={{ '--calendar-day-count': displayDates.length } as CSSProperties}>
              <span aria-hidden="true" className={styles.weekGutter} />
              {displayDates.map((date) => (
                <div className={getWeekdayClassName(date)} key={date}>
                  <span>{weekday(date)}</span>
                </div>
              ))}
            </div>
            <div aria-label="주간 날짜" className={styles.dateHeader} style={{ '--calendar-day-count': displayDates.length } as CSSProperties}>
              <span aria-hidden="true" className={styles.weekGutter} />
              {displayDates.map((date) => (
                <div aria-current={date === today ? 'date' : undefined} className={getDateClassName(date, today)} key={date}>
                  <strong>{Number(date.slice(-2))}</strong>
                </div>
              ))}
            </div>
            <div className={styles.allDay}>
              <WeekAllDayLane dates={displayDates} items={items} timeZone={timeZone} onOpen={onOpen} />
            </div>
            <WeekTaskLane dates={displayDates} items={items} timeZone={timeZone} onOpen={onOpen} onToggle={onToggleTask} />
            <div aria-label="시간표 스크롤 영역" className={`${styles.timeScroller} ${isTimeScrolling ? styles.scrolling : ''}`} data-scrolling={isTimeScrolling} onScroll={handleTimeScroll} ref={timeScrollerRef} role="region" tabIndex={0}>
              <WeekTimeGrid
                dates={displayDates}
                today={today}
                items={items}
                timeZone={timeZone}
                timeFormat={timeFormat}
                nowMs={nowMs}
                visibleStartHour={CALENDAR_START_HOUR}
                visibleEndHour={CALENDAR_END_HOUR}
                onOpen={onOpen}
                onAdd={onAdd}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const HOUR_HEIGHT = 42;

function getInitialScrollTop(preferredStartHour: number | null, viewportHeight: number): number {
  const totalHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT;
  const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
  const firstHour = preferredStartHour === null
    ? CALENDAR_START_HOUR
    : Math.max(CALENDAR_START_HOUR, Math.min(CALENDAR_END_HOUR - 1, preferredStartHour));
  return Math.max(0, Math.min(maxScrollTop, (firstHour - CALENDAR_START_HOUR) * HOUR_HEIGHT));
}

function getDateClassName(date: string, today: string): string {
  const classes = [styles.date, getDayToneClass(date)];
  if (date === today) classes.push(styles.today);
  return classes.filter(Boolean).join(' ');
}

function getWeekdayClassName(date: string): string {
  return [styles.weekday, getDayToneClass(date)].filter(Boolean).join(' ');
}

function getDayToneClass(date: string): string {
  const weekdayIndex = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekdayIndex === 0 || isKoreanPublicHoliday(date)) return styles.holiday;
  if (weekdayIndex === 6) return styles.saturday;
  return '';
}

function getWeekDates(date: string, weekStartsOn: 0 | 1): string[] {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const offset = (day - weekStartsOn + 7) % 7;
  const start = shiftDate(date, -offset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

function weekday(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return ['일', '월', '화', '수', '목', '금', '토'][day] ?? '';
}

function formatRange(startDate: string, endDate: string): string {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  if (startYear !== endYear) return `${startYear}년 ${startMonth}월 ${startDay}일 – ${endYear}년 ${endMonth}월 ${endDay}일`;
  if (startMonth !== endMonth) return `${startYear}년 ${startMonth}월 ${startDay}일 – ${endMonth}월 ${endDay}일`;
  return `${startYear}년 ${startMonth}월 ${startDay}일 – ${endDay}일`;
}

function YearCalendar({ items, year, selectedDate, weekStartsOn, onSelectDate }: { items: readonly ItemView[]; year: number; selectedDate: string; weekStartsOn: 0 | 1; onSelectDate: (date: string) => void }) {
  const weekdays = getWeekdayLabels(weekStartsOn);
  return (
    <section aria-label={year + '년 캘린더'} className={styles.yearGrid}>
      {Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1).padStart(2, '0');
        const key = String(year) + '-' + month;
        const cells = getMonthCells(key, weekStartsOn);
        return (
          <article className={styles.yearMonth} key={key}>
            <h2>{getMonthHeading(key).replace(String(year) + '년 ', '')}</h2>
            <div aria-hidden="true" className={styles.yearWeekdays}>{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className={styles.yearDays}>
              {cells.map((cell) => {
                const count = selectCalendarAgenda(items, cell.date, 'Asia/Seoul').length;
                return <button aria-label={formatCalendarHeading(cell.date) + (count ? ' 일정 ' + count + '개' : '')} aria-pressed={cell.date === selectedDate} className={cell.date === selectedDate ? styles.selectedYearDay : ''} data-has-items={count > 0} disabled={!cell.inMonth} key={cell.date} onClick={() => onSelectDate(cell.date)} type="button">{cell.dayOfMonth}</button>;
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}
