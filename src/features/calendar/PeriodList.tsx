import type { ItemView } from '../../domain/items';
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
                  {onOpen ? <button className={styles.title} onClick={() => onOpen(item)} type="button">{item.display.title}</button> : <span className={styles.title}>{item.display.title}</span>}
                  {item.display.kind === 'window' && <span className={styles.kind}>신청 기간</span>}
                  {item.display.kind === 'deadline' && <span className={styles.kind}>마감</span>}
                  {item.display.completion === 'completed' && <span className={styles.status}>완료</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      )) : <p className={styles.empty}>등록된 기간이 없습니다.</p>}
    </section>
  );
}
