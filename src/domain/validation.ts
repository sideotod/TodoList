import type {
  CalendarItem,
  Completion,
  FieldIssue,
  ItemKind,
  ItemTiming,
  ProposedCalendarItem,
  ValidationResult,
} from './items';
import { getLocalDate, isValidDateOnly, isValidTimeZone } from './time';
import { isTaskCategoryColor } from './task-categories';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 10_000;
const MAX_CATEGORY_LENGTH = 64;
const MAX_URL_LENGTH = 2_048;
export const MAX_CHECKLIST_ITEMS = 4;

const SERVER_METADATA_KEYS = [
  'revision',
  'updatedAt',
  'deletedAt',
  'lastMutationId',
  'lastMutationDigest',
] as const;
const COMMON_KEYS = [
  'id',
  'kind',
  'title',
  'category',
  'categoryColor',
  'notes',
  'sourceUrl',
  'importSource',
  'timing',
] as const;

type ValueRecord = Record<string, unknown>;
type TimingInfo = {
  mode: 'unscheduled' | 'date' | 'time';
  hasStart: boolean;
  hasEnd: boolean;
  startDate: string | null;
  endDate: string | null;
  startAt: string | null;
  endAt: string | null;
};

function isRecord(value: unknown): value is ValueRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: FieldIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function checkKeys(
  record: ValueRecord,
  allowed: readonly string[],
  path: string,
  issues: FieldIssue[],
  allowServerMetadata: boolean,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (allowedKeys.has(key)) continue;
    if (!allowServerMetadata && SERVER_METADATA_KEYS.includes(key as (typeof SERVER_METADATA_KEYS)[number])) {
      issue(
        issues,
        path ? `${path}.${key}` : key,
        'metadata_not_allowed_in_proposal',
        '제안 입력에는 서버 메타데이터를 포함할 수 없습니다.',
      );
      continue;
    }
    issue(
      issues,
      path ? `${path}.${key}` : key,
      'unknown_field',
      '허용되지 않은 필드입니다.',
    );
  }
}

function requireOwnKeys(
  record: ValueRecord,
  required: readonly string[],
  path: string,
  issues: FieldIssue[],
): void {
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      issue(
        issues,
        path ? `${path}.${key}` : key,
        'required',
        '필수 필드입니다.',
      );
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDateOnlyShape(value: unknown): value is string {
  return isValidDateOnly(value);
}

function isUtcInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function checkStringField(
  record: ValueRecord,
  key: string,
  path: string,
  issues: FieldIssue[],
  maxLength: number,
  allowEmpty = false,
): void {
  const value = record[key];
  if (typeof value !== 'string') {
    issue(issues, path, 'invalid_type', '문자열이어야 합니다.');
    return;
  }
  if ((!allowEmpty && value.trim().length === 0) || value.length > maxLength) {
    issue(
      issues,
      path,
      value.length > maxLength ? 'max_length' : 'required',
      value.length > maxLength
        ? `최대 ${maxLength}자까지 입력할 수 있습니다.`
        : '비어 있지 않은 값이 필요합니다.',
    );
  }
}

function checkOptionalString(
  record: ValueRecord,
  key: string,
  issues: FieldIssue[],
  maxLength: number,
): void {
  if (!Object.hasOwn(record, key)) return;
  checkStringField(record, key, key, issues, maxLength, true);
}

function validateImportSource(value: unknown, issues: FieldIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, 'importSource', 'invalid_type', '가져오기 출처 객체가 필요합니다.');
    return;
  }
  const keys = ['uid', 'occurrenceKey', 'componentFingerprint'] as const;
  checkKeys(value, keys, 'importSource', issues, true);
  requireOwnKeys(value, keys, 'importSource', issues);
  for (const key of keys) {
    if (!isNonEmptyString(value[key])) {
      issue(
        issues,
        `importSource.${key}`,
        'invalid_value',
        '가져오기 출처 식별자는 비어 있지 않은 문자열이어야 합니다.',
      );
    }
  }
}

