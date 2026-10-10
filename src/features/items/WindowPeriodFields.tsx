'use client';

import { ItemTimingFields } from './ItemTimingFields';
import styles from './ItemEditor.module.css';

type WindowPeriodFieldsProps = Omit<Parameters<typeof ItemTimingFields>[0], 'kind' | 'startRequired' | 'endRequired'> & {
  countdownEnabled: boolean;
  daysBefore: number;
  errors: Record<string, string>;
  hasWindowEnd: boolean;
  showTiming?: boolean;
  onWindowEnd: (value: boolean) => void;
  onCountdownEnabled: (value: boolean) => void;
  onDaysBefore: (value: number) => void;
};

export function WindowPeriodFields({ countdownEnabled, daysBefore, errors, hasWindowEnd, showTiming = true, onWindowEnd, onCountdownEnabled, onDaysBefore, ...timing }: WindowPeriodFieldsProps) {
  return (
    <>
      {showTiming && timing.mode === 'time' && (
        <label className={styles.switch}>
          <input checked={hasWindowEnd} onChange={(event) => onWindowEnd(event.currentTarget.checked)} type="checkbox" />
          <span>종료 시각도 기록</span>
        </label>
      )}
      {showTiming && <ItemTimingFields {...timing} errors={errors} kind="window" startRequired endRequired={false} hasWindowEnd={hasWindowEnd} />}
      <section className={styles.countdown} aria-label="시작 카운트다운 표시 설정">
        <label className={styles.switch}><input checked={countdownEnabled} onChange={(event) => onCountdownEnabled(event.currentTarget.checked)} type="checkbox" /><span>시작 카운트다운 표시</span></label>
        <div aria-hidden={!countdownEnabled} className={styles.countdownReveal} data-open={countdownEnabled} inert={!countdownEnabled}>
          <div className={styles.countdownRevealInner}>
            <label className={styles.daysBefore}>시작 <input aria-label="카운트다운 표시 시작 일 전부터 표시" max="30" min="0" onChange={(event) => onDaysBefore(Number(event.currentTarget.value))} type="number" value={daysBefore} />일 전부터 표시</label>
            {errors.daysBefore && <span className={styles.fieldError}>{errors.daysBefore}</span>}
          </div>
        </div>
      </section>
    </>
  );
}
