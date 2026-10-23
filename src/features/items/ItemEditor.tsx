'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { Completion, ItemKind, ItemView, PeriodChecklistItem, ProposedCalendarItem, WeeklyRecurrence } from '../../domain/items';
import { DEFAULT_TASK_CATEGORY, getCategoryColor, getTaskCategoryColor, getTaskCategoryColorIndex, getStableItemCategoryColor, TASK_CATEGORY_EXTRA_COLORS, type TaskCategory, type TaskCategoryColor } from '../../domain/task-categories';
import { getColorTheme } from '../../domain/color-themes';
import { isValidTimeZone, parseLocalDateTime } from '../../domain/time';
import { validateProposedItem } from '../../domain/validation';
import { useRepository } from '../../lib/repository-context';
import type { ReminderOffset } from '../../lib/local-preview-store';
import type { EventCountdown } from '../../domain/items';
import { ChecklistEditor } from './ChecklistEditor';
import { DailyTaskFields } from './DailyTaskFields';
import { DialogShell } from './DialogShell';
import { EditorSection } from './EditorSection';
import { ItemTimingFields, TaskTimeInput } from './ItemTimingFields';
import { EventFields } from './EventFields';
import type { FoldChoice, TimingMode } from './item-editor-types';
import { buildProposal, getEffectiveItemKind } from './item-editor-proposal';
import { toProposedCalendarItem } from './draft-input';
import { getCountdownTargetLabel, getCountdownWindowLabel } from './countdown-copy';
import { LocalSaveStatus, type LocalSavePhase } from '../shell/LocalSaveStatus';
import { ReminderSettings } from './TimeSettingsDialog';
import styles from './ItemEditor.module.css';
import { formatKoreanDate } from '../calendar/calendar-dates';
import { SettingsDropdown } from '../routes/SettingsDropdown';
import { useDesktopPreferences } from '../../lib/desktop-preferences';

type EditorProps = {
  initial: ItemView | null;
  selectedDate: string;
  defaultKind?: ItemKind;
  defaultMode?: TimingMode;
  defaultStartDate?: string;
  defaultStartTime?: string;
  defaultTimeZone?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved?: (item: ProposedCalendarItem) => void;
  onConflict?: (itemId: string) => void;
  onDelete?: () => void;
  initialReminderOffset?: ReminderOffset | null;
  taskCategories?: readonly TaskCategory[];
  onLocalSave?: (proposal: ProposedCalendarItem, reminderOffset: ReminderOffset | null) => Promise<void>;
};

const DEFAULT_ZONE = 'Asia/Seoul';