function validateTiming(
  value: unknown,
  kind: ItemKind,
  issues: FieldIssue[],
): TimingInfo | null {
  if (!isRecord(value)) {
    issue(issues, 'timing', 'invalid_type', '시간 정보 객체가 필요합니다.');
    return null;
  }

  if (value.type === 'unscheduled') {
    checkKeys(value, ['type'], 'timing', issues, true);
    if (kind !== 'task') {
      issue(issues, 'timing', 'invalid_timing', '미정 시간 task만 저장할 수 있습니다.');
    }
    return {
      mode: 'unscheduled',
      hasStart: false,
      hasEnd: false,
      startDate: null,
      endDate: null,
      startAt: null,
      endAt: null,
    };
  }

  if (value.type === 'date') {
    const keys = ['type', 'startDate', 'endDate', 'timeZone'] as const;
    checkKeys(value, keys, 'timing', issues, true);
    requireOwnKeys(value, keys, 'timing', issues);
    const rawStart = value.startDate;
    const startDate = rawStart === null || hasDateOnlyShape(rawStart) ? rawStart : null;
    const endDate = hasDateOnlyShape(value.endDate) ? value.endDate : null;
    if (rawStart !== null && !hasDateOnlyShape(rawStart)) {
      issue(issues, 'timing.startDate', 'invalid_date', 'YYYY-MM-DD 날짜가 필요합니다.');
    }
    if (!endDate) {
      issue(issues, 'timing.endDate', 'invalid_date', 'YYYY-MM-DD 종료 날짜가 필요합니다.');
    }
    if (typeof startDate === 'string' && endDate && startDate > endDate) {
      issue(issues, 'timing', 'invalid_range', '시작 날짜는 종료 날짜보다 늦을 수 없습니다.');
    }
    if (!isValidTimeZone(value.timeZone)) {
      issue(issues, 'timing.timeZone', 'invalid_time_zone', '실제로 사용할 수 있는 시간대가 필요합니다.');
    }
    if ((kind === 'event' || kind === 'window') && !hasDateOnlyShape(rawStart)) {
      issue(issues, 'timing.startDate', 'required', '시작 날짜가 필요합니다.');
    }
    if (kind === 'task' && rawStart !== null) {
      issue(issues, 'timing.startDate', 'task_has_no_range', 'task에는 기간 시작 날짜를 저장할 수 없습니다.');
    }
    return {
      mode: 'date',
      hasStart: hasDateOnlyShape(rawStart),
      hasEnd: endDate !== null,
      startDate: hasDateOnlyShape(rawStart) ? rawStart : null,
      endDate,
      startAt: null,
      endAt: null,
    };
  }

  if (value.type === 'time') {
    const keys = ['type', 'startAt', 'endAt', 'timeZone'] as const;
    checkKeys(value, keys, 'timing', issues, true);
    requireOwnKeys(value, keys, 'timing', issues);
    const rawStart = value.startAt;
    const rawEnd = value.endAt;
    const startAt = rawStart === null || isUtcInstant(rawStart) ? rawStart : null;
    const endAt = rawEnd === null || isUtcInstant(rawEnd) ? rawEnd : null;
    if (rawStart !== null && !isUtcInstant(rawStart)) {
      issue(issues, 'timing.startAt', 'invalid_instant', '밀리초 단위 UTC ISO 시각이 필요합니다.');
    }
    if (rawEnd !== null && !isUtcInstant(rawEnd)) {
      issue(issues, 'timing.endAt', 'invalid_instant', '밀리초 단위 UTC ISO 시각이 필요합니다.');
    }
    if (!isValidTimeZone(value.timeZone)) {
      issue(issues, 'timing.timeZone', 'invalid_time_zone', '실제로 사용할 수 있는 시간대가 필요합니다.');
    }
    if ((kind === 'event' || kind === 'window') && !isUtcInstant(rawStart)) {
      issue(issues, 'timing.startAt', 'required', '시작 시각이 필요합니다.');
    }
    if ((kind === 'task' || kind === 'deadline') && !isUtcInstant(rawEnd)) {
      issue(issues, 'timing.endAt', 'required', '종료 또는 마감 시각이 필요합니다.');
    }
    if (kind === 'task' && rawStart !== null) {
      issue(issues, 'timing.startAt', 'task_has_no_range', 'task에는 기간 시작 시각을 저장할 수 없습니다.');
    }
    if (isUtcInstant(rawStart) && isUtcInstant(rawEnd) && rawStart >= rawEnd) {
      issue(issues, 'timing', 'invalid_range', '시간형 종료는 시작보다 늦어야 합니다.');
    }
    return {
      mode: 'time',
      hasStart: typeof startAt === 'string',
      hasEnd: typeof endAt === 'string',
      startDate: null,
      endDate: null,
      startAt: typeof startAt === 'string' ? startAt : null,
      endAt: typeof endAt === 'string' ? endAt : null,
    };
  }

  issue(issues, 'timing.type', 'invalid_timing', 'date, time 또는 task의 unscheduled 시간 형식이 필요합니다.');
  return null;
}

