'use client';

import { Temporal } from '@js-temporal/polyfill';
import type { ItemKind } from '../../domain/items';
import { parseLocalDateTime } from '../../domain/time';
import type { FoldChoice, TimingMode } from './item-editor-types';
import { DateTimePickerInput } from './DateTimePickerInput';
import styles from './ItemEditor.module.css';

type ItemTimingFieldsProps = {
  kind: ItemKind;
  mode: TimingMode;
  unscheduled: boolean;
  startRequired: boolean;
  endRequired: boolean;
  hasWindowEnd: boolean;
  startDate: string;
  endDate: string;
  startClock: string;
  endClock: string;
  timeZone: string;
  startResolution: ReturnType<typeof parseLocalDateTime> | null;
  endResolution: ReturnType<typeof parseLocalDateTime> | null;
  startFold: FoldChoice;
  endFold: FoldChoice;
  errors: Record<string, string>;
  onMode: (value: 'date' | 'time') => void;
  onUnscheduled: (value: boolean) => void;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onStartClock: (value: string) => void;
  onEndClock: (value: string) => void;
  onStartFold: (value: FoldChoice) => void;
  onEndFold: (value: FoldChoice) => void;
};

export function ItemTimingFields(props: ItemTimingFieldsProps) {
  const { kind, mode, unscheduled, startRequired, endRequired, hasWindowEnd, startDate, endDate, startClock, endClock, timeZone, startResolution, endResolution, startFold, endFold, errors } = props;

  return (
    <>
      {kind !== 'task' && kind !== 'event' && (
        <fieldset className={styles.segment}>
          <legend className={styles.visuallyHidden}>날짜와 시각</legend>
          <label><input checked={mode === 'date'} onChange={() => props.onMode('date')} type="radio" /> 날짜</label>
          <label><input checked={mode === 'time'} onChange={() => props.onMode('time')} type="radio" /> 정확한 시각</label>
        </fieldset>
      )}
      {kind === 'task' && (
        <div className={styles.taskTiming}>
          {!unscheduled && (
            <div className={styles.field}>
              <span>날짜</span>
              <DateTimePickerInput invalid={Boolean(errors['timing.endDate'])} kind="date" label="날짜" onChange={props.onEndDate} value={endDate} />
              {errors['timing.endDate'] && <span className={styles.fieldError}>{errors['timing.endDate']}</span>}
            </div>
          )}
        </div>
      )}

      {kind !== 'task' && !unscheduled && mode === 'date' && (
        <div className={styles.dateGrid}>
          {startRequired && <div className={styles.field}><span>시작일</span><DateTimePickerInput kind="date" label="시작일" onChange={props.onStartDate} value={startDate} />{errors['timing.startDate'] && <span className={styles.fieldError}>{errors['timing.startDate']}</span>}</div>}
          {(kind === 'event' || endRequired) && <div className={styles.field}>
            <span>종료일</span>
            <DateTimePickerInput kind="date" label="종료일" onChange={props.onEndDate} value={endDate} />
            {errors['timing.endDate'] && <span className={styles.fieldError}>{errors['timing.endDate']}</span>}
          </div>}
        </div>
      )}

      {kind !== 'task' && !unscheduled && mode === 'time' && (
        <div className={styles.dateGrid}>
          {startRequired && <TimeFields label="시작" date={startDate} clock={startClock} timeZone={timeZone} resolution={startResolution} choice={startFold} error={errors['timing.timeZone'] ? undefined : errors['timing.startAt']} onDate={props.onStartDate} onClock={props.onStartClock} onChoice={props.onStartFold} />}
          {endRequired && <TimeFields label="종료" date={endDate} clock={endClock} timeZone={timeZone} resolution={endResolution} choice={endFold} error={errors['timing.timeZone'] ? undefined : errors['timing.endAt']} onDate={props.onEndDate} onClock={props.onEndClock} onChoice={props.onEndFold} />}
          {kind === 'window' && hasWindowEnd && <TimeFields label="종료" date={endDate} clock={endClock} timeZone={timeZone} resolution={endResolution} choice={endFold} error={errors['timing.timeZone'] ? undefined : errors['timing.endAt']} onDate={props.onEndDate} onClock={props.onEndClock} onChoice={props.onEndFold} />}
        </div>
      )}

    </>
  );
}

function TimeFields({ label, date, clock, timeZone, resolution, choice, error, onDate, onClock, onChoice }: {
  label: string;
  date: string;
  clock: string;
  timeZone: string;
  resolution: ReturnType<typeof parseLocalDateTime> | null;
  choice: FoldChoice;
  error?: string;
  onDate: (value: string) => void;
  onClock: (value: string) => void;
  onChoice: (value: FoldChoice) => void;
}) {
  return (
    <fieldset className={styles.timeFields}>
      <legend>{label}</legend>
      <div className={styles.dateTimeRow}>
        <div className={styles.field}><span className={styles.visuallyHidden}>{label} 날짜</span><DateTimePickerInput kind="date" label={`${label} 날짜`} onChange={(next) => { onDate(next); onChoice(null); }} value={date} /></div>
        <div className={styles.field}><span className={styles.visuallyHidden}>{label} 시각</span><DateTimePickerInput kind="time" label={`${label} 시각`} onChange={(next) => { onClock(next); onChoice(null); }} value={clock} /></div>
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
      {resolution?.status === 'invalid' && resolution.reason === 'nonexistent-time' && <p className={styles.fieldError}>이 날짜에는 입력한 시각이 없습니다. 다른 시각을 선택해 주세요.</p>}
      {resolution?.status === 'ambiguous' && (
        <fieldset className={styles.foldChoices}>
          <legend>중복되는 시각입니다. 어느 쪽인가요?</legend>
          <label><input checked={choice === 'earlier'} onChange={() => onChoice('earlier')} type="radio" /> 첫 번째 시각 ({getOffset(resolution.earlier, timeZone)})</label>
          <label><input checked={choice === 'later'} onChange={() => onChoice('later')} type="radio" /> 두 번째 시각 ({getOffset(resolution.later, timeZone)})</label>
        </fieldset>
      )}
    </fieldset>
  );
}

export function TaskTimeInput({ endClock, endFold, endResolution, error, onEndClock, onEndFold, timeZone }: {
  endClock: string;
  endFold: FoldChoice;
  endResolution: ReturnType<typeof parseLocalDateTime> | null;
  error?: string;
  onEndClock: (value: string) => void;
  onEndFold: (value: FoldChoice) => void;
  timeZone: string;
}) {
  return (
    <div className={`${styles.field} ${styles.taskClockField}`}>
      <DateTimePickerInput invalid={Boolean(error)} kind="time" label="마감 시각" onChange={onEndClock} value={endClock} />
      {error && <span className={styles.fieldError}>{error}</span>}
      {endResolution?.status === 'invalid' && endResolution.reason === 'nonexistent-time' && <span className={styles.fieldError}>이 날짜에는 입력한 시각이 없습니다. 다른 시각을 선택해 주세요.</span>}
      {endResolution?.status === 'ambiguous' && (
        <fieldset className={styles.foldChoices}>
          <legend>중복되는 시각입니다. 어느 쪽인가요?</legend>
          <label><input checked={endFold === 'earlier'} onChange={() => onEndFold('earlier')} type="radio" /> 첫 번째 시각 ({getOffset(endResolution.earlier, timeZone)})</label>
          <label><input checked={endFold === 'later'} onChange={() => onEndFold('later')} type="radio" /> 두 번째 시각 ({getOffset(endResolution.later, timeZone)})</label>
        </fieldset>
      )}
    </div>
  );
}

function getOffset(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).offset;
}