export function ItemEditor({ initial, selectedDate, defaultKind = 'task', defaultMode = 'date', defaultStartDate = selectedDate, defaultStartTime = '09:00', defaultTimeZone = DEFAULT_ZONE, returnFocusRef, onClose, onSaved, onConflict, onDelete, initialReminderOffset = null, taskCategories = [], onLocalSave }: EditorProps) {
  const repository = useRepository();
  const titleRef = useRef<HTMLInputElement>(null);
  const initialItem = initial?.display ?? null;
  const kind: ItemKind = initialItem?.kind ?? defaultKind;
  const preferences = useDesktopPreferences();
  const currentColorTheme = getColorTheme(preferences.colorTheme);
  const [stableItemId] = useState(() => initialItem?.id ?? createId());
  const initialTiming = initialItem?.timing;
  const [mode, setMode] = useState<TimingMode>(initialTiming?.type === 'time' ? 'time' : initialTiming?.type === 'unscheduled' ? 'unscheduled' : initialTiming?.type === 'date' ? 'date' : kind === 'event' ? 'time' : defaultMode);
  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [category, setCategory] = useState(kind === 'task' ? initialItem?.category?.trim() || DEFAULT_TASK_CATEGORY.name : initialItem?.category ?? '');
  const [categoryColor, setCategoryColor] = useState<TaskCategoryColor>(initialItem?.categoryColor
    ?? (kind === 'event' ? getStableItemCategoryColor(stableItemId) : getCategoryColor(kind === 'task' ? initialItem?.category?.trim() || DEFAULT_TASK_CATEGORY.name : initialItem?.category, undefined, taskCategories)));
  const [notes, setNotes] = useState(initialItem?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialItem?.sourceUrl ?? '');
  const initialZone = initialTiming?.type === 'date' || initialTiming?.type === 'time' ? initialTiming.timeZone : defaultTimeZone;
  const [timeZone, setTimeZone] = useState(initialZone);
  const initialStartDate = initialTiming?.type === 'date'
    ? initialTiming.startDate ?? ''
    : initialTiming?.type === 'time' && initialTiming.startAt
      ? getLocalParts(initialTiming.startAt, initialTiming.timeZone).date
      : initialItem?.kind === 'deadline' ? '' : defaultStartDate;
  const initialEndDate = initialTiming?.type === 'date'
    ? initialTiming.endDate
    : initialTiming?.type === 'time' && initialTiming.endAt
      ? getLocalParts(initialTiming.endAt, initialTiming.timeZone).date
      : defaultStartDate;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [startClock, setStartClock] = useState(initialTiming?.type === 'time' && initialTiming.startAt ? getLocalParts(initialTiming.startAt, initialTiming.timeZone).time : initialItem?.kind === 'deadline' ? '' : defaultStartTime);
  const [endClock, setEndClock] = useState(initialTiming?.type === 'time' && initialTiming.endAt ? getLocalParts(initialTiming.endAt, initialTiming.timeZone).time : initialItem?.kind === 'window' ? '' : getDefaultEndTime(defaultStartTime));
  const initialRecurrence = initialItem?.kind === 'event' ? initialItem.recurrence : undefined;
  const [repeatMode, setRepeatMode] = useState<'once' | 'weekly'>(initialRecurrence ? 'weekly' : 'once');
  const [repeatDays, setRepeatDays] = useState<number[]>(initialRecurrence?.daysOfWeek ?? [getWeekday(initialStartDate)]);
  const [hasEventEnd, setHasEventEnd] = useState(initialItem?.kind === 'event' && initialItem.timing.type === 'time' ? initialItem.timing.endAt !== null : true);
  const [periodFocus, setPeriodFocus] = useState<'start' | 'deadline'>(initialItem && (initialItem.kind === 'window' || initialItem.kind === 'deadline') ? initialItem.focus ?? 'deadline' : 'deadline');
  const [unscheduled, setUnscheduled] = useState(initialTiming?.type === 'unscheduled' || (!initialItem && defaultMode === 'unscheduled'));
  const [completion, setCompletion] = useState<Completion>(initialItem && 'completion' in initialItem ? initialItem.completion ?? 'pending' : 'pending');
  const [checklist, setChecklist] = useState<PeriodChecklistItem[]>(initialItem && (initialItem.kind === 'deadline' || initialItem.kind === 'window') ? [...initialItem.checklist] : []);
  const [countdownEnabled, setCountdownEnabled] = useState(initialItem?.kind === 'event' ? initialItem.countdown?.enabled ?? false : initialItem?.kind === 'window' ? initialItem.startCountdown.enabled : initialItem?.kind === 'deadline' ? initialItem.startCountdown?.enabled ?? true : kind !== 'event');
  const [daysBefore, setDaysBefore] = useState(initialItem?.kind === 'event' ? initialItem.countdown?.daysBefore ?? 1 : initialItem?.kind === 'window' ? initialItem.startCountdown.daysBefore : initialItem?.kind === 'deadline' ? initialItem.startCountdown?.daysBefore ?? 1 : 1);
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset | null>(kind === 'event' ? null : initialReminderOffset);
  const [eventCountdownReference, setEventCountdownReference] = useState<EventCountdown['reference']>(initialItem?.kind === 'event' ? initialItem.countdown?.reference ?? 'start' : 'start');
  const [showInProgressSummary, setShowInProgressSummary] = useState(initialItem?.kind === 'event' ? initialItem.showInProgressSummary ?? true : false);
  const [hasDeadlineStart, setHasDeadlineStart] = useState(initialItem?.kind === 'deadline' ? Boolean(initialTiming && initialTiming.type !== 'unscheduled' && (initialTiming.type === 'date' ? initialTiming.startDate : initialTiming.startAt)) : false);
  const [hasWindowEnd, setHasWindowEnd] = useState(initialItem?.kind === 'window' && initialTiming?.type === 'time' ? Boolean(initialTiming.endAt) : false);
  const [startFold, setStartFold] = useState<FoldChoice>(null);
  const [endFold, setEndFold] = useState<FoldChoice>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<LocalSavePhase>('idle');
  const [saveError, setSaveError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [timingChanged, setTimingChanged] = useState(false);
  const [categoryChanged, setCategoryChanged] = useState(false);
  const [countdownChanged, setCountdownChanged] = useState(false);
  const [displayChanged, setDisplayChanged] = useState(false);
  const [showEventExtraColors, setShowEventExtraColors] = useState(false);
  const readOnly = initial?.syncState === 'offline-read-only';

  const startResolution = useMemo(() => mode === 'time' && startDate && startClock ? parseLocalDateTime(startDate, startClock, timeZone) : null, [mode, startDate, startClock, timeZone]);
  const endResolution = useMemo(() => mode === 'time' && endDate && endClock ? parseLocalDateTime(endDate, endClock, timeZone) : null, [mode, endDate, endClock, timeZone]);
  const isMultiDayEvent = kind === 'event' && Boolean(startDate && endDate && startDate !== endDate);
  const invalidWeeklyRange = kind === 'event' && repeatMode === 'weekly' && isMultiDayEvent;
  const effectiveKind = getEffectiveItemKind(initialItem?.kind ?? null, kind, isMultiDayEvent && !invalidWeeklyRange, periodFocus);
  const newPeriod = !initialItem && kind === 'event' && effectiveKind !== 'event';
  const period = effectiveKind === 'window' || effectiveKind === 'deadline';
  const effectiveFocus = newPeriod ? periodFocus : initialItem && (initialItem.kind === 'window' || initialItem.kind === 'deadline') ? initialItem.focus : undefined;
  const canBeUnscheduled = kind === 'task';
  const countdownTarget = getCountdownTargetLabel(effectiveKind, hasEventEnd ? eventCountdownReference : 'start', effectiveFocus);
  const countdownAvailable = effectiveKind !== 'deadline' || newPeriod || hasDeadlineStart;

  useEffect(() => {
    if (!Object.keys(errors).length) return;
    const firstError = document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"], [role="dialog"] [data-invalid="true"]');
    firstError?.focus();
  }, [errors]);

  function changeTiming(update: () => void) {
    update();
    setTimingChanged(true);
    setDirty(true);
  }

  function changeCountdown(update: () => void) {
    update();
    setCountdownChanged(true);
    setDirty(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaveError('');
    setSavePhase('idle');
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = '제목을 입력해 주세요.';
    if (title.length > 200) nextErrors.title = '제목은 200자 이내로 입력해 주세요.';
    if (notes.length > 10_000) nextErrors.notes = '메모는 10,000자 이내로 입력해 주세요.';
    if (kind !== 'task' && countdownAvailable && (daysBefore < 0 || daysBefore > 30 || !Number.isInteger(daysBefore))) nextErrors.daysBefore = '0일에서 30일 사이의 정수를 입력해 주세요.';
    if (kind === 'event' && repeatMode === 'weekly' && isMultiDayEvent) {
      nextErrors.recurrence = '매주 반복 일정은 하루 안에 끝나야 합니다.';
    }
    if (kind === 'event' && repeatMode === 'weekly' && repeatDays.length === 0) {
      nextErrors.recurrence = '반복할 요일을 하나 이상 선택해 주세요.';
    }

    let proposal: ProposedCalendarItem | null = null;
    try {
      const proposalKind = effectiveKind;
      const recurrence: WeeklyRecurrence | undefined = kind === 'event' && repeatMode === 'weekly'
        ? { frequency: 'weekly', daysOfWeek: repeatDays, untilDate: initialRecurrence?.untilDate ?? null }
        : undefined;
      proposal = buildProposal({
        initial: initialItem, timingChanged, categoryChanged, countdownChanged, displayChanged,
        id: initialItem?.id ?? stableItemId, kind: proposalKind, title: title.trim(), category, categoryColor, notes, sourceUrl,
        mode: unscheduled && canBeUnscheduled ? 'unscheduled' : mode, timeZone,
        startDate, endDate, startClock, endClock, startResolution, endResolution,
        startFold, endFold,
        hasDeadlineStart: newPeriod ? true : hasDeadlineStart,
        hasWindowEnd: newPeriod ? true : hasWindowEnd,
        hasEventEnd: hasEventEnd || isMultiDayEvent, recurrence, focus: effectiveFocus, completion, checklist,
        includeEventColor: kind === 'event',
        showInProgressSummary,
        countdownEnabled, daysBefore,
        eventCountdownReference: hasEventEnd ? eventCountdownReference : 'start',
        onFieldError(path, message) { nextErrors[path] = message; },
      });
    } catch {
      nextErrors.timing = '날짜와 시각 입력을 확인해 주세요.';
    }
    if (proposal) {
      const checked = validateProposedItem(proposal);
      if (!checked.valid) {
        for (const issue of checked.issues) {
          const path = issue.path.endsWith('.daysBefore') ? 'daysBefore' : issue.path.startsWith('recurrence') ? 'recurrence' : issue.path;
          nextErrors[path] ??= issue.message;
        }
      } else proposal = checked.value;
    }
    if (Object.keys(nextErrors).length > 0 || !proposal) {
      if (startResolution?.status === 'invalid' && startResolution.reason === 'unknown-zone'
        || endResolution?.status === 'invalid' && endResolution.reason === 'unknown-zone') {
        nextErrors['timing.timeZone'] = '유효한 IANA 시간대를 입력해 주세요.';
      }
      setErrors(nextErrors);
      return;
    }
    const activeRepository = repository;
    if (!onLocalSave && !activeRepository) { setSaveError('로그인 후 저장할 수 있습니다. 입력 내용은 이 창에 남아 있습니다.'); setSavePhase('error'); return; }
    if (!onLocalSave && readOnly) { setSaveError('현재 기기 저널을 사용할 수 없어 읽기 전용입니다. 입력 내용은 이 창에 남아 있습니다.'); setSavePhase('error'); return; }

    setErrors({});
    setSaving(true);
    setSavePhase('saving');
    try {
      if (onLocalSave) {
        const taskReminder = effectiveKind === 'task' && (mode !== 'time' || unscheduled) ? null : reminderOffset;
        await onLocalSave(proposal, effectiveKind === 'event' || proposal.timing.type === 'unscheduled' ? null : taskReminder);
        setSavePhase('saved');
        onSaved?.(proposal);
        onClose();
        return;
      }
      const existingDraft = initial?.localDraft;
      const canonical = initial?.canonical;
      const baseSnapshot = existingDraft ? existingDraft.baseSnapshot : canonical ? toProposedCalendarItem(canonical) : null;
      const baseRevision = existingDraft ? existingDraft.baseRevision : canonical?.revision ?? null;
      if (!activeRepository) return;
      const result = await activeRepository.saveDraft({
        itemId: proposal.id,
        expectedLocalSequence: initial?.localSequence ?? null,
        baseRevision,
        baseSnapshot,
        mutationKind: 'upsert',
        proposedSnapshot: proposal,
      });
      if (result.status === 'saved' || result.status === 'queued' || result.status === 'cancelled') {
        setSavePhase('saved');
        onSaved?.(proposal);
        onClose();
      } else if (result.status === 'conflict') {
        setSaveError('다른 기기에서 이 항목이 변경되었습니다. 두 판본을 비교해 주세요.');
        setSavePhase('error');
        onConflict?.(proposal.id);
      } else {
        setSaveError('다른 탭에서 내용이 바뀌었습니다. 이 입력은 유지되며 최신 내용을 불러온 뒤 다시 저장할 수 있습니다.');
        setSavePhase('error');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.');
      setSavePhase('error');
    } finally {
      setSaving(false);
    }
  }

  const timingProps = {
    mode, unscheduled: unscheduled && canBeUnscheduled, startDate, endDate, startClock, endClock, timeZone,
    startResolution, endResolution, startFold, endFold, errors,
    onMode: (value: 'date' | 'time') => changeTiming(() => setMode(value)),
    onUnscheduled: (value: boolean) => changeTiming(() => setUnscheduled(value)),
    onStartDate: (value: string) => changeTiming(() => { setStartDate(value); setStartFold(null); }),
    onEndDate: (value: string) => changeTiming(() => { setEndDate(value); setEndFold(null); }),
    onStartClock: (value: string) => changeTiming(() => { setStartClock(value); setStartFold(null); }),
    onEndClock: (value: string) => changeTiming(() => { setEndClock(value); setEndFold(null); }),
    onStartFold: (value: FoldChoice) => changeTiming(() => setStartFold(value)),
    onEndFold: (value: FoldChoice) => changeTiming(() => setEndFold(value)),
  };
  const dateLabel = (date: string) => date ? formatKoreanDate(date, isValidTimeZone(timeZone) ? timeZone : DEFAULT_ZONE) : '날짜를 선택해 주세요';
  const categoryOptions = taskCategories.some((entry) => entry.name.toLocaleLowerCase('ko-KR') === DEFAULT_TASK_CATEGORY.name)
    ? taskCategories
    : [DEFAULT_TASK_CATEGORY, ...taskCategories];
  const categoryDropdownOptions = categoryOptions.map((entry) => ({
    value: entry.name,
    label: entry.name === DEFAULT_TASK_CATEGORY.name ? '기본 카테고리' : entry.name,
    color: getTaskCategoryColor(entry.color).color,
  }));
  const repeatSummary = repeatMode === 'weekly'
    ? `매주 ${getWeekdayOrder(preferences.weekStartsOn).filter((day) => repeatDays.includes(day)).map(getWeekdayLabel).join('·')}${initialRecurrence?.untilDate ? ` · ${dateLabel(initialRecurrence.untilDate)}까지` : ''}` : '한 번';
  const weeklyError = invalidWeeklyRange ? '매주 반복 일정은 하루 안에 끝나야 합니다. 반복을 한 번으로 바꾸거나 날짜를 하루로 맞춰 주세요.' : repeatMode === 'weekly' ? errors.recurrence : undefined;
  const displaySummary = `${effectiveKind === 'event' ? `홈 카드 ${showInProgressSummary ? '표시' : '숨김'} · ` : ''}${countdownEnabled && countdownAvailable ? `${countdownTarget} 기준 · ${getCountdownWindowLabel(daysBefore)}` : '남은 시간 숨김'}`;

  return (
    <DialogShell
      busy={saving}
      dirty={dirty}
      wide={kind !== 'task'}
      footer={(requestClose) => (
        <footer className={styles.footer}>
          {initialItem && onDelete && <button className={styles.delete} disabled={saving || readOnly} onClick={onDelete} type="button">삭제</button>}
          <button className={styles.cancel} disabled={saving} onClick={requestClose} type="button">취소</button>
          <button className={styles.save} disabled={saving || readOnly} type="submit">{saving ? '저장 중…' : '저장'}</button>
        </footer>
      )}
      initialFocusRef={titleRef}
      returnFocusRef={returnFocusRef}
      onChange={() => setDirty(true)}
      onClose={onClose}
      onSubmit={save}
      subtitle={effectiveKind === 'task' ? '할 일' : effectiveKind === 'event' ? '일정' : effectiveKind === 'window' ? '시작 중심 기간' : '마감 기간'}
      title={(
        <input
          aria-label={kind === 'event' ? '일정 이름' : kind === 'task' ? '할 일 이름' : '제목'}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'editor-title-error' : undefined}
          className={styles.titleInput}
          maxLength={200}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder={kind === 'task' ? '예: 논문 초안 정리' : '예: 수강신청'}
          ref={titleRef}
          value={title}
        />
      )}
      titleLabel={initialItem ? '일정 수정' : getEditorTitle(kind)}
    >
      {errors.title && <p className={styles.fieldError} id="editor-title-error" role="alert">{errors.title}</p>}
      {kind === 'event' && <section aria-label="일정 유형" className={styles.scheduleOptions}>
          <fieldset className={styles.eventColorPalette}>
            <legend className={styles.visuallyHidden}>일정 색상</legend>
            <span aria-hidden="true" className={styles.eventColorLabel}>일정 색상</span>
            <div className={styles.eventColorChoices}>
              {currentColorTheme.colors.map((color, index) => (
                <button
                  aria-label={`일정 색상 ${index + 1}`}
                  aria-pressed={categoryColor === color || !categoryColor.startsWith('#') && getTaskCategoryColorIndex(categoryColor) === index}
                  className={styles.eventColorSwatch}
                  key={color}
                  onClick={() => { setCategoryColor(color); setCategoryChanged(true); setDirty(true); }}
                  style={{ '--event-color': color } as CSSProperties}
                  type="button"
                ><span aria-hidden="true" /></button>
              ))}
              <button aria-controls="event-extra-colors" aria-expanded={showEventExtraColors} aria-label="직접 색상 선택" className={styles.customColorTrigger} onClick={() => setShowEventExtraColors((current) => !current)} type="button"><span aria-hidden="true" /></button>
            </div>
          </fieldset>
          {showEventExtraColors && (
            <fieldset className={styles.eventExtraPalette} id="event-extra-colors">
              <legend>추가 색상</legend>
              {TASK_CATEGORY_EXTRA_COLORS.map((color) => (
                <button aria-label={`일정 색상 ${color}`} aria-pressed={categoryColor === color} className={styles.eventColorSwatch} key={color} onClick={() => { setCategoryColor(color); setCategoryChanged(true); setDirty(true); }} style={{ '--event-color': color } as CSSProperties} type="button"><span aria-hidden="true" /></button>
              ))}
            </fieldset>
          )}
      </section>}
      {kind === 'task' ? (
        <>
          <div className={styles.taskBasics}>
            <DailyTaskFields endDate={endDate} errors={errors} onEndDate={timingProps.onEndDate} unscheduled={unscheduled} />
            <section className={styles.categorySection} aria-label="할 일 분류">
              <label className={styles.field}>
                <span>분류</span>
                <SettingsDropdown ariaLabel="분류" className={styles.categoryDropdown} options={categoryDropdownOptions} portal value={category} onChange={(nextCategory) => {
                  setCategory(nextCategory);
                  const existing = categoryOptions.find((entry) => entry.name.toLocaleLowerCase('ko-KR') === nextCategory.toLocaleLowerCase('ko-KR'));
                  if (existing) setCategoryColor(existing.color);
                  setCategoryChanged(true); setDirty(true);
                }} />
              </label>
            </section>
          </div>
          {unscheduled && <p className={styles.help}>날짜 미정 할 일입니다. 시간 설정을 켜면 선택한 날짜를 지정합니다.</p>}
          <section aria-label="시간 설정" className={styles.taskTimeSettings}>
            <label className={styles.taskTimeToggle}>
              <span>시간 설정</span>
              <input aria-label="시간 설정" checked={mode === 'time'} onChange={(event) => changeTiming(() => {
                const enabled = event.currentTarget.checked;
                setMode(enabled ? 'time' : 'date'); setUnscheduled(false);
                if (!endDate) setEndDate(selectedDate);
                if (!enabled) setReminderOffset(null);
              })} type="checkbox" />
              <span aria-hidden="true" className={styles.taskTimeSwitch} />
            </label>
            <div aria-hidden={mode !== 'time' || unscheduled} className={styles.taskTimeReveal} data-open={mode === 'time' && !unscheduled} inert={mode !== 'time' || unscheduled}>
              <div className={styles.taskTimeRevealInner}><div className={styles.taskTimeContent}>
                <TaskTimeInput endClock={endClock} endFold={endFold} endResolution={endResolution} error={errors['timing.endAt']} onEndClock={timingProps.onEndClock} onEndFold={timingProps.onEndFold} timeZone={timeZone} />
                <ReminderSettings compact value={reminderOffset} onChange={(value) => { setReminderOffset(value); setDirty(true); }} />
                <p className={styles.help}>시간 설정을 끄면 시각과 기기 알림이 해제됩니다.</p>
              </div></div>
            </div>
          </section>
        </>
      ) : kind === 'event' ? (
        <section aria-label="일정 시간 설정" className={styles.basicTiming}>
          <div className={styles.optionRow}>
            <span className={styles.optionLabel}>시간 방식</span>
            <div aria-label="시간 방식" className={styles.segmentedControl} data-selection={mode === 'time' ? 'time' : 'date'} role="radiogroup">
              <span aria-hidden="true" className={styles.segmentedSelection} />
              <button aria-checked={mode === 'time'} className={styles.segmentedOption} onClick={() => changeTiming(() => setMode('time'))} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={mode === 'time' ? 0 : -1} type="button">정확한 시각</button>
              <button aria-checked={mode === 'date'} className={styles.segmentedOption} onClick={() => changeTiming(() => setMode('date'))} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={mode === 'date' ? 0 : -1} type="button">종일</button>
            </div>
          </div>
          {mode === 'time' && !isMultiDayEvent && <label className={styles.eventEndOption}>
            <input checked={hasEventEnd || isMultiDayEvent} disabled={isMultiDayEvent} onChange={(event) => changeTiming(() => {
              const enabled = event.currentTarget.checked; setHasEventEnd(enabled);
              if (!enabled) { setEventCountdownReference('start'); setCountdownChanged(true); }
            })} type="checkbox" />종료 시각 설정
          </label>}
          <EventFields {...timingProps} endRequired={hasEventEnd || isMultiDayEvent} />
          {newPeriod && <section aria-label="여러 날 일정의 기준" className={styles.periodFocus}>
            <fieldset className={styles.segment}>
              <legend>중요한 날짜</legend>
              <label><input checked={periodFocus === 'start'} name="period-focus" onChange={() => { setPeriodFocus('start'); setDirty(true); }} type="radio" /> 시작일</label>
              <label><input checked={periodFocus === 'deadline'} name="period-focus" onChange={() => { setPeriodFocus('deadline'); setDirty(true); }} type="radio" /> 마감일</label>
            </fieldset>
            <p>{periodFocus === 'start' ? '시작 중심' : '마감 중심'} 기간으로 저장됩니다. 미완료 기간은 홈 카드에 표시되며, 일정의 홈 카드 선택은 기간에 적용되지 않습니다.</p>
          </section>}
        </section>
      ) : (
        <section aria-label="기간 날짜와 시각" className={styles.basicTiming}>
          {kind === 'window' && mode === 'time' && <label className={styles.switch}><input checked={hasWindowEnd} onChange={(event) => changeTiming(() => { setHasWindowEnd(event.currentTarget.checked); if (!endDate) setEndDate(selectedDate); })} type="checkbox" /><span>종료 시각도 기록</span></label>}
          {kind === 'deadline' && <label className={styles.switch}><input checked={hasDeadlineStart} onChange={(event) => changeTiming(() => { setHasDeadlineStart(event.currentTarget.checked); if (!startDate) { setStartDate(selectedDate); setStartClock(''); } })} type="checkbox" /><span>기간 시작일도 기록</span></label>}
          <ItemTimingFields {...timingProps} kind={kind} startRequired={kind === 'window' || hasDeadlineStart} endRequired={kind === 'deadline'} hasWindowEnd={hasWindowEnd} />
          <ReminderSettings compact value={reminderOffset} onChange={(value) => { setReminderOffset(value); setDirty(true); }} />
        </section>
      )}
      {kind === 'event' && <EditorSection title="반복 설정" summary={repeatSummary} invalid={Boolean(weeklyError)}>
        <div className={styles.repeatControls}>
          <div className={styles.repeatModeRow}>
            <span className={styles.optionLabel}>반복</span>
            <div aria-label="반복" className={styles.segmentedControl} data-selection={repeatMode} role="radiogroup">
              <span aria-hidden="true" className={styles.segmentedSelection} />
              <button aria-checked={repeatMode === 'once'} className={styles.segmentedOption} onClick={() => { setRepeatMode('once'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={repeatMode === 'once' ? 0 : -1} type="button">한 번</button>
              <button aria-checked={repeatMode === 'weekly'} aria-describedby={weeklyError ? 'editor-repeat-error' : undefined} data-invalid={Boolean(weeklyError)} className={styles.segmentedOption} onClick={() => { if (repeatMode === 'once') setRepeatDays([getWeekday(startDate || selectedDate)]); setRepeatMode('weekly'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={repeatMode === 'weekly' ? 0 : -1} type="button">매주 반복</button>
            </div>
          </div>
          {repeatMode === 'weekly' && <fieldset className={styles.weekdayChoices}>
            <legend>반복 요일</legend>
            {getWeekdayOrder(preferences.weekStartsOn).map((day) => <button aria-pressed={repeatDays.includes(day)} className={styles.weekdayChoice} key={day} onClick={() => {
              setRepeatDays((current) => current.includes(day) ? current.length > 1 ? current.filter((entry) => entry !== day) : current : [...current, day].sort((first, second) => first - second)); setDirty(true);
            }} type="button">{getWeekdayLabel(day)}</button>)}
          </fieldset>}
          {repeatMode === 'weekly' && initialRecurrence?.untilDate && <p className={styles.help}>{dateLabel(initialRecurrence.untilDate)}까지 반복</p>}
          {weeklyError && <p className={styles.fieldError} id="editor-repeat-error" role="alert">{weeklyError}</p>}
        </div>
      </EditorSection>}
      {kind !== 'task' && <EditorSection title="D-day 표시" summary={displaySummary} invalid={Boolean(errors.daysBefore)}>
        {effectiveKind === 'event' && <label className={styles.taskTimeToggle}>
          <span>홈 카드 표시</span><input aria-label="홈 카드 표시" checked={showInProgressSummary} onChange={(event) => { setShowInProgressSummary(event.currentTarget.checked); setDisplayChanged(true); setDirty(true); }} type="checkbox" /><span aria-hidden="true" className={styles.taskTimeSwitch} />
        </label>}
        {countdownAvailable ? <>
          <label className={styles.taskTimeToggle}>
            <span>남은 시간 표시</span><input aria-label="남은 시간 표시" checked={countdownEnabled} onChange={(event) => changeCountdown(() => setCountdownEnabled(event.currentTarget.checked))} type="checkbox" /><span aria-hidden="true" className={styles.taskTimeSwitch} />
          </label>
          {(countdownEnabled || errors.daysBefore) && <div className={styles.eventCountdownOptions}>
            {effectiveKind === 'event' ? <label className={styles.field}><span>카운트다운 기준</span>
              <select aria-label="카운트다운 기준" onChange={(event) => changeCountdown(() => setEventCountdownReference(event.currentTarget.value as EventCountdown['reference']))} value={hasEventEnd ? eventCountdownReference : 'start'}>
                <option value="start">시작</option><option disabled={!hasEventEnd} value="end">종료</option>
              </select>
            </label> : <div className={styles.field}><span>카운트다운 기준</span><span className={styles.readOnlyValue}>{countdownTarget}</span></div>}
            <label className={styles.field}><span>표시 시작 일수</span><input aria-label="표시 시작 일수" aria-invalid={Boolean(errors.daysBefore)} aria-describedby={errors.daysBefore ? 'editor-countdown-error' : undefined} max={30} min={0} onChange={(event) => changeCountdown(() => setDaysBefore(Number(event.currentTarget.value)))} type="number" value={daysBefore} />
              {errors.daysBefore && <span className={styles.fieldError} id="editor-countdown-error">{errors.daysBefore}</span>}
            </label>
            <p className={styles.help}>0일을 입력하면 남은 시간 숫자를 숨깁니다.</p>
          </div>}
        </> : <p className={styles.help}>시작 날짜를 설정하면 남은 시간을 표시할 수 있어요.</p>}
      </EditorSection>}
      {period && <EditorSection title="하위 할 일 · 완료" summary={`${checklist.filter((item) => item.completed).length}/${checklist.length}개 완료 · ${completion === 'completed' ? '기간 완료' : '미완료'}`} invalid={Object.keys(errors).some((path) => path.startsWith('checklist'))}>
        <ChecklistEditor value={checklist} onChange={(value) => { setChecklist(value); setDirty(true); }} disabled={readOnly} showHeading={false} />
        {Object.entries(errors).filter(([path]) => path.startsWith('checklist')).map(([path, message]) => <p className={styles.fieldError} key={path} role="alert">{message}</p>)}
        <label className={styles.switch}><input checked={completion === 'completed'} onChange={(event) => setCompletion(event.currentTarget.checked ? 'completed' : 'pending')} type="checkbox" /><span>{effectiveKind === 'window' ? '신청 완료' : '제출 완료'}</span></label>
      </EditorSection>}
      <EditorSection title="부가 정보" summary={`${notes ? '메모 있음 · ' : ''}${sourceUrl ? '링크 있음 · ' : ''}메모 · 링크 · 시간대`} defaultOpen={Boolean(initialItem?.notes || initialItem?.sourceUrl || initialZone !== defaultTimeZone)} invalid={Boolean(errors.notes || errors.sourceUrl || errors['timing.timeZone'])}>
        <label className={styles.field}><span>메모</span><textarea aria-invalid={Boolean(errors.notes)} maxLength={10_001} onChange={(event) => setNotes(event.currentTarget.value)} rows={3} value={notes} /><small className={styles.counter}>{notes.length}/10,000</small>{errors.notes && <span className={styles.fieldError}>{errors.notes}</span>}</label>
        <label className={styles.field}><span>관련 링크 <small>선택</small></span><input aria-invalid={Boolean(errors.sourceUrl)} inputMode="url" onChange={(event) => setSourceUrl(event.currentTarget.value)} placeholder="https://" value={sourceUrl} />{errors.sourceUrl && <span className={styles.fieldError}>{errors.sourceUrl}</span>}</label>
        {!(unscheduled && canBeUnscheduled) && <label className={styles.field}><span>시간대</span><input aria-label="시간대" aria-invalid={Boolean(errors['timing.timeZone'])} aria-describedby={errors['timing.timeZone'] ? 'editor-time-zone-error' : undefined} autoCapitalize="none" onChange={(event) => changeTiming(() => { setTimeZone(event.currentTarget.value); setStartFold(null); setEndFold(null); })} value={timeZone} />{errors['timing.timeZone'] && <span className={styles.fieldError} id="editor-time-zone-error">{errors['timing.timeZone']}</span>}</label>}
      </EditorSection>
      {errors.timing && <p className={styles.formError} role="alert">{errors.timing}</p>}
      <LocalSaveStatus phase={savePhase} message={saveError} />
    </DialogShell>
  );
}

function handleRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const radios = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
  const currentIndex = radios.indexOf(event.currentTarget);
  if (currentIndex < 0 || radios.length === 0) return;

  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? radios.length - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (currentIndex + 1) % radios.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (currentIndex - 1 + radios.length) % radios.length
          : -1;
  if (nextIndex < 0) return;
  event.preventDefault();
  radios[nextIndex]?.focus();
  radios[nextIndex]?.click();
}

function getLocalParts(instant: string, timeZone: string): { date: string; time: string } {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  return { date: value.toPlainDate().toString(), time: `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}` };
}

function getWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function getWeekdayOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, index) => (weekStartsOn + index) % 7);
}

function getWeekdayLabel(day: number): string {
  return ['일', '월', '화', '수', '목', '금', '토'][day] ?? '';
}

function getDefaultEndTime(startTime: string): string {
  const [hour, minute] = startTime.split(':').map(Number);
  const next = Math.min(23 * 60 + 45, hour * 60 + minute + 30);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

function getEditorTitle(kind: ItemKind): string {
  if (kind === 'window') return '선착순 신청';
  if (kind === 'deadline') return '기간 내 할 일';
  return kind === 'event' ? '새 일정' : '새 할 일';
}

function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