function validateChecklist(value: unknown, issues: FieldIssue[]): void {
  if (!Array.isArray(value)) {
    issue(issues, 'checklist', 'invalid_type', '체크리스트 배열이 필요합니다.');
    return;
  }
  if (value.length > MAX_CHECKLIST_ITEMS) {
    issue(issues, 'checklist', 'too_many_items', `체크리스트는 최대 ${MAX_CHECKLIST_ITEMS}개까지 입력할 수 있습니다.`);
  }
  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const path = `checklist.${index}`;
    if (!isRecord(entry)) {
      issue(issues, path, 'invalid_type', '체크리스트 항목 객체가 필요합니다.');
      continue;
    }
    const keys = ['id', 'title', 'completed'] as const;
    checkKeys(entry, keys, path, issues, true);
    requireOwnKeys(entry, keys, path, issues);
    if (!isNonEmptyString(entry.id)) {
      issue(issues, `${path}.id`, 'required', '고유한 ID가 필요합니다.');
    } else if (ids.has(entry.id)) {
      issue(issues, `${path}.id`, 'duplicate_id', '체크리스트 ID는 중복될 수 없습니다.');
    } else {
      ids.add(entry.id);
    }
    checkStringField(entry, 'title', `${path}.title`, issues, MAX_TITLE_LENGTH);
    if (typeof entry.completed !== 'boolean') {
      issue(issues, `${path}.completed`, 'invalid_type', '완료 여부는 boolean이어야 합니다.');
    }
  }
}

function validateStartCountdown(
  value: unknown,
  shouldExist: boolean,
  issues: FieldIssue[],
): void {
  if (value === null) {
    if (shouldExist) {
      issue(issues, 'startCountdown', 'required', '시작 날짜가 있는 기간은 시작 표시 설정이 필요합니다.');
    }
    return;
  }
  if (!isRecord(value)) {
    issue(issues, 'startCountdown', 'invalid_type', '시작 표시 설정 객체가 필요합니다.');
    return;
  }
  const keys = ['enabled', 'daysBefore'] as const;
  checkKeys(value, keys, 'startCountdown', issues, true);
  requireOwnKeys(value, keys, 'startCountdown', issues);
  if (typeof value.enabled !== 'boolean') {
    issue(issues, 'startCountdown.enabled', 'invalid_type', '활성 여부는 boolean이어야 합니다.');
  }
  if (!Number.isInteger(value.daysBefore) || Number(value.daysBefore) < 0 || Number(value.daysBefore) > 30) {
    issue(issues, 'startCountdown.daysBefore', 'out_of_range', 'daysBefore는 0~30 정수여야 합니다.');
  }
  if (!shouldExist) {
    issue(issues, 'startCountdown', 'invalid_value', '시작 시각이 없는 마감에는 시작 표시 설정을 둘 수 없습니다.');
  }
}

function validateEventCountdown(value: unknown, issues: FieldIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, 'countdown', 'invalid_type', '카운트다운 설정 객체가 필요합니다.');
    return;
  }
  const keys = ['enabled', 'daysBefore', 'reference'] as const;
  checkKeys(value, keys, 'countdown', issues, true);
  requireOwnKeys(value, keys, 'countdown', issues);
  if (typeof value.enabled !== 'boolean') {
    issue(issues, 'countdown.enabled', 'invalid_type', '활성 여부는 boolean이어야 합니다.');
  }
  if (!Number.isInteger(value.daysBefore) || Number(value.daysBefore) < 0 || Number(value.daysBefore) > 30) {
    issue(issues, 'countdown.daysBefore', 'out_of_range', 'daysBefore는 0~30 정수여야 합니다.');
  }
  if (value.reference !== 'start' && value.reference !== 'end') {
    issue(issues, 'countdown.reference', 'invalid_value', '기준 시각은 시작 또는 종료여야 합니다.');
  }
}

