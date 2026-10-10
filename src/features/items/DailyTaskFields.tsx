'use client';

import styles from './ItemEditor.module.css';
import { DateTimePickerInput } from './DateTimePickerInput';

type DailyTaskFieldsProps = {
  endDate: string;
  errors: Record<string, string>;
  unscheduled: boolean;
  onEndDate: (value: string) => void;
};

export function DailyTaskFields({ endDate, errors, unscheduled, onEndDate }: DailyTaskFieldsProps) {
  return (
    <div className={styles.taskTiming}>
      {!unscheduled && (
        <div className={styles.field}>
          <span>날짜</span>
          <DateTimePickerInput invalid={Boolean(errors['timing.endDate'])} kind="date" label="날짜" onChange={onEndDate} value={endDate} />
          {errors['timing.endDate'] && <span className={styles.fieldError}>{errors['timing.endDate']}</span>}
        </div>
      )}
    </div>
  );
}
