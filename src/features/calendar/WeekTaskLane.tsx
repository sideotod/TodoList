'use client';

import type { ItemView } from '../../domain/items';
import { selectDailyTasks } from '../../domain/projections';
import { getTaskCategoryColor } from '../../domain/task-categories';
import styles from './WeekTaskLane.module.css';

export function WeekTaskLane({ dates, items, timeZone, onOpen, onToggle }: { dates: readonly string[]; items: readonly ItemView[]; timeZone: string; onOpen: (item: ItemView) => void; onToggle: (item: ItemView) => void }) {
  return (
    <section aria-label="할 일" className={styles.lane} style={{ '--calendar-day-count': dates.length } as React.CSSProperties}>
      <div className={styles.label}>할 일</div>
      <div className={styles.days}>{dates.map((date) => <ul aria-label={date + ' 할 일'} className={styles.day} key={date}>{selectDailyTasks(items, date, timeZone).map((item) => {
        if (item.display.kind !== 'task') return null;
        const color = getTaskCategoryColor(item.display.categoryColor).color;
        return <li data-complete={item.display.completion === 'completed'} key={item.display.id}><input aria-label={item.display.title + ' 완료'} checked={item.display.completion === 'completed'} onChange={() => onToggle(item)} type="checkbox" /><button onClick={() => onOpen(item)} style={{ '--task-accent': color } as React.CSSProperties} title={item.display.title} type="button">{item.display.title}</button></li>;
      })}</ul>)}</div>
    </section>
  );
}