function validateWeeklyRecurrence(value: unknown, timing: TimingInfo | null, timeZone: unknown, issues: FieldIssue[]): void {
  if (!isRecord(value)) {
    issue(issues, 'recurrence', 'invalid_type', '반복 설정 객체가 필요합니다.');
    return;
  }
  const keys = ['frequency', 'daysOfWeek', 'untilDate'] as const;
  checkKeys(value, keys, 'recurrence', issues, true);
  requireOwnKeys(value, keys, 'recurrence', issues);
  if (value.frequency !== 'weekly') issue(issues, 'recurrence.frequency', 'invalid_value', 'weekly 반복만 지원합니다.');
  if (!Array.isArray(value.daysOfWeek) || value.daysOfWeek.length < 1 || value.daysOfWeek.length > 7
    || value.daysOfWeek.some((day) => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)
    || new Set(value.daysOfWeek).size !== value.daysOfWeek.length) {
    issue(issues, 'recurrence.daysOfWeek', 'invalid_value', '요일은 일요일 0부터 토요일 6까지 중복 없이 선택해 주세요.');
  }
  if (value.untilDate !== null && !hasDateOnlyShape(value.untilDate)) {
    issue(issues, 'recurrence.untilDate', 'invalid_date', '반복 종료일은 YYYY-MM-DD 날짜 또는 null이어야 합니다.');
  }
  const startDate = timing?.mode === 'date'
    ? timing.startDate
    : timing?.mode === 'time' && timing.startAt && isValidTimeZone(timeZone)
      ? getLocalDate(Date.parse(timing.startAt), timeZone)
      : null;
  if (startDate && hasDateOnlyShape(value.untilDate) && value.untilDate < startDate) {
    issue(issues, 'recurrence.untilDate', 'before_start', '반복 종료일은 시작일보다 빠를 수 없습니다.');
  }
}

function validateProposalShape(value: unknown): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!isRecord(value)) {
    issue(issues, '', 'invalid_type', '항목 객체가 필요합니다.');
    return issues;
  }
  const kind = value.kind;
  if (kind !== 'event' && kind !== 'task' && kind !== 'deadline' && kind !== 'window') {
    issue(issues, 'kind', 'invalid_kind', '지원하는 항목 종류가 필요합니다.');
    return issues;
  }
  const allowed: string[] = [...COMMON_KEYS];
  if (kind === 'event') allowed.push('countdown', 'recurrence', 'showInProgressSummary');
  else allowed.push('completion');
  if (kind === 'deadline' || kind === 'window') {
    allowed.push('checklist', 'startCountdown', 'focus');
  }
  checkKeys(value, allowed, '', issues, false);
  requireOwnKeys(
    value,
    [
      'id',
      'kind',
      'title',
      'timing',
          ...(kind === 'event' ? [] : ['completion']),
      ...(kind === 'deadline' || kind === 'window' ? ['checklist', 'startCountdown'] : []),
    ],
    '',
    issues,
  );

  if (!isNonEmptyString(value.id)) {
    issue(issues, 'id', 'required', '비어 있지 않은 문자열 ID가 필요합니다.');
  }
  checkStringField(value, 'title', 'title', issues, MAX_TITLE_LENGTH);
  checkOptionalString(value, 'category', issues, MAX_CATEGORY_LENGTH);
  if (Object.hasOwn(value, 'categoryColor') && !isTaskCategoryColor(value.categoryColor)) {
    issue(issues, 'categoryColor', 'invalid_value', '지원하는 카테고리 색상을 선택해 주세요.');
  }
  checkOptionalString(value, 'notes', issues, MAX_NOTES_LENGTH);
  if (Object.hasOwn(value, 'sourceUrl')) {
    const sourceUrl = value.sourceUrl;
    if (typeof sourceUrl !== 'string' || sourceUrl.length > MAX_URL_LENGTH) {
      issue(issues, 'sourceUrl', 'invalid_value', `URL은 최대 ${MAX_URL_LENGTH}자까지 입력할 수 있습니다.`);
    } else {
      try {
        const url = new URL(sourceUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          issue(issues, 'sourceUrl', 'invalid_url', 'http 또는 https URL만 사용할 수 있습니다.');
        }
      } catch {
        issue(issues, 'sourceUrl', 'invalid_url', '절대 http 또는 https URL이 필요합니다.');
      }
    }
  }
  if (Object.hasOwn(value, 'importSource')) {
    validateImportSource(value.importSource, issues);
  }
  if (kind === 'event' && Object.hasOwn(value, 'countdown')) {
    validateEventCountdown(value.countdown, issues);
  }
  if (kind === 'event' && Object.hasOwn(value, 'showInProgressSummary') && typeof value.showInProgressSummary !== 'boolean') {
    issue(issues, 'showInProgressSummary', 'invalid_type', '진행 카드 표시 여부는 boolean이어야 합니다.');
  }
  if (kind !== 'event' && value.completion !== 'pending' && value.completion !== 'completed') {
    issue(issues, 'completion', 'invalid_value', 'pending 또는 completed 값이 필요합니다.');
  }

  const timing = validateTiming(value.timing, kind, issues);
  if (kind === 'event' && Object.hasOwn(value, 'recurrence')) {
    validateWeeklyRecurrence(value.recurrence, timing, isRecord(value.timing) ? value.timing.timeZone : null, issues);
  }
  if ((kind === 'deadline' || kind === 'window') && Object.hasOwn(value, 'focus')
    && value.focus !== 'start' && value.focus !== 'deadline') {
    issue(issues, 'focus', 'invalid_value', '시작 또는 마감 기준을 선택해 주세요.');
  }
  if (kind === 'event' && Object.hasOwn(value, 'countdown') && isRecord(value.countdown)
    && value.countdown.reference === 'end' && timing?.mode === 'time' && !timing.hasEnd) {
    issue(issues, 'countdown.reference', 'missing_end', '종료 시각이 없는 일정은 시작 시각을 기준으로 설정해 주세요.');
  }
  if (kind === 'deadline' || kind === 'window') {
    validateChecklist(value.checklist, issues);
    if (timing) {
      const hasTimingStart = timing.hasStart;
      if (kind === 'window' && !hasTimingStart) {
        issue(issues, 'timing', 'required', '기간 시작 시각이 필요합니다.');
      }
      validateStartCountdown(value.startCountdown, kind === 'window' || hasTimingStart, issues);
    }
  }
  return issues;
}

