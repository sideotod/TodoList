'use client';

import { ItemTimingFields } from './ItemTimingFields';
import styles from './ItemEditor.module.css';

type DeadlinePeriodFieldsProps = Omit<Parameters<typeof ItemTimingFields>[0], 'kind' | 'startRequired' | 'endRequired' | 'hasWindowEnd'> & {
  countdownEnabled: boolean;
  daysBefore: number;
  errors: Record<string, string>;
  hasDeadlineStart: boolean;
  showTiming?: boolean;
  selectedDate: string;
  onDeadlineStart: (value: boolean) => void;
  onCountdownEnabled: (value: boolean) => void;
  onDaysBefore: (value: number) => void;
};

export function DeadlinePeriodFields({ countdownEnabled, daysBefore, errors, hasDeadlineStart, showTiming = true, selectedDate, onDeadlineStart, onCountdownEnabled, onDaysBefore, onStartDate, onStartClock, ...timing }: DeadlinePeriodFieldsProps) {
  return (
    <>
      {showTiming && <label className={styles.switch}>
        <input checked={hasDeadlineStart} onChange={(event) => {
          onDeadlineStart(event.currentTarget.checked);
          if (event.currentTarget.checked && !timing.startDate) onStartDate(selectedDate);
          if (event.currentTarget.checked) onStartClock('');
        }} type="checkbox" />
        <span>기간 시작일도 기록</span>
      </label>}
      {showTiming && <ItemTimingFields {...timing} errors={errors} onStartDate={onStartDate} onStartClock={onStartClock} kind="deadline" startRequired={hasDeadlineStart} endRequired hasWindowEnd={false} />}
      {hasDeadlineStart && (
        <section className={styles.countdown} aria-label="시작 카운트다운 표시 설정">
          <label className={styles.switch}><input checked={countdownEnabled} onChange={(event) => onCountdownEnabled(event.currentTarget.checked)} type="checkbox" /><span>시작 카운트다운 표시</span></label>
          <div aria-hidden={!countdownEnabled} className={styles.countdownReveal} data-open={countdownEnabled} inert={!countdownEnabled}>
            <div className={styles.countdownRevealInner}>
              <label className={styles.daysBefore}>시작 <input aria-label="카운트다운 표시 시작 일 전부터 표시" max="30" min="0" onChange={(event) => onDaysBefore(Number(event.currentTarget.value))} type="number" value={daysBefore} />일 전부터 표시</label>
              {errors.daysBefore && <span className={styles.fieldError}>{errors.daysBefore}</span>}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
