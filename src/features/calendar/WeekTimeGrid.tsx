'use client';

import { Temporal } from '@js-temporal/polyfill';
import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { isItemDeleted } from '../../domain/projections';
import { getWeeklyOccurrenceForDate } from '../../domain/recurrence';
import { groupOverlappingTimedEvents } from './weekly-layout';
import { TimedEventBlock, TimedOverlapGroup } from './TimedEventBlock';
import styles from './WeekTimeGrid.module.css';

const PIXELS_PER_HOUR = 42;

type WeekTimeGridProps = {
  dates: readonly string[];
  today: string;
  items: readonly ItemView[];
  timeZone: string;
  timeFormat: '24h' | '12h';
  nowMs: number;
  visibleStartHour: number;
  visibleEndHour: number;
  onOpen: (item: ItemView) => void;
  onAdd: (date: string, startTime: string) => void;
};

type EventSegment = { item: ItemView; startMinute: number; endMinute: number; hasEnd: boolean };

export function WeekTimeGrid({ dates, today, items, timeZone, timeFormat, nowMs, visibleStartHour, visibleEndHour, onOpen, onAdd }: WeekTimeGridProps) {
  const startMinute = visibleStartHour * 60;
  const endMinute = visibleEndHour * 60;
  const pixelsPerMinute = PIXELS_PER_HOUR / 60;
  const canvasHeight = (visibleEndHour - visibleStartHour) * PIXELS_PER_HOUR;

  const segments = useMemo(() => dates.map((date) => getSegmentsForDate(items, date, timeZone)), [dates, items, timeZone]);
  const groupedEvents = segments.map(groupOverlappingTimedEvents);
  const hours = Array.from({ length: visibleEndHour - visibleStartHour + 1 }, (_, index) => visibleStartHour + index);
  const currentTime = Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(timeZone);
  const currentDate = currentTime.toPlainDate().toString();
  const currentMinute = currentTime.hour * 60 + currentTime.minute;
  const showCurrentTime = currentMinute >= startMinute && currentMinute < endMinute;
  const showCurrentTimeLabel = showCurrentTime
    && dates.includes(currentDate)
    && currentTime.minute >= 20
    && currentTime.minute <= 40;
  const currentTimeLabel = formatClock(currentTime.hour, currentTime.minute, timeFormat);

  function addFromPosition(date: string, event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const minuteOffset = Math.max(0, Math.min(canvasHeight, event.clientY - bounds.top)) / pixelsPerMinute;
    const minute = Math.max(startMinute, Math.min(endMinute - 15, startMinute + Math.floor(minuteOffset / 15) * 15));
    onAdd(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }

  return (
    <section aria-label="시간 일정" className={styles.section}>
      <div aria-hidden="true" className={styles.timeLabels} style={{ height: canvasHeight }}>
        {hours.map((hour) => <span data-edge={hour === visibleStartHour ? 'start' : hour === visibleEndHour ? 'end' : undefined} key={hour} style={{ top: (hour - visibleStartHour) * PIXELS_PER_HOUR }}>{formatHour(hour, timeFormat)}</span>)}
        {showCurrentTimeLabel && <span className={styles.currentTimeLabel} style={{ top: (currentMinute - startMinute) * pixelsPerMinute }}>{currentTimeLabel}</span>}
      </div>
      <div className={styles.columns}>
        {dates.map((date, dayIndex) => (
          <div className={styles.column} data-today={date === today} key={date}>
            <div aria-label={`${date} 일정 추가`} className={styles.canvas} onClick={(event) => addFromPosition(date, event)} style={{ height: canvasHeight }}>
              {hours.slice(0, -1).map((hour) => <span aria-hidden="true" className={styles.hourLine} data-major={hour % 2 === 0} key={hour} style={{ top: (hour - visibleStartHour) * PIXELS_PER_HOUR }} />)}
              {date === today && showCurrentTime && <span aria-hidden="true" className={styles.currentTimeLine} style={{ top: (currentMinute - startMinute) * pixelsPerMinute }} />}
              {groupedEvents[dayIndex].map((group) => {
                if (group.endMinute <= startMinute || group.startMinute >= endMinute) return null;
                const clippedStart = Math.max(group.startMinute, startMinute);
                const clippedEnd = Math.min(group.endMinute, endMinute);
                if (group.items.length > 1) {
                  return (
                    <TimedOverlapGroup
                      endMinute={clippedEnd}
                      items={group.items}
                      key={group.items.map((segment) => segment.item.display.id).join(':')}
                      onOpen={onOpen}
                      pixelsPerMinute={pixelsPerMinute}
                      startMinute={clippedStart}
                      timeFormat={timeFormat}
                      visibleStartMinute={startMinute}
                    />
                  );
                }
                const segment = group.items[0];
                if (!segment) return null;
                return (
                  <TimedEventBlock
                    column={0}
                    columnCount={1}
                    endMinute={Math.min(endMinute, segment.endMinute)}
                    item={segment.item}
                    key={segment.item.display.id}
                    onOpen={onOpen}
                    pixelsPerMinute={pixelsPerMinute}
                    startMinute={Math.max(startMinute, segment.startMinute)}
                    timeFormat={timeFormat}
                    hasEnd={segment.hasEnd}
                    nowMs={nowMs}
                    visibleStartMinute={startMinute}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getSegmentsForDate(items: readonly ItemView[], date: string, timeZone: string): EventSegment[] {
  const dayStart = Temporal.PlainDate.from(date).toZonedDateTime(timeZone).toInstant();
  const dayEnd = Temporal.PlainDate.from(date).add({ days: 1 }).toZonedDateTime(timeZone).toInstant();
  const segments: EventSegment[] = [];
  const dayItems = items.flatMap((item) => {
    if (item.display.kind !== 'event' || !item.display.recurrence) return [item];
    const occurrence = getWeeklyOccurrenceForDate(item, date);
    return occurrence ? [occurrence] : [];
  });
  for (const item of dayItems) {
    if (item.display.kind !== 'event' || item.display.timing.type !== 'time' || isItemDeleted(item)) continue;
    const start = Temporal.Instant.from(item.display.timing.startAt);
    const hasEnd = item.display.timing.endAt !== null;
    if (!hasEnd && Temporal.Instant.compare(start, dayStart) < 0) continue;
    const end = hasEnd
      ? Temporal.Instant.from(item.display.timing.endAt!)
      : start.add({ minutes: 30 });
    const clippedStart = Temporal.Instant.compare(start, dayStart) < 0 ? dayStart : start;
    const clippedEnd = Temporal.Instant.compare(end, dayEnd) > 0 ? dayEnd : end;
    if (Temporal.Instant.compare(clippedStart, clippedEnd) >= 0) continue;
    const startZoned = clippedStart.toZonedDateTimeISO(timeZone);
    const endZoned = clippedEnd.toZonedDateTimeISO(timeZone);
    segments.push({
      item,
      startMinute: startZoned.hour * 60 + startZoned.minute,
      endMinute: endZoned.toPlainDate().toString() !== date ? 24 * 60 : endZoned.hour * 60 + endZoned.minute,
      hasEnd,
    });
  }
  return segments;
}

function formatHour(hour: number, format: '24h' | '12h'): string {
  if (format === '24h') return `${String(hour).padStart(2, '0')}:00`;
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:00`;
}

function formatClock(hour: number, minute: number, format: '24h' | '12h'): string {
  if (format === '24h') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
}
