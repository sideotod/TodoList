'use client';

import { useEffect, useRef } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { ItemView } from '../../domain/items';
import type { ReminderOffset } from '../../lib/local-preview-store';

type LocalReminderSchedulerProps = {
  enabled: boolean;
  items: readonly ItemView[];
  offsets: Readonly<Record<string, ReminderOffset>>;
};

export function LocalReminderScheduler({ enabled, items, offsets }: LocalReminderSchedulerProps) {
  const fired = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const appStartedAt = Date.now();

    function checkDueReminders() {
      const now = Date.now();
      for (const item of items) {
        const offset = offsets[item.display.id];
        if (offset === undefined || item.display.kind === 'event' || isCompleted(item) || item.display.timing.type === 'unscheduled') continue;
        const target = getTargetMs(item);
        if (target === null) continue;
        const dueAt = target - offset * 60_000;
        const key = `${item.display.id}:${offset}:${target}`;
        if (dueAt < appStartedAt || dueAt > now || now - dueAt > 60_000 || fired.current.has(key)) continue;
        fired.current.add(key);
        const endpoint = item.display.kind === 'window' ? '시작' : '마감';
        const lead = offset === 0 ? `${endpoint} 시각입니다.` : `${formatOffset(offset)} 뒤 ${endpoint}됩니다.`;
        new Notification(item.display.title, { body: lead, icon: '/icons/app-icon-192.png', tag: key });
      }
    }

    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 10_000);
    return () => window.clearInterval(timer);
  }, [enabled, items, offsets]);

  return null;
}

function getTargetMs(item: ItemView): number | null {
  const timing = item.display.timing;
  if (timing.type === 'time') {
    const instant = item.display.kind === 'event' || item.display.kind === 'window' ? timing.startAt : timing.endAt;
    return instant ? Date.parse(instant) : null;
  }
  if (timing.type !== 'date') return null;
  const date = item.display.kind === 'event' || item.display.kind === 'window' ? timing.startDate : timing.endDate;
  if (!date) return null;
  try {
    return Temporal.PlainDate.from(date).toZonedDateTime({
      timeZone: timing.timeZone,
      plainTime: Temporal.PlainTime.from('09:00'),
    }).epochMilliseconds;
  } catch {
    return null;
  }
}

function isCompleted(item: ItemView): boolean {
  return 'completion' in item.display && item.display.completion === 'completed';
}

function formatOffset(offset: ReminderOffset): string {
  if (offset === 1440) return '24시간';
  if (offset === 60) return '1시간';
  if (offset === 30) return '30분';
  return `${offset}분`;
}
