'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ItemView } from '../../domain/items';
import { isItemDeleted, selectCalendarAgenda } from '../../domain/projections';
import { getLocalDate } from '../../domain/time';
import { getStableItemColor, getTaskCategoryColor } from '../../domain/task-categories';
import { shiftDate } from './calendar-dates';
import styles from './WeekAllDayLane.module.css';

type WeekAllDayLaneProps = {
  dates: readonly string[];
  items: readonly ItemView[];
  timeZone: string;
  onOpen: (item: ItemView) => void;
};

type PeriodSpan = { item: ItemView; start: number; end: number; row: number };

export function WeekAllDayLane({ dates, items, timeZone, onOpen }: WeekAllDayLaneProps) {
  const dayCount = Math.max(1, dates.length);
  const [expanded, setExpanded] = useState(true);
  const spans = useMemo(() => getPeriodSpans(dates, items, timeZone), [dates, items, timeZone]);
  const periodRows = spans.reduce((max, span) => Math.max(max, span.row + 1), 0);
  const days = dates.map((date, dayIndex) => {
    const dayItems = selectCalendarAgenda(items, date, timeZone)
      .filter((item) => !isItemDeleted(item) && item.display.kind === 'event' && item.display.timing.type === 'date');
    const occupiedRows = new Set(spans.filter((span) => span.start <= dayIndex && span.end >= dayIndex).map((span) => span.row));
    let row = 0;
    while (occupiedRows.has(row)) row++;
    return { date, items: dayItems, row };
  });
  const laneRows = days.reduce((max, day) => day.items.length ? Math.max(max, day.row + 1) : max, periodRows);
  const laneHeight = Math.max(32, 8 + laneRows * 22);
  const itemCount = spans.length + days.reduce((total, day) => total + day.items.length, 0);

  return (
    <section aria-label="종일·기간 일정" className={styles.section}>
      <button aria-controls="week-all-day-board" aria-expanded={expanded} className={styles.label} onClick={() => setExpanded((current) => !current)} type="button">
        <span>종일</span>
        {!expanded && <span className={styles.itemCount}>{itemCount}개</span>}
      </button>
      <div aria-hidden={!expanded} className={styles.boardShell} data-open={expanded} inert={!expanded}>
        <div className={styles.board} id="week-all-day-board" style={{ minHeight: expanded ? laneHeight : 0, '--calendar-day-count': dayCount } as CSSProperties}>
          {days.map(({ date, items: dayItems, row }) => {
          const topItem = dayItems[0];
          return (
            <div className={styles.day} key={date}>
              <div className={styles.dayContent} style={{ paddingTop: topItem ? 4 + row * 22 : 0 }}>
                {topItem && (
                  <div className={styles.eventGroup}>
                    <button aria-describedby={dayItems.length > 1 ? `all-day-overlap-${date}` : undefined} className={`${styles.dayItem} ${dayItems.length > 1 ? styles.withMore : ''}`} onClick={() => onOpen(topItem)} style={getColorStyle(topItem.display.id, topItem.display.categoryColor)} title={topItem.display.title} type="button">
                      {topItem.display.title}
                    </button>
                    {dayItems.length > 1 && <span className={styles.more}>+{dayItems.length - 1}</span>}
                    {dayItems.length > 1 && (
                      <div className={styles.overlapList} id={`all-day-overlap-${date}`} role="tooltip">
                        {dayItems.map((item) => (
                          <button className={styles.overlapItem} key={item.display.id} onClick={() => onOpen(item)} type="button">
                            <span>{item.display.title}</span>
                            {getEventTime(item)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
          })}
          {spans.map((span) => (
          <button
            aria-label={`${span.item.display.title}, 기간 일정`}
            className={`${styles.span} ${span.item.display.kind === 'window' ? styles.window : styles.deadline}`}
            key={span.item.display.id}
            onClick={() => onOpen(span.item)}
            style={{
              left: 'calc(' + (span.start / dayCount) * 100 + '% + 6px)',
              top: 4 + span.row * 22,
              width: 'calc(' + ((span.end - span.start + 1) / dayCount) * 100 + '% - 12px)',
              ...getColorStyle(span.item.display.id, span.item.display.categoryColor),
            }}
            title={span.item.display.title}
            type="button"
          >
            {span.item.display.title}
          </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function getColorStyle(id: string, categoryColor: ItemView['display']['categoryColor']): CSSProperties {
  const color = getStableItemColor(id);
  const paletteColor = categoryColor ? getTaskCategoryColor(categoryColor) : color;
  return { '--item-accent': paletteColor.color, '--item-accent-soft': paletteColor.soft } as CSSProperties;
}

function getEventTime(item: ItemView): string {
  const timing = item.display.timing;
  if (timing.type !== 'time') return '';
  const instant = timing.startAt ?? timing.endAt;
  if (!instant) return '';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timing.timeZone }).format(new Date(instant));
}

function isPeriod(item: ItemView): boolean {
  return item.display.kind === 'deadline' || item.display.kind === 'window';
}

function getPeriodSpans(dates: readonly string[], items: readonly ItemView[], timeZone: string): PeriodSpan[] {
  const weekStart = dates[0];
  const weekEnd = dates[dates.length - 1];
  if (!weekStart || !weekEnd) return [];
  const candidates = items.filter((item) => isPeriod(item) && !isItemDeleted(item)).flatMap((item) => {
    const timing = item.display.timing;
    let startDate: string;
    let endDate: string;
    if (timing.type === 'date') {
      startDate = timing.startDate ?? timing.endDate;
      endDate = timing.endDate;
    } else if (timing.type === 'time') {
      startDate = timing.startAt ? getLocalDate(Date.parse(timing.startAt), timeZone) : timing.endAt ? getLocalDate(Date.parse(timing.endAt), timeZone) : weekStart;
      endDate = timing.endAt ? getLocalDate(Date.parse(timing.endAt) - 1, timeZone) : startDate;
    } else {
      return [];
    }
    if (endDate < weekStart || startDate > weekEnd) return [];
    const clippedStart = startDate < weekStart ? weekStart : startDate;
    const clippedEnd = endDate > weekEnd ? weekEnd : endDate;
    return [{ item, start: dayDifference(weekStart, clippedStart), end: dayDifference(weekStart, clippedEnd) }];
  }).sort((first, second) => first.start - second.start || second.end - first.end || first.item.display.id.localeCompare(second.item.display.id));

  const rowEnds: number[] = [];
  return candidates.map((candidate) => {
    let row = rowEnds.findIndex((end) => end < candidate.start);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = candidate.end;
    return { ...candidate, row };
  });
}

function dayDifference(start: string, end: string): number {
  let cursor = start;
  for (let day = 0; day < 7; day++) {
    if (cursor === end) return day;
    cursor = shiftDate(cursor, 1);
  }
  return 6;
}
