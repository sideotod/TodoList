'use client';

import { useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import type { CalendarItem, Completion, ItemKind, ItemView, PeriodChecklistItem, ProposedCalendarItem, WeeklyRecurrence } from '../../domain/items';
import { DEFAULT_TASK_CATEGORY, getCategoryColor, getTaskCategoryColor, getTaskCategoryColorIndex, getStableItemCategoryColor, TASK_CATEGORY_EXTRA_COLORS, type TaskCategory, type TaskCategoryColor } from '../../domain/task-categories';
import { getColorTheme } from '../../domain/color-themes';
import { isValidTimeZone, parseLocalDateTime } from '../../domain/time';
import { validateProposedItem } from '../../domain/validation';
import { useRepository } from '../../lib/repository-context';
import type { ReminderOffset } from '../../lib/local-preview-store';
import type { EventCountdown } from '../../domain/items';
import { ChecklistEditor } from './ChecklistEditor';
import { DailyTaskFields } from './DailyTaskFields';
import { DeadlinePeriodFields } from './DeadlinePeriodFields';
import { DialogShell } from './DialogShell';
import { EditorSection } from './EditorSection';
import { TaskTimeInput } from './ItemTimingFields';
import { EventFields } from './EventFields';
import type { FoldChoice, TimingMode } from './item-editor-types';
import { WindowPeriodFields } from './WindowPeriodFields';
import { LocalSaveStatus, type LocalSavePhase } from '../shell/LocalSaveStatus';
import { ReminderSettings, TimeSettingsDialog } from './TimeSettingsDialog';
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
  const [title, setTitle] = useState(initialItem?.title ?? (kind === 'event' ? '새 일정' : kind === 'task' ? '새 할 일' : ''));
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
  const [periodFocus, setPeriodFocus] = useState<'start' | 'deadline'>('deadline');
  const [unscheduled, setUnscheduled] = useState(initialTiming?.type === 'unscheduled' || (!initialItem && defaultMode === 'unscheduled'));
  const [completion, setCompletion] = useState<Completion>(initialItem && 'completion' in initialItem ? initialItem.completion ?? 'pending' : 'pending');
  const [checklist, setChecklist] = useState<PeriodChecklistItem[]>(initialItem && (initialItem.kind === 'deadline' || initialItem.kind === 'window') ? [...initialItem.checklist] : []);
  const [countdownEnabled, setCountdownEnabled] = useState(initialItem?.kind === 'window' ? initialItem.startCountdown.enabled : initialItem?.kind === 'deadline' ? initialItem.startCountdown?.enabled ?? true : true);
  const [daysBefore, setDaysBefore] = useState(initialItem?.kind === 'window' ? initialItem.startCountdown.daysBefore : initialItem?.kind === 'deadline' ? initialItem.startCountdown?.daysBefore ?? 1 : 1);
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset | null>(kind === 'event' ? null : initialReminderOffset);
  const [eventCountdownEnabled, setEventCountdownEnabled] = useState(initialItem?.kind === 'event' ? initialItem.countdown?.enabled ?? false : false);
  const [eventCountdownDaysBefore, setEventCountdownDaysBefore] = useState(initialItem?.kind === 'event' ? initialItem.countdown?.daysBefore ?? 1 : 1);
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
  const [timeSettingsOpen, setTimeSettingsOpen] = useState(false);
  const [showEventExtraColors, setShowEventExtraColors] = useState(false);
  const readOnly = initial?.syncState === 'offline-read-only';

  const startResolution = useMemo(() => mode === 'time' && startDate && startClock ? parseLocalDateTime(startDate, startClock, timeZone) : null, [mode, startDate, startClock, timeZone]);
  const endResolution = useMemo(() => mode === 'time' && endDate && endClock ? parseLocalDateTime(endDate, endClock, timeZone) : null, [mode, endDate, endClock, timeZone]);
  const isMultiDayEvent = kind === 'event' && Boolean(startDate && endDate && startDate !== endDate);
  const eventEndRequired = hasEventEnd || isMultiDayEvent;
  const startRequired = kind === 'event' || kind === 'window' || (kind === 'deadline' && hasDeadlineStart);
  const endRequired = kind === 'event' ? eventEndRequired : kind === 'task' || kind === 'deadline';
  const canBeUnscheduled = kind === 'task';

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError('');
    setSavePhase('idle');
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = '제목을 입력해 주세요.';
    if (title.length > 200) nextErrors.title = '제목은 200자 이내로 입력해 주세요.';
    if (notes.length > 10_000) nextErrors.notes = '메모는 10,000자 이내로 입력해 주세요.';
    if (countdownEnabled && (kind === 'window' || kind === 'deadline' && hasDeadlineStart) && (daysBefore < 0 || daysBefore > 30 || !Number.isInteger(daysBefore))) nextErrors.daysBefore = '0일에서 30일 사이의 정수를 입력해 주세요.';
    if (eventCountdownEnabled && (eventCountdownDaysBefore < 0 || eventCountdownDaysBefore > 30 || !Number.isInteger(eventCountdownDaysBefore))) {
      nextErrors.eventCountdownDaysBefore = '0일에서 30일 사이의 정수를 입력해 주세요.';
    }
    if (kind === 'event' && repeatMode === 'weekly' && isMultiDayEvent) {
      nextErrors.recurrence = '매주 반복 일정은 하루 안에 끝나야 합니다.';
    }
    if (kind === 'event' && repeatMode === 'weekly' && repeatDays.length === 0) {
      nextErrors.recurrence = '반복할 요일을 하나 이상 선택해 주세요.';
    }

    let proposal: ProposedCalendarItem | null = null;
    try {
      const proposalKind = kind === 'event' && isMultiDayEvent
        ? periodFocus === 'start' ? 'window' : 'deadline'
        : kind;
      const recurrence: WeeklyRecurrence | undefined = kind === 'event' && repeatMode === 'weekly'
        ? { frequency: 'weekly', daysOfWeek: repeatDays, untilDate: initialRecurrence?.untilDate ?? null }
        : undefined;
      proposal = buildProposal({
        id: initialItem?.id ?? stableItemId, kind: proposalKind, title: title.trim(), category, categoryColor, notes, sourceUrl,
        mode: unscheduled && canBeUnscheduled ? 'unscheduled' : mode, timeZone,
        startDate, endDate, startClock, endClock, startResolution, endResolution,
        startFold, endFold, startRequired, endRequired: endRequired || isMultiDayEvent,
        hasDeadlineStart: kind === 'event' && isMultiDayEvent ? true : hasDeadlineStart,
        hasWindowEnd: kind === 'event' && isMultiDayEvent ? true : hasWindowEnd,
        hasEventEnd, recurrence, focus: kind === 'event' && isMultiDayEvent ? periodFocus : undefined, completion, checklist,
        includeEventColor: kind === 'event',
        showInProgressSummary,
        countdownEnabled, daysBefore, eventCountdownEnabled, eventCountdownDaysBefore,
        eventCountdownReference: hasEventEnd ? eventCountdownReference : 'start',
        onFieldError(path, message) { nextErrors[path] = message; },
      });
    } catch {
      nextErrors.timing = '날짜와 시각 입력을 확인해 주세요.';
    }
    if (proposal) {
      const checked = validateProposedItem(proposal);
      if (!checked.valid) {
        for (const issue of checked.issues) nextErrors[issue.path] ??= issue.message;
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
        const taskReminder = kind === 'task' && (mode !== 'time' || unscheduled) ? null : reminderOffset;
        await onLocalSave(proposal, kind === 'event' || proposal.timing.type === 'unscheduled' ? null : taskReminder);
        setSavePhase('saved');
        onSaved?.(proposal);
        onClose();
        return;
      }
      const existingDraft = initial?.localDraft;
      const canonical = initial?.canonical;
      const baseSnapshot = existingDraft ? existingDraft.baseSnapshot : canonical ? toProposal(canonical) : null;
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
    mode,
    unscheduled: unscheduled && canBeUnscheduled,
    startDate,
    endDate,
    startClock,
    endClock,
    timeZone,
    startResolution,
    endResolution,
    startFold,
    endFold,
    errors,
    onMode: setMode,
    onUnscheduled: setUnscheduled,
    onStartDate: setStartDate,
    onEndDate: setEndDate,
    onStartClock: setStartClock,
    onEndClock: setEndClock,
    onStartFold: setStartFold,
    onEndFold: setEndFold,
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
  const timeSettingsSummary = kind === 'task'
    ? unscheduled ? '날짜를 지정해 주세요' : mode === 'time' ? `${dateLabel(endDate)} · ${endClock}` : `${dateLabel(endDate)} · 시각 없음`
    : kind === 'deadline'
      ? `${hasDeadlineStart ? `${dateLabel(startDate)}${mode === 'time' ? ` ${startClock}` : ''}` : '시작일 생략'} – 마감 ${dateLabel(endDate)}${mode === 'time' ? ` ${endClock}` : ''}`
      : kind === 'window'
        ? mode === 'time'
          ? `${dateLabel(startDate)} ${startClock} · ${hasWindowEnd ? `종료 ${dateLabel(endDate)} ${endClock}` : '종료 시각 없음'}`
          : `${dateLabel(startDate)} – ${dateLabel(endDate)}`
        : `${repeatMode === 'weekly' ? `매주 ${getWeekdayOrder().filter((day) => repeatDays.includes(day)).map(getWeekdayLabel).join('·')} · ` : ''}${mode === 'time'
          ? hasEventEnd
            ? `${dateLabel(startDate)} ${startClock} – ${dateLabel(endDate)} ${endClock}`
            : `${dateLabel(startDate)} ${startClock} · 종료 시각 미정`
          : startDate === endDate
            ? `${dateLabel(startDate)} · 종일`
            : `${dateLabel(startDate)} – ${dateLabel(endDate)} · 종일`}`;
  const eventTimePanel = kind === 'event' ? (
    <section
      aria-hidden={!timeSettingsOpen}
      aria-label="일정 시간 상세"
      className={styles.eventTimeSidePanel}
      data-open={timeSettingsOpen}
      id="event-time-reveal"
      inert={!timeSettingsOpen}
    >
      <div className={styles.taskTimeContent}>
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>시간 방식</span>
          <div aria-label="시간 방식" className={styles.segmentedControl} data-selection={mode === 'time' ? 'time' : 'date'} role="radiogroup">
            <span aria-hidden="true" className={styles.segmentedSelection} />
            <button aria-checked={mode === 'time'} className={styles.segmentedOption} onClick={() => { setMode('time'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={mode === 'time' ? 0 : -1} type="button">정확한 시각</button>
            <button aria-checked={mode === 'date'} className={styles.segmentedOption} onClick={() => { setMode('date'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={mode === 'date' ? 0 : -1} type="button">종일</button>
          </div>
        </div>
        <div className={styles.repeatControls}>
          <div className={styles.repeatModeRow}>
            <span className={styles.optionLabel}>반복</span>
            <div aria-label="반복" className={styles.segmentedControl} data-selection={repeatMode} role="radiogroup">
              <span aria-hidden="true" className={styles.segmentedSelection} />
              <button aria-checked={repeatMode === 'once'} className={styles.segmentedOption} onClick={() => { setRepeatMode('once'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={repeatMode === 'once' ? 0 : -1} type="button">한 번</button>
              <button aria-checked={repeatMode === 'weekly'} className={styles.segmentedOption} onClick={() => { if (repeatMode === 'once') setRepeatDays([getWeekday(startDate || selectedDate)]); setRepeatMode('weekly'); setDirty(true); }} onKeyDown={handleRadioKeyDown} role="radio" tabIndex={repeatMode === 'weekly' ? 0 : -1} type="button">매주 반복</button>
            </div>
          </div>
          {repeatMode === 'weekly' && (
            <>
              <fieldset className={styles.weekdayChoices}>
                <legend>반복 요일</legend>
                {getWeekdayOrder().map((day) => (
                  <button
                    aria-pressed={repeatDays.includes(day)}
                    className={styles.weekdayChoice}
                    key={day}
                    onClick={() => {
                      setRepeatDays((current) => current.includes(day)
                        ? current.length > 1 ? current.filter((entry) => entry !== day) : current
                        : [...current, day].sort((first, second) => first - second));
                      setDirty(true);
                    }}
                    type="button"
                  >{getWeekdayLabel(day)}</button>
                ))}
              </fieldset>
              {errors.recurrence && <p className={styles.fieldError} role="alert">{errors.recurrence}</p>}
            </>
          )}
        </div>
        <label className={styles.taskTimeToggle}>
          <span>상단 진행 카드 표시</span>
          <input aria-label="상단 진행 카드 표시" checked={showInProgressSummary} onChange={(event) => { setShowInProgressSummary(event.currentTarget.checked); setDirty(true); }} type="checkbox" />
          <span aria-hidden="true" className={styles.taskTimeSwitch} />
        </label>
        {mode === 'time' && (
          <label className={styles.eventEndOption}>
            <input
              checked={hasEventEnd || isMultiDayEvent}
              disabled={isMultiDayEvent}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                setHasEventEnd(enabled);
                if (!enabled) setEventCountdownReference('start');
                setDirty(true);
              }}
              type="checkbox"
            />
            종료 시각 설정
          </label>
        )}
        <EventFields {...timingProps} endRequired={endRequired} />
        <label className={styles.taskTimeToggle}>
          <span>시작 카운트다운</span>
          <input aria-label="시작 카운트다운" checked={eventCountdownEnabled} onChange={(event) => { setEventCountdownEnabled(event.currentTarget.checked); setDirty(true); }} type="checkbox" />
          <span aria-hidden="true" className={styles.taskTimeSwitch} />
        </label>
        {eventCountdownEnabled && (
          <div className={styles.eventCountdownOptions}>
            <label className={styles.field}>
              <span>카운트다운 기준 시각</span>
              <select
                aria-label="카운트다운 기준 시각"
                onChange={(event) => { setEventCountdownReference(event.currentTarget.value as EventCountdown['reference']); setDirty(true); }}
                value={eventCountdownReference}
              >
                <option value="start">시작</option>
                <option disabled={!hasEventEnd} value="end">종료</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>{eventCountdownReference === 'start' ? '시작' : '종료'} 며칠 전</span>
              <input aria-label={`${eventCountdownReference === 'start' ? '시작' : '종료'} 며칠 전`} max={30} min={0} onChange={(event) => { setEventCountdownDaysBefore(Number(event.currentTarget.value)); setDirty(true); }} type="number" value={eventCountdownDaysBefore} />
            </label>
          </div>
        )}
      </div>
    </section>
  ) : null;

  return (
    <DialogShell
      dirty={dirty}
      expanded={kind === 'event' && timeSettingsOpen}
      sidePanel={eventTimePanel}
      footer={(requestClose) => (
        <footer className={styles.footer}>
          {initialItem && onDelete && <button className={styles.delete} disabled={saving || readOnly} onClick={onDelete} type="button">삭제</button>}
          <button className={styles.save} disabled={saving || readOnly} type="submit">저장</button>
          <button className={styles.cancel} disabled={saving} onClick={requestClose} type="button">취소</button>
        </footer>
      )}
      initialFocusRef={titleRef}
      returnFocusRef={returnFocusRef}
      onChange={() => setDirty(true)}
      onClose={onClose}
      onSubmit={save}
      subtitle={!initialItem && kind !== 'task' && kind !== 'event' ? formatKoreanDate(selectedDate) : undefined}
      title={kind === 'task' || kind === 'event' ? (
        <input
          aria-label={kind === 'event' ? '일정 이름' : '할 일 이름'}
          className={styles.titleInput}
          maxLength={200}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder={kind === 'event' ? '새 일정' : '새 할 일'}
          ref={titleRef}
          value={title}
        />
      ) : initialItem ? '일정 수정' : getEditorTitle(kind)}
      titleLabel={initialItem ? '일정 수정' : getEditorTitle(kind)}
    >
      {kind !== 'task' && kind !== 'event' && <label className={styles.field}>
        <span>제목</span>
        <input ref={titleRef} maxLength={201} onChange={(event) => setTitle(event.currentTarget.value)} value={title} />
        <small className={styles.counter}>{title.length}/200</small>
        {errors.title && <span className={styles.fieldError}>{errors.title}</span>}
      </label>}
      {(kind === 'task' || kind === 'event') && errors.title && <p className={styles.fieldError} role="alert">{errors.title}</p>}
      {kind === 'event' && (
        <section aria-label="일정 유형" className={styles.scheduleOptions}>
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
                  onClick={() => { setCategoryColor(color); setDirty(true); }}
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
                <button aria-label={`일정 색상 ${color}`} aria-pressed={categoryColor === color} className={styles.eventColorSwatch} key={color} onClick={() => { setCategoryColor(color); setDirty(true); }} style={{ '--event-color': color } as CSSProperties} type="button"><span aria-hidden="true" /></button>
              ))}
            </fieldset>
          )}
          <section aria-label="일정 시간 설정" className={`${styles.taskTimeSettings} ${styles.eventTimeSettings}`} data-open={timeSettingsOpen}>
            <button
              aria-controls="event-time-reveal"
              aria-expanded={timeSettingsOpen}
              className={`${styles.timeSettings} ${styles.timeSettingsToggle}`}
              onClick={() => setTimeSettingsOpen((current) => !current)}
              type="button"
            >
              <div>
                <strong>시간 설정</strong>
                <span>{timeSettingsSummary}</span>
              </div>
            </button>
          </section>
        </section>
      )}
      {kind === 'task' && <DailyTaskFields endDate={endDate} errors={errors} onEndDate={setEndDate} unscheduled={unscheduled} />}
      {kind === 'window' && <WindowPeriodFields {...timingProps} countdownEnabled={countdownEnabled} daysBefore={daysBefore} errors={errors} hasWindowEnd={hasWindowEnd} showTiming={false} onCountdownEnabled={setCountdownEnabled} onDaysBefore={setDaysBefore} onWindowEnd={(value) => { setHasWindowEnd(value); if (value && !endDate) setEndDate(selectedDate); if (value) setEndClock(''); }} />}
      {kind === 'deadline' && <DeadlinePeriodFields {...timingProps} countdownEnabled={countdownEnabled} daysBefore={daysBefore} errors={errors} hasDeadlineStart={hasDeadlineStart} showTiming={false} onCountdownEnabled={setCountdownEnabled} onDaysBefore={setDaysBefore} onDeadlineStart={setHasDeadlineStart} onStartClock={setStartClock} onStartDate={setStartDate} selectedDate={selectedDate} />}
      {kind === 'task' ? (
        <section aria-label="시간 설정" className={styles.taskTimeSettings}>
          <label className={styles.taskTimeToggle}>
            <span>시간 설정</span>
            <input aria-label="시간 설정" checked={mode === 'time'} onChange={(event) => {
              const enabled = event.currentTarget.checked;
              setMode(enabled ? 'time' : 'date');
              setUnscheduled(false);
              if (!enabled) setReminderOffset(null);
            }} type="checkbox" />
            <span aria-hidden="true" className={styles.taskTimeSwitch} />
          </label>
          <div
            aria-hidden={mode !== 'time' || unscheduled}
            className={styles.taskTimeReveal}
            data-open={mode === 'time' && !unscheduled}
            inert={mode !== 'time' || unscheduled}
          >
            <div className={styles.taskTimeRevealInner}>
              <div className={styles.taskTimeContent}>
                <TaskTimeInput
                  endClock={endClock}
                  endFold={endFold}
                  endResolution={endResolution}
                  error={errors['timing.endAt']}
                  onEndClock={(value) => { setEndClock(value); setEndFold(null); }}
                  onEndFold={setEndFold}
                  timeZone={timeZone}
                />
                <ReminderSettings compact value={reminderOffset} onChange={(value) => { setReminderOffset(value); setDirty(true); }} />
              </div>
            </div>
          </div>
        </section>
      ) : kind === 'event' ? null : (
        <section className={styles.timeSettings}>
          <div>
            <strong>시간 설정</strong>
            <span>{timeSettingsSummary}</span>
          </div>
          <button className={styles.timeSettingsButton} onClick={() => setTimeSettingsOpen(true)} type="button">
            {mode === 'time' ? '변경' : '＋ 시간 추가'}
          </button>
        </section>
      )}

      {kind === 'task' && (
        <section className={styles.categorySection} aria-label="할 일 분류">
          <label className={styles.field}>
            <span>분류</span>
            <SettingsDropdown
              ariaLabel="분류"
              className={styles.categoryDropdown}
              onChange={(nextCategory) => {
                setCategory(nextCategory);
                const existing = categoryOptions.find((entry) => entry.name.toLocaleLowerCase('ko-KR') === nextCategory.toLocaleLowerCase('ko-KR'));
                if (existing) setCategoryColor(existing.color);
                setDirty(true);
              }}
              options={categoryDropdownOptions}
              portal
              value={category}
            />
          </label>
        </section>
      )}

      {kind === 'event' && isMultiDayEvent && (
        <section aria-label="여러 날 일정의 기준" className={styles.periodFocus}>
          <fieldset className={styles.segment}>
            <legend>어느 날짜가 더 중요한가요?</legend>
            <label><input checked={periodFocus === 'start'} onChange={() => { setPeriodFocus('start'); setDirty(true); }} type="radio" /> 시작일</label>
            <label><input checked={periodFocus === 'deadline'} onChange={() => { setPeriodFocus('deadline'); setDirty(true); }} type="radio" /> 마감일</label>
          </fieldset>
          <p>{periodFocus === 'start' ? '시작 시점을 기준으로 진행 상황과 디데이를 보여줍니다.' : '마감 시점을 기준으로 진행 상황을 보여줍니다.'}</p>
        </section>
      )}

      {timeSettingsOpen && kind !== 'event' && (
        <TimeSettingsDialog
          initial={{
            mode: mode === 'time' ? 'time' : 'date',
            startDate,
            endDate,
            startClock,
            endClock,
            reminderOffset,
            eventCountdownEnabled,
            eventCountdownDaysBefore,
            eventCountdownReference,
            startFold,
            endFold,
            hasDeadlineStart,
            hasWindowEnd,
          }}
          kind={kind}
          onApply={(settings) => {
            setMode(settings.mode);
            if (kind === 'task') setUnscheduled(false);
            setStartDate(settings.startDate);
            setEndDate(settings.endDate);
            setStartClock(settings.startClock);
            setEndClock(settings.endClock);
            setReminderOffset(settings.reminderOffset);
            setEventCountdownEnabled(settings.eventCountdownEnabled);
            setEventCountdownDaysBefore(settings.eventCountdownDaysBefore);
            setEventCountdownReference(settings.eventCountdownReference);
            setStartFold(settings.startFold);
            setEndFold(settings.endFold);
            setHasDeadlineStart(settings.hasDeadlineStart);
            setHasWindowEnd(settings.hasWindowEnd);
            setDirty(true);
            setTimeSettingsOpen(false);
          }}
          onClose={() => setTimeSettingsOpen(false)}
          selectedDate={selectedDate}
          timeZone={timeZone}
        />
      )}

      <label className={styles.field}>
        <span>메모</span>
        <textarea maxLength={10_001} onChange={(event) => setNotes(event.currentTarget.value)} rows={4} value={notes} />
        <small className={styles.counter}>{notes.length}/10,000</small>
        {errors.notes && <span className={styles.fieldError}>{errors.notes}</span>}
      </label>

      {(kind === 'window' || kind === 'deadline' || isMultiDayEvent) && (
        <EditorSection title="하위 할 일 · 완료" summary={`${checklist.filter((item) => item.completed).length}/${checklist.length}개 완료 · ${completion === 'completed' ? '기간 완료' : '미완료'}`} invalid={Object.keys(errors).some((path) => path.startsWith('checklist'))}>
          <ChecklistEditor value={checklist} onChange={(value) => { setChecklist(value); setDirty(true); }} disabled={readOnly} />
          {Object.entries(errors).filter(([path]) => path.startsWith('checklist')).map(([path, message]) => <p className={styles.fieldError} key={path} role="alert">{message}</p>)}
          <label className={styles.switch}><input checked={completion === 'completed'} onChange={(event) => setCompletion(event.currentTarget.checked ? 'completed' : 'pending')} type="checkbox" /><span>{kind === 'event' ? periodFocus === 'start' ? '신청 완료' : '일정 완료' : kind === 'window' ? '신청 완료' : '제출 완료'}</span></label>
        </EditorSection>
      )}

      {kind === 'task' || kind === 'event' ? (
        <label className={styles.field}>
          <span>관련 링크 <small>선택</small></span>
          <input inputMode="url" onChange={(event) => setSourceUrl(event.currentTarget.value)} placeholder="https://" value={sourceUrl} />
          {errors.sourceUrl && <span className={styles.fieldError}>{errors.sourceUrl}</span>}
        </label>
      ) : (
      <EditorSection title="추가 설정" summary="시간대 · 링크" invalid={Boolean(errors.sourceUrl || errors['timing.timeZone'])}>
        {!(unscheduled && canBeUnscheduled) && (
          <label className={styles.field}><span>시간대</span><input aria-label="시간대" aria-invalid={Boolean(errors['timing.timeZone'])} aria-describedby={errors['timing.timeZone'] ? 'editor-time-zone-error' : undefined} autoCapitalize="none" onChange={(event) => { setTimeZone(event.currentTarget.value); setStartFold(null); setEndFold(null); }} value={timeZone} />{errors['timing.timeZone'] && <span className={styles.fieldError} id="editor-time-zone-error">{errors['timing.timeZone']}</span>}</label>
        )}
        <label className={styles.field}>
          <span>관련 링크 <small>선택</small></span>
          <input inputMode="url" onChange={(event) => setSourceUrl(event.currentTarget.value)} placeholder="https://" value={sourceUrl} />
          {errors.sourceUrl && <span className={styles.fieldError}>{errors.sourceUrl}</span>}
        </label>
      </EditorSection>
      )}
      {errors.timing && <p className={styles.formError}>{errors.timing}</p>}
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

type BuildInput = {
  id: string; kind: ItemKind; title: string; category: string; categoryColor: TaskCategoryColor; notes: string; sourceUrl: string;
  mode: TimingMode; timeZone: string; startDate: string; endDate: string; startClock: string; endClock: string;
  startResolution: ReturnType<typeof parseLocalDateTime> | null; endResolution: ReturnType<typeof parseLocalDateTime> | null;
  startFold: FoldChoice; endFold: FoldChoice; startRequired: boolean; endRequired: boolean; hasEventEnd: boolean; recurrence?: WeeklyRecurrence;
  focus?: 'start' | 'deadline';
  hasDeadlineStart: boolean; hasWindowEnd: boolean;
  includeEventColor: boolean;
  showInProgressSummary: boolean;
  completion: Completion; checklist: PeriodChecklistItem[]; countdownEnabled: boolean; daysBefore: number;
  eventCountdownEnabled: boolean; eventCountdownDaysBefore: number; eventCountdownReference: EventCountdown['reference'];
  onFieldError: (path: string, message: string) => void;
};

function buildProposal(input: BuildInput): ProposedCalendarItem {
  const common = {
    id: input.id,
    title: input.title,
    ...(input.category.trim() ? { category: input.category.trim() } : {}),
    ...((input.kind === 'task' && input.category.trim()) || input.includeEventColor ? { categoryColor: input.categoryColor } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.sourceUrl.trim() ? { sourceUrl: input.sourceUrl.trim() } : {}),
  };
  if (input.kind === 'event') {
    const timing = input.mode === 'date'
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
      showInProgressSummary: input.showInProgressSummary,
      ...(input.recurrence ? { recurrence: input.recurrence } : {}),
      countdown: { enabled: input.eventCountdownEnabled, daysBefore: input.eventCountdownDaysBefore, reference: input.eventCountdownReference },
      timing,
    };
  }
  if (input.kind === 'task') {
    if (input.mode === 'unscheduled') return { ...common, kind: 'task', timing: { type: 'unscheduled' }, completion: input.completion };
    if (input.mode === 'date') return { ...common, kind: 'task', timing: { type: 'date', startDate: null, endDate: input.endDate, timeZone: input.timeZone }, completion: input.completion };
    return { ...common, kind: 'task', timing: { type: 'time', startAt: null, endAt: resolveInstant(input, 'end'), timeZone: input.timeZone }, completion: input.completion };
  }
  const countdown = { enabled: input.countdownEnabled, daysBefore: input.daysBefore };
  const completion = input.completion;
  if (input.kind === 'deadline') {
    const timing = input.mode === 'date'
      ? { type: 'date' as const, startDate: input.hasDeadlineStart ? input.startDate || null : null, endDate: input.endDate, timeZone: input.timeZone }
      : { type: 'time' as const, startAt: input.hasDeadlineStart ? resolveInstant(input, 'start') : null, endAt: resolveInstant(input, 'end'), timeZone: input.timeZone };
    const startPresent = timing.type === 'date' ? timing.startDate !== null : timing.startAt !== null;
    return { ...common, kind: 'deadline', ...(input.focus ? { focus: input.focus } : {}), timing, completion, checklist: input.checklist, startCountdown: startPresent ? countdown : null };
  }
  const timing = input.mode === 'date'
    ? { type: 'date' as const, startDate: input.startDate, endDate: input.endDate, timeZone: input.timeZone }
    : { type: 'time' as const, startAt: resolveInstant(input, 'start'), endAt: input.hasWindowEnd ? resolveInstant(input, 'end') : null, timeZone: input.timeZone };
  return { ...common, kind: 'window', ...(input.focus ? { focus: input.focus } : {}), timing, completion, checklist: input.checklist, startCountdown: countdown };
}

function resolveInstant(input: BuildInput, part: 'start' | 'end'): string {
  const resolution = part === 'start' ? input.startResolution : input.endResolution;
  const choice = part === 'start' ? input.startFold : input.endFold;
  const path = part === 'start' ? 'timing.startAt' : 'timing.endAt';
  if (!resolution || resolution.status === 'invalid') {
    input.onFieldError(path, resolution?.status === 'invalid' && resolution.reason === 'unknown-zone' ? '유효한 IANA 시간대를 입력해 주세요.' : '날짜와 시각을 입력해 주세요.');
    return '';
  }
  if (resolution.status === 'valid') return resolution.instant;
  if (!choice) input.onFieldError(path, '중복되는 시각의 첫 번째/두 번째를 선택해 주세요.');
  return choice === 'later' ? resolution.later : resolution.earlier;
}

function toProposal(item: CalendarItem): ProposedCalendarItem {
  const { revision: _revision, updatedAt: _updatedAt, deletedAt: _deletedAt, lastMutationId: _lastMutationId, lastMutationDigest: _lastMutationDigest, ...proposal } = item;
  void _revision;
  void _updatedAt;
  void _deletedAt;
  void _lastMutationId;
  void _lastMutationDigest;
  return proposal;
}

function getLocalParts(instant: string, timeZone: string): { date: string; time: string } {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  return { date: value.toPlainDate().toString(), time: `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}` };
}

function getWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function getWeekdayOrder(): number[] {
  return [1, 2, 3, 4, 5, 6, 0];
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