export function validateProposedItem(
  value: unknown,
): ValidationResult<ProposedCalendarItem> {
  const issues = validateProposalShape(value);
  if (issues.length > 0) return { valid: false, issues };

  // The complete shape and all cross-field constraints were checked above.
  return {
    valid: true,
    value: value as ProposedCalendarItem,
  };
}

export function validateCanonicalItem(value: unknown): ValidationResult<CalendarItem> {
  const issues: FieldIssue[] = [];
  if (!isRecord(value)) {
    issue(issues, '', 'invalid_type', '항목 객체가 필요합니다.');
    return { valid: false, issues };
  }

  const proposal: ValueRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if ((SERVER_METADATA_KEYS as readonly string[]).includes(key)) continue;
    proposal[key] = entry;
  }
  const proposedResult = validateProposedItem(proposal);
  if (!proposedResult.valid) issues.push(...proposedResult.issues);

  if (!Number.isInteger(value.revision) || Number(value.revision) < 1) {
    issue(issues, 'revision', 'invalid_value', 'revision은 1 이상의 정수여야 합니다.');
  }
  if (!isUtcInstant(value.updatedAt)) {
    issue(issues, 'updatedAt', 'invalid_instant', '밀리초 단위 UTC ISO 시각이 필요합니다.');
  }
  if (value.deletedAt !== null && !isUtcInstant(value.deletedAt)) {
    issue(issues, 'deletedAt', 'invalid_instant', 'UTC ISO 시각 또는 null이어야 합니다.');
  }
  if (!isNonEmptyString(value.lastMutationId)) {
    issue(issues, 'lastMutationId', 'invalid_value', '비어 있지 않은 lastMutationId가 필요합니다.');
  }
  if (typeof value.lastMutationDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.lastMutationDigest)) {
    issue(issues, 'lastMutationDigest', 'invalid_value', 'lastMutationDigest는 소문자 16진수 64자여야 합니다.');
  }
  if (issues.length > 0 || !proposedResult.valid) return { valid: false, issues };

  // The proposal is validated as a discriminated union and metadata above.
  return {
    valid: true,
    value: {
      ...proposedResult.value,
      revision: value.revision as number,
      updatedAt: value.updatedAt as string,
      deletedAt: value.deletedAt as string | null,
      lastMutationId: value.lastMutationId as string,
      lastMutationDigest: value.lastMutationDigest as string,
    } as CalendarItem,
  };
}

export type { Completion, ItemTiming };
