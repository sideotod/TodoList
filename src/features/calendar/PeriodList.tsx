import type { ItemView } from '../../domain/items';
import { Temporal } from '@js-temporal/polyfill';
import { selectPeriodGroups } from '../../domain/projections';
import styles from './PeriodList.module.css';

type PeriodListProps = { items: readonly ItemView[]; nowMs: number; onOpen?: (item: ItemView) => void };
const GROUPS = [
  ['scheduled', '예정'],
  ['active', '진행 중'],
  ['overdue', '기한 경과'],
  ['completed', '완료'],
] as const;

export function PeriodList({ items, nowMs, onOpen }: PeriodListProps) {
  const groups = selectPeriodGroups(items, nowMs);
  const hasPeriods = GROUPS.some(([key]) => groups[key].length > 0);

  return (
    <section className={styles.section} aria-label="기간별 일정">
      {hasPeriods ? GROUPS.map(([key, label]) => (
        groups[key].length > 0 && (
          <div className={styles.group} key={key}>
            <h2>{label}</h2>
            <ul>
              {groups[key].map((item) => (
                <li key={item.display.id}>
                  <div className={styles.itemCopy}>
                    {onOpen ? <button className={styles.title} onClick={() => onOpen(item)} type="button">{item.display.title}</button> : <span className={styles.title}>{item.display.title}</span>}
                    <span className={styles.date}>{formatPeriodDate(item)}</span>
                  </div>
                  <div className={styles.badges}>
                    {item.display.kind === 'window' && <span className={styles.kind}>신청 기간</span>}
                    {item.display.kind === 'deadline' && <span className={styles.kind}>마감</span>}
                    {item.display.completion === 'completed' && <span className={styles.status}>완료</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      )) : <p className={styles.empty}>등록된 기간이 없습니다.</p>}
    </section>
  );
}

function formatPeriodDate(item: ItemView): string {
  const timing = item.display.timing;
  if (timing.type === 'unscheduled') return '날짜 미정';
  if (timing.type === 'date') {
    const start = timing.startDate ?? timing.endDate;
    return timing.endDate === start ? formatDate(start) : `${formatDate(start)}–${formatDate(timing.endDate)}`;
  }

  const start = timing.startAt ? Temporal.Instant.from(timing.startAt).toZonedDateTimeISO(timing.timeZone) : null;
  const end = timing.endAt ? Temporal.Instant.from(timing.endAt).toZonedDateTimeISO(timing.timeZone) : null;
  if (!start && !end) return '날짜 미정';
  if (!start) return `${formatZonedDate(end!)}`;
  if (!end) return `${formatZonedDate(start)}`;
  const sameDate = start.toPlainDate().equals(end.toPlainDate());
  return sameDate
    ? `${formatZonedDate(start)} ${formatClock(start)}–${formatClock(end)}`
    : `${formatZonedDate(start)} ${formatClock(start)}–${formatZonedDate(end)} ${formatClock(end)}`;
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}.${day}`;
}

function formatZonedDate(date: Temporal.ZonedDateTime): string {
  return `${date.month}.${date.day}`;
}

function formatClock(date: Temporal.ZonedDateTime): string {
  return `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`;
}
