import type { Completion, EventCountdown, ItemKind, PeriodChecklistItem, ProposedCalendarItem, WeeklyRecurrence } from '../../domain/items';
import type { TaskCategoryColor } from '../../domain/task-categories';
import { Temporal } from '@js-temporal/polyfill';
import { parseLocalDateTime } from '../../domain/time';
import type { FoldChoice, TimingMode } from './item-editor-types';

// Only a new event can become a period; editing must retain the original kind.
export function getEffectiveItemKind(initialKind: ItemKind | null, defaultKind: ItemKind, multiDay: boolean, focus: 'start' | 'deadline'): ItemKind {
  if (initialKind) return initialKind;
  return defaultKind === 'event' && multiDay ? focus === 'start' ? 'window' : 'deadline' : defaultKind;
}

export type BuildInput = {
  initial?: ProposedCalendarItem | null;
  timingChanged?: boolean; categoryChanged?: boolean; countdownChanged?: boolean; displayChanged?: boolean;
  id: string; kind: ItemKind; title: string; category: string; categoryColor: TaskCategoryColor; notes: string; sourceUrl: string;
  mode: TimingMode; timeZone: string; startDate: string; endDate: string; startClock: string; endClock: string;
  startResolution: ReturnType<typeof parseLocalDateTime> | null; endResolution: ReturnType<typeof parseLocalDateTime> | null;
  startFold: FoldChoice; endFold: FoldChoice; hasEventEnd: boolean; recurrence?: WeeklyRecurrence;
  focus?: 'start' | 'deadline';
  hasDeadlineStart: boolean; hasWindowEnd: boolean;
  includeEventColor: boolean;
  showInProgressSummary: boolean;
  completion: Completion; checklist: PeriodChecklistItem[]; countdownEnabled: boolean; daysBefore: number;
  eventCountdownReference: EventCountdown['reference'];
  onFieldError: (path: string, message: string) => void;
};

