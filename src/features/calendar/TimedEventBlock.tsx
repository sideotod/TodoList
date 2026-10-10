'use client';

import type { CSSProperties, MouseEvent } from 'react';
import { getEventCountdown } from '../../domain/time';
import type { ItemView } from '../../domain/items';
import { getStableItemColor, getTaskCategoryColor } from '../../domain/task-categories';
import styles from './TimedEventBlock.module.css';

type TimedEventBlockProps = {
  item: ItemView;
  startMinute: number;
  endMinute: number;
  column: number;
  columnCount: number;
  visibleStartMinute: number;
  pixelsPerMinute: number;
  timeFormat: '24h' | '12h';
  hasEnd: boolean;
  nowMs: number;
  onOpen: (item: ItemView) => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function TimedEventBlock({ item, startMinute, endMinute, column, columnCount, visibleStartMinute, pixelsPerMinute, timeFormat, hasEnd, nowMs, onOpen, onClick }: TimedEventBlockProps) {
  const top = (startMinute - visibleStartMinute) * pixelsPerMinute;
  const height = Math.max(20, (endMinute - startMinute) * pixelsPerMinute);
  const timeLabel = hasEnd ? `${formatMinute(startMinute, timeFormat)}–${formatMinute(endMinute, timeFormat)}` : `${formatMinute(startMinute, timeFormat)} 시작`;
  const countdown = getEventCountdown(item.display, nowMs);
  const countdownLabel = countdown.kind === 'hidden' ? '' : countdown.text;
  const countdownIsUrgent = countdown.kind === 'hours-minutes' || countdown.kind === 'minutes-seconds' || countdown.kind !== 'hidden' && countdown.text === 'D-1';
  const countdownUrgency = countdownIsUrgent && item.display.kind === 'event' && item.display.countdown?.reference === 'end' ? 'end' : countdownIsUrgent ? 'start' : 'normal';
  const color = getItemColor(item);
  const style = {
    top,
    height,
    left: `calc(${(column / columnCount) * 100}% + 3px)`,
    width: `calc(${100 / columnCount}% - 7px)`,
    '--item-accent': color.color,
    '--item-accent-soft': color.soft,
  } as CSSProperties;

  return (
    <button aria-label={`${item.display.title} ${timeLabel}${countdownLabel ? ` · ${countdownLabel}` : ''}`} className={`${styles.block} ${height < 52 ? styles.compact : ''} ${height < 36 ? styles.short : ''}`} onClick={(event) => { event.stopPropagation(); onClick?.(event); onOpen(item); }} style={style} type="button">
      <strong>{item.display.title}</strong>
      {countdownLabel && <span className={styles.countdown} data-countdown-urgency={countdownUrgency}>{countdownLabel}</span>}
      <span>{timeLabel}</span>
    </button>
  );
}

type TimedOverlapGroupProps = {
  items: readonly { item: ItemView; startMinute: number; endMinute: number }[];
  startMinute: number;
  endMinute: number;
  visibleStartMinute: number;
  pixelsPerMinute: number;
  timeFormat: '24h' | '12h';
  onOpen: (item: ItemView) => void;
};

export function TimedOverlapGroup({ items, startMinute, endMinute, visibleStartMinute, pixelsPerMinute, timeFormat, onOpen }: TimedOverlapGroupProps) {
  const firstItem = items[0]?.item;
  if (!firstItem) return null;
  const firstColor = getItemColor(firstItem);
  const top = (startMinute - visibleStartMinute) * pixelsPerMinute;
  const height = Math.max(34, (endMinute - startMinute) * pixelsPerMinute);
  const timeLabel = `${formatMinute(startMinute, timeFormat)}–${formatMinute(endMinute, timeFormat)}`;

  return (
    <div className={styles.overlapGroup} style={{ top, height, '--item-accent': firstColor.color, '--item-accent-soft': firstColor.soft } as CSSProperties}>
      <button aria-describedby={`timed-overlap-${firstItem.display.id}`} aria-label={`겹친 일정 ${items.length}개, ${timeLabel}`} className={styles.overlapSummary} onClick={(event) => { event.stopPropagation(); onOpen(firstItem); }} type="button">
        <span>겹친 일정 {items.length}개</span>
        <span className={styles.overlapDots} aria-hidden="true">
          {items.slice(0, 3).map((segment, index) => <span className={styles.overlapDot} key={`${segment.item.display.id}-${index}`} style={{ backgroundColor: getItemColor(segment.item).color }} />)}
          {items.length > 3 && <small>+{items.length - 3}</small>}
        </span>
        <span className={styles.overlapTime}>{timeLabel}</span>
      </button>
      <div className={styles.overlapList} id={`timed-overlap-${firstItem.display.id}`} role="tooltip">
        {items.map((segment) => (
          <button className={styles.overlapItem} key={segment.item.display.id} onClick={(event) => { event.stopPropagation(); onOpen(segment.item); }} type="button">
            <strong>{segment.item.display.title}</strong>
          <span>{'hasEnd' in segment && !segment.hasEnd ? `${formatMinute(segment.startMinute, timeFormat)} 시작` : `${formatMinute(segment.startMinute, timeFormat)}–${formatMinute(segment.endMinute, timeFormat)}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getItemColor(item: ItemView) {
  return item.display.categoryColor ? getTaskCategoryColor(item.display.categoryColor) : getStableItemColor(item.display.id);
}

function formatMinute(value: number, format: '24h' | '12h'): string {
  const hour = Math.floor(value / 60) % 24;
  const minute = value % 60;
  if (format === '24h') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
}
