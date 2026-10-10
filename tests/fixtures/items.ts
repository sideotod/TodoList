import type {
  CalendarItem,
  ProposedCalendarItem,
  ProposedDeadlineItem,
  ProposedEventItem,
  ProposedTaskItem,
  ProposedWindowItem,
} from '../../src/domain/items';

const DATE = '2026-10-03';
const NEXT_DATE = '2026-10-04';
const ZONE = 'Asia/Seoul';

export function makeTask(overrides: Partial<ProposedTaskItem> = {}): ProposedTaskItem {
  return {
    id: 'task-1',
    kind: 'task',
    title: '과제 제출',
    timing: { type: 'unscheduled' },
    completion: 'pending',
    ...overrides,
  };
}

export function makeDeadline(overrides: Partial<ProposedDeadlineItem> = {}): ProposedDeadlineItem {
  return {
    id: 'deadline-1',
    kind: 'deadline',
    title: '장학금 신청 마감',
    timing: {
      type: 'date',
      startDate: null,
      endDate: DATE,
      timeZone: ZONE,
    },
    completion: 'pending',
    checklist: [],
    startCountdown: null,
    ...overrides,
  };
}

export function makeWindow(overrides: Partial<ProposedWindowItem> = {}): ProposedWindowItem {
  return {
    id: 'window-1',
    kind: 'window',
    title: '수강 신청',
    timing: {
      type: 'date',
      startDate: DATE,
      endDate: NEXT_DATE,
      timeZone: ZONE,
    },
    completion: 'pending',
    checklist: [],
    startCountdown: { enabled: true, daysBefore: 1 },
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<ProposedEventItem> = {}): ProposedEventItem {
  return {
    id: 'event-1',
    kind: 'event',
    title: '세미나',
    timing: {
      type: 'date',
      startDate: DATE,
      endDate: DATE,
      timeZone: ZONE,
    },
    ...overrides,
  };
}

export function withCanonicalMetadata(
  item: ProposedCalendarItem,
  overrides: Partial<Pick<CalendarItem, 'revision' | 'updatedAt' | 'deletedAt' | 'lastMutationId' | 'lastMutationDigest'>> = {},
): CalendarItem {
  return {
    ...item,
    revision: 1,
    updatedAt: '2026-10-02T15:00:00.000Z',
    deletedAt: null,
    lastMutationId: 'operation-1',
    lastMutationDigest: 'a'.repeat(64),
    ...overrides,
  } as CalendarItem;
}