export function buildProposal(input: BuildInput): ProposedCalendarItem {
  const initial = input.initial;
  const common = {
    id: input.id,
    title: input.title,
    ...(initial && !input.categoryChanged
      ? { ...('category' in initial ? { category: initial.category } : {}), ...('categoryColor' in initial ? { categoryColor: initial.categoryColor } : {}) }
      : { ...(input.category.trim() ? { category: input.category.trim() } : {}), ...((input.kind === 'task' && input.category.trim()) || input.includeEventColor ? { categoryColor: input.categoryColor } : {}) }),
    ...(initial && input.notes === (initial.notes ?? '') ? 'notes' in initial ? { notes: initial.notes } : {} : input.notes ? { notes: input.notes } : {}),
    ...(initial && input.sourceUrl === (initial.sourceUrl ?? '') ? 'sourceUrl' in initial ? { sourceUrl: initial.sourceUrl } : {} : input.sourceUrl.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}),
    ...(initial && 'importSource' in initial ? { importSource: initial.importSource } : {}),
  };
  if (input.kind === 'event') {
    const timing = initial?.kind === 'event' && !input.timingChanged ? initial.timing : input.mode === 'date'
      ? { type: 'date' as const, startDate: input.startDate, endDate: input.endDate, timeZone: input.timeZone }
      : {
          type: 'time' as const,
          startAt: resolveInstant(input, 'start'),
          endAt: input.hasEventEnd ? resolveInstant(input, 'end') : null,
          timeZone: input.timeZone,
        };
    return {
      ...common,
      kind: 'event',
      ...(initial?.kind === 'event' && !input.displayChanged ? 'showInProgressSummary' in initial ? { showInProgressSummary: initial.showInProgressSummary } : {} : { showInProgressSummary: input.showInProgressSummary }),
      ...(input.recurrence ? { recurrence: input.recurrence } : {}),
      ...(initial?.kind === 'event' && !input.countdownChanged ? 'countdown' in initial ? { countdown: initial.countdown } : {} : { countdown: { enabled: input.countdownEnabled, daysBefore: input.daysBefore, reference: input.eventCountdownReference } }),
      timing,
    };
  }
  if (input.kind === 'task') {
    if (initial?.kind === 'task' && !input.timingChanged) return { ...common, kind: 'task', timing: initial.timing, completion: input.completion };
    if (input.mode === 'unscheduled') return { ...common, kind: 'task', timing: { type: 'unscheduled' }, completion: input.completion };
    if (input.mode === 'date') return { ...common, kind: 'task', timing: { type: 'date', startDate: null, endDate: input.endDate, timeZone: input.timeZone }, completion: input.completion };
    return { ...common, kind: 'task', timing: { type: 'time', startAt: null, endAt: resolveInstant(input, 'end'), timeZone: input.timeZone }, completion: input.completion };
  }
  const countdown = initial && (initial.kind === 'window' || initial.kind === 'deadline') && !input.countdownChanged && !input.timingChanged
    ? initial.startCountdown : { enabled: input.countdownEnabled, daysBefore: input.daysBefore };
  const completion = input.completion;
  if (input.kind === 'deadline') {
    const timing = initial?.kind === 'deadline' && !input.timingChanged ? initial.timing : input.mode === 'date'
      ? { type: 'date' as const, startDate: input.hasDeadlineStart ? input.startDate || null : null, endDate: input.endDate, timeZone: input.timeZone }
      : { type: 'time' as const, startAt: input.hasDeadlineStart ? resolveInstant(input, 'start') : null, endAt: resolveInstant(input, 'end'), timeZone: input.timeZone };
    const startPresent = timing.type === 'date' ? timing.startDate !== null : timing.startAt !== null;
    return { ...common, kind: 'deadline', ...(input.focus ? { focus: input.focus } : {}), timing, completion, checklist: input.checklist, startCountdown: startPresent ? countdown : null };
  }
  const timing = initial?.kind === 'window' && !input.timingChanged ? initial.timing : input.mode === 'date'
    ? { type: 'date' as const, startDate: input.startDate, endDate: input.endDate, timeZone: input.timeZone }
    : { type: 'time' as const, startAt: resolveInstant(input, 'start'), endAt: input.hasWindowEnd ? resolveInstant(input, 'end') : null, timeZone: input.timeZone };
  return { ...common, kind: 'window', ...(input.focus ? { focus: input.focus } : {}), timing, completion, checklist: input.checklist, startCountdown: countdown ?? { enabled: input.countdownEnabled, daysBefore: input.daysBefore } };
}

function resolveInstant(input: BuildInput, part: 'start' | 'end'): string {
  const resolution = part === 'start' ? input.startResolution : input.endResolution;
  const choice = part === 'start' ? input.startFold : input.endFold;
  const path = part === 'start' ? 'timing.startAt' : 'timing.endAt';
  const originalTiming = input.initial?.timing;
  if (originalTiming?.type === 'time' && originalTiming.timeZone === input.timeZone) {
    const original = part === 'start' ? originalTiming.startAt : originalTiming.endAt;
    if (original) {
      const instant = Temporal.Instant.from(original);
      const local = instant.toZonedDateTimeISO(input.timeZone);
      const date = part === 'start' ? input.startDate : input.endDate;
      const clock = part === 'start' ? input.startClock : input.endClock;
      const originalClock = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
      const sameFold = resolution?.status !== 'ambiguous' || !choice
        || Math.floor(instant.epochMilliseconds / 60_000) === Math.floor(Temporal.Instant.from(choice === 'later' ? resolution.later : resolution.earlier).epochMilliseconds / 60_000);
      // The UI edits minutes; preserve an untouched instant's seconds and original fold.
      if (date === local.toPlainDate().toString() && clock === originalClock && sameFold) return original;
    }
  }
  if (!resolution || resolution.status === 'invalid') {
    input.onFieldError(path, resolution?.status === 'invalid' && resolution.reason === 'unknown-zone' ? '유효한 IANA 시간대를 입력해 주세요.' : '날짜와 시각을 입력해 주세요.');
    return '';
  }
  if (resolution.status === 'valid') return resolution.instant;
  if (!choice) input.onFieldError(path, '중복되는 시각의 첫 번째/두 번째를 선택해 주세요.');
  return choice === 'later' ? resolution.later : resolution.earlier;
}
