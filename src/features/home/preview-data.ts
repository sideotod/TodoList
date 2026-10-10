import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import { Temporal } from '@js-temporal/polyfill';
import { validateProposedItem } from '../../domain/validation';
import { shiftDate } from '../calendar/calendar-dates';

export const DESIGN_PREVIEW_NOW = Date.parse('2026-10-02T15:00:00.000Z');
export const DESIGN_PREVIEW_DATE = '2026-10-03';

function previewView(display: ProposedCalendarItem): ItemView {
  return {
    display,
    canonical: null,
    localDraft: null,
    syncState: 'offline-read-only',
    snapshotSource: 'none',
    localSequence: null,
  };
}

export const DESIGN_PREVIEW_ITEMS: readonly ItemView[] = [
  previewView({
    id: 'design-period-paper',
    kind: 'deadline',
    title: '학회 논문 제출',
    timing: {
      type: 'time',
      startAt: '2026-09-29T00:00:00.000Z',
      endAt: '2026-10-10T00:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
    completion: 'pending',
    checklist: [
      { id: 'research', title: '연구 자료 정리', completed: true },
      { id: 'draft', title: '초안 작성', completed: false },
      { id: 'review', title: '지도교수 검토', completed: false },
    ],
    startCountdown: { enabled: false, daysBefore: 1 },
  }),
  previewView({
    id: 'design-window-enrollment',
    kind: 'window',
    title: '수강신청',
    timing: {
      type: 'time',
      startAt: '2026-10-04T00:00:00.000Z',
      endAt: '2026-10-06T08:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
    completion: 'pending',
    checklist: [],
    startCountdown: { enabled: true, daysBefore: 1 },
  }),
  previewView({
    id: 'design-period-scholarship',
    kind: 'window',
    title: '장학금 신청',
    timing: {
      type: 'time',
      startAt: '2026-09-22T00:00:00.000Z',
      endAt: '2026-09-29T00:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
    completion: 'pending',
    checklist: [
      { id: 'scholarship-form', title: '신청서 작성', completed: true },
      { id: 'scholarship-submit', title: '서류 제출', completed: true },
    ],
    startCountdown: { enabled: false, daysBefore: 1 },
  }),
  previewView({
    id: 'design-period-seminar',
    kind: 'deadline',
    title: '학회 등록 기간',
    timing: {
      type: 'time',
      startAt: '2026-09-18T00:00:00.000Z',
      endAt: '2026-09-20T00:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
    completion: 'pending',
    checklist: [],
    startCountdown: { enabled: false, daysBefore: 1 },
  }),
  previewView({
    id: 'design-period-grant',
    kind: 'window',
    title: '연구비 신청 마감',
    timing: {
      type: 'time',
      startAt: '2026-09-08T00:00:00.000Z',
      endAt: '2026-09-16T00:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
    completion: 'pending',
    checklist: [],
    startCountdown: { enabled: false, daysBefore: 1 },
  }),
  previewView({
    id: 'design-event-seminar',
    kind: 'event',
    title: '연구실 세미나',
    timing: {
      type: 'time',
      startAt: '2026-10-03T04:00:00.000Z',
      endAt: '2026-10-03T05:30:00.000Z',
      timeZone: 'Asia/Seoul',
    },
  }),
  previewView({
    id: 'design-event-meeting',
    kind: 'event',
    title: '지도교수 면담',
    timing: {
      type: 'time',
      startAt: '2026-10-05T01:00:00.000Z',
      endAt: '2026-10-05T02:00:00.000Z',
      timeZone: 'Asia/Seoul',
    },
  }),
  previewView({
    id: 'design-task-equipment',
    kind: 'task',
    title: '연구실 장비 신청',
    timing: { type: 'date', startDate: null, endDate: DESIGN_PREVIEW_DATE, timeZone: 'Asia/Seoul' },
    completion: 'completed',
  }),
  previewView({
    id: 'design-task-draft',
    kind: 'task',
    title: '논문 초안 정리',
    timing: { type: 'date', startDate: null, endDate: DESIGN_PREVIEW_DATE, timeZone: 'Asia/Seoul' },
    completion: 'pending',
  }),
  previewView({
    id: 'design-task-meeting',
    kind: 'task',
    title: '지도교수 면담 준비',
    timing: { type: 'date', startDate: null, endDate: DESIGN_PREVIEW_DATE, timeZone: 'Asia/Seoul' },
    completion: 'pending',
  }),
  previewView({
    id: 'design-task-undated',
    kind: 'task',
    title: '연구 아이디어 기록',
    timing: { type: 'unscheduled' },
    completion: 'pending',
  }),
  previewView({
    id: 'design-task-completed-seminar',
    kind: 'task',
    title: '세미나 자료 읽기',
    timing: { type: 'date', startDate: null, endDate: '2026-10-10', timeZone: 'Asia/Seoul' },
    completion: 'completed',
  }),
  ...[
    ['2026-10-01', '연구 회의 자료 확인'],
    ['2026-10-02', '세미나 질문 정리'],
    ['2026-10-07', '발표 자료 수정'],
    ['2026-10-09', '논문 참고문헌 확인'],
    ['2026-10-10', '논문 초안 3장 정리'],
    ['2026-10-14', '실험 로그 정리'],
    ['2026-10-16', '주간 미팅 준비'],
    ['2026-10-19', '초안 피드백 반영'],
    ['2026-10-21', '연구실 세미나'],
    ['2026-10-22', '연구비 계획 점검'],
    ['2026-10-24', '실험 재료 발주'],
    ['2026-10-26', '자료 백업 확인'],
    ['2026-10-28', '학회 신청서 검토'],
    ['2026-10-30', '다음 주 일정 정리'],
  ].map(([date, title], index) => previewView({
    id: `design-task-${index + 1}`,
    kind: 'task',
    title,
    timing: { type: 'date', startDate: null, endDate: date, timeZone: 'Asia/Seoul' },
    completion: 'pending',
  })),
];

export function createLocalPreviewFixture(date: string): { date: string; items: ItemView[] } {
  const dateParts = date.split('-').map(Number);
  const baseParts = DESIGN_PREVIEW_DATE.split('-').map(Number);
  const dayOffset = Math.round((Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]) - Date.UTC(baseParts[0], baseParts[1] - 1, baseParts[2])) / 86_400_000);
  const items = DESIGN_PREVIEW_ITEMS.map((item) => {
    const timing = item.display.timing;
    if (timing.type === 'unscheduled' || dayOffset === 0) return item;
    const shifted = timing.type === 'date'
      ? {
          ...item.display,
          timing: {
            ...timing,
            startDate: timing.startDate ? shiftDate(timing.startDate, dayOffset) : null,
            endDate: shiftDate(timing.endDate, dayOffset),
          },
        }
      : {
          ...item.display,
          timing: {
            ...timing,
            startAt: timing.startAt ? shiftInstant(timing.startAt, timing.timeZone, dayOffset) : null,
            endAt: timing.endAt ? shiftInstant(timing.endAt, timing.timeZone, dayOffset) : null,
          },
        };
    const result = validateProposedItem(shifted);
    return result.valid ? previewView(result.value) : item;
  });
  return { date, items };
}

function shiftInstant(instant: string, timeZone: string, days: number): string {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .add({ days })
    .toInstant()
    .toString({ fractionalSecondDigits: 3 });
}
