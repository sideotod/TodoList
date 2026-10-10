import { describe, expect, it } from 'vitest';
import type { ItemView, PendingDraft, ProposedCalendarItem } from '../../src/domain/items';
import { deriveChecklistStatus, selectCalendarAgenda, selectDailyTasks, selectHomePeriods, selectPeriodGroups, selectUrgentHomeTimeline } from '../../src/domain/projections';
import { getNextWeeklyOccurrence, getWeeklyOccurrenceForDate } from '../../src/domain/recurrence';
import { makeDeadline, makeEvent, makeTask, makeWindow, withCanonicalMetadata } from '../fixtures/items';

const ms = (value: string): number => Date.parse(value);
const ZONE = 'Asia/Seoul';
const view = (display: ProposedCalendarItem): ItemView => ({ display, canonical: withCanonicalMetadata(display), localDraft: null, syncState: 'synced', snapshotSource: 'server', localSequence: null });
const ids = (items: readonly ItemView[]): string[] => items.map((item) => item.display.id);
const timedWindow = (id: string, startAt: string, endAt: string | null): ItemView => view(makeWindow({ id, timing: { type: 'time', startAt, endAt, timeZone: ZONE } }));

function pendingDelete(display: ProposedCalendarItem): PendingDraft {
  return {
    uid: 'user-1', itemId: display.id, localSequence: 1, operationId: 'delete-1',
    predecessorOperationId: null, baseRevision: 1, baseSnapshot: display,
    proposedSnapshot: display, mutationKind: 'delete', stage: 'queued',
    payloadDigest: 'b'.repeat(64), createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
  };
}

describe('checklist status', () => {
  it('DATA-06 derives none, incomplete, complete and reopens after an addition', () => {
    const done = { id: 'a', title: '첫 단계', completed: true };
    const pending = { id: 'b', title: '다음 단계', completed: false };
    expect(deriveChecklistStatus([])).toEqual({ kind: 'none', total: 0 });
    expect(deriveChecklistStatus([pending])).toEqual({ kind: 'incomplete', remaining: 1, total: 1 });
    expect(deriveChecklistStatus([done])).toEqual({ kind: 'complete', remaining: 0, total: 1 });
    expect(deriveChecklistStatus([done, pending])).toEqual({ kind: 'incomplete', remaining: 1, total: 2 });
    expect(deriveChecklistStatus([done, { ...pending, completed: true }])).toEqual({ kind: 'complete', remaining: 0, total: 2 });
  });

  it('DATA-04/06 parent completion and checklist completion never change each other', () => {
    const pendingParent = makeDeadline({ checklist: [{ id: 'a', title: '준비', completed: true }] });
    const completedParent = makeDeadline({ completion: 'completed', checklist: [{ id: 'b', title: '추가 작업', completed: false }] });
    expect(deriveChecklistStatus(pendingParent.checklist).kind).toBe('complete');
    expect(pendingParent.completion).toBe('pending');
    expect(deriveChecklistStatus(completedParent.checklist).kind).toBe('incomplete');
    expect(completedParent.completion).toBe('completed');
    expect(ids(selectHomePeriods([view(completedParent), view(pendingParent)], ms('2026-10-03T00:00:00.000Z')).visible)).toEqual(['deadline-1']);
  });
});

describe('home period ordering and groups', () => {
  const early = timedWindow('early', '2026-10-03T01:00:00.000Z', '2026-10-03T08:00:00.000Z');
  const later = view(makeDeadline({ id: 'later', timing: { type: 'time', startAt: null, endAt: '2026-10-03T02:00:00.000Z', timeZone: ZONE } }));
  const open = timedWindow('open', '2026-10-02T01:00:00.000Z', null);
  const expired = timedWindow('expired', '2026-10-01T01:00:00.000Z', '2026-10-02T02:00:00.000Z');
  const older = timedWindow('older', '2026-09-30T01:00:00.000Z', '2026-10-01T02:00:00.000Z');

  it('home_overflow_and_phase_transition switches the ranking boundary at start', () => {
    const input = [older, open, early, expired, later];
    const before = ms('2026-10-03T00:00:00.000Z');
    expect(ids(selectHomePeriods(input, before).visible)).toEqual(['early', 'later']);
    expect(selectHomePeriods(input, before).hiddenIncompleteCount).toBe(3);
    expect(ids(selectHomePeriods(input, before + 1_000).visible)).toEqual(['early', 'later']);
    expect(ids(selectHomePeriods(input, ms('2026-10-03T01:00:00.000Z')).visible)).toEqual(['later', 'early']);
    expect(ids(selectHomePeriods([older, expired, open], before).visible)).toEqual(['open', 'expired']);
    expect(ids(selectHomePeriods([older, expired], before).visible)).toEqual(['expired', 'older']);
    expect(ids(input)).toEqual(['older', 'open', 'early', 'expired', 'later']);
  });

  it('TIME-14 stable ties put start before end then compare item IDs', () => {
    const startZ = timedWindow('z-start', '2026-10-03T02:00:00.000Z', null);
    const startA = timedWindow('a-start', '2026-10-03T02:00:00.000Z', null);
    const now = ms('2026-10-03T00:00:00.000Z');
    expect(ids(selectHomePeriods([later, startZ, startA], now).visible)).toEqual(['a-start', 'z-start']);
    expect(ids(selectHomePeriods([startA, later, startZ], now).visible)).toEqual(['a-start', 'z-start']);
  });

  it('does not count completed, deleted, pending deletes, tasks or events in overflow', () => {
    const completed = view(makeDeadline({ id: 'done', completion: 'completed' }));
    const deleted = view(makeDeadline({ id: 'deleted' }));
    deleted.canonical = withCanonicalMetadata(deleted.display, { deletedAt: '2026-10-03T00:00:00.000Z' });
    const pendingDeletion = { ...open, localDraft: pendingDelete(open.display) };
    const now = ms('2026-10-03T00:00:00.000Z');
    expect(selectHomePeriods([], now)).toEqual({ visible: [], hiddenIncompleteCount: 0 });
    expect(ids(selectHomePeriods([early], now).visible)).toEqual(['early']);
    expect(selectHomePeriods([completed, deleted, pendingDeletion, view(makeTask()), view(makeEvent()), early], now).hiddenIncompleteCount).toBe(0);
  });

  it('date-end ranking uses next local day while scheduled periods use their start', () => {
    const dated = view(makeDeadline({ id: 'date-end', timing: { type: 'date', startDate: null, endDate: '2026-10-03', timeZone: ZONE } }));
    const nextStart = timedWindow('next-start', '2026-10-03T15:00:00.000Z', null);
    expect(ids(selectHomePeriods([dated, nextStart], ms('2026-10-03T00:00:00.000Z')).visible)).toEqual(['next-start', 'date-end']);
    expect(ids(selectPeriodGroups([dated], ms('2026-10-03T14:59:59.999Z')).active)).toEqual(['date-end']);
    expect(ids(selectPeriodGroups([dated], ms('2026-10-03T15:00:00.000Z')).overdue)).toEqual(['date-end']);
  });

  it('period groups sort scheduled, active, overdue and completed independently', () => {
    const doneRecent = view(makeDeadline({ id: 'done-recent', completion: 'completed', timing: { type: 'time', startAt: null, endAt: '2026-10-03T08:00:00.000Z', timeZone: ZONE } }));
    const doneOld = view(makeDeadline({ id: 'done-old', completion: 'completed', timing: { type: 'time', startAt: null, endAt: '2026-10-02T08:00:00.000Z', timeZone: ZONE } }));
    const groups = selectPeriodGroups([older, open, doneOld, early, expired, doneRecent, later], ms('2026-10-03T00:00:00.000Z'));
    expect(ids(groups.scheduled)).toEqual(['early']);
    expect(ids(groups.active)).toEqual(['later', 'open']);
    expect(ids(groups.overdue)).toEqual(['expired', 'older']);
    expect(ids(groups.completed)).toEqual(['done-recent', 'done-old']);
  });
});

describe('home progress timeline', () => {
  it('includes upcoming and active events in timeline cards while leaving ended events for the completed pane', () => {
    const upcoming = view(makeEvent({ id: 'upcoming', timing: { type: 'time', startAt: '2026-10-07T01:00:00.000Z', endAt: '2026-10-07T02:00:00.000Z', timeZone: ZONE } }));
    const active = view(makeEvent({ id: 'active-event', timing: { type: 'time', startAt: '2026-10-06T02:00:00.000Z', endAt: '2026-10-06T04:00:00.000Z', timeZone: ZONE } }));
    const ended = view(makeEvent({ id: 'ended-event', timing: { type: 'time', startAt: '2026-10-05T02:00:00.000Z', endAt: '2026-10-05T04:00:00.000Z', timeZone: ZONE } }));
    const now = ms('2026-10-06T03:00:00.000Z');

    expect(ids(selectUrgentHomeTimeline([upcoming, active, ended], now))).toEqual(['active-event', 'upcoming']);
  });

  it('keeps timed events out of the home progress cards when they are not opted in', () => {
    const calendarOnly = view({
      ...makeEvent({ id: 'calendar-only', timing: { type: 'time', startAt: '2026-10-07T01:00:00.000Z', endAt: '2026-10-07T02:00:00.000Z', timeZone: ZONE } }),
      showInProgressSummary: false,
    });
    const optedIn = view({
      ...makeEvent({ id: 'pinned', timing: { type: 'time', startAt: '2026-10-07T01:00:00.000Z', endAt: '2026-10-07T02:00:00.000Z', timeZone: ZONE } }),
      showInProgressSummary: true,
    });

    expect(ids(selectUrgentHomeTimeline([calendarOnly, optedIn], ms('2026-10-06T03:00:00.000Z')))).toEqual(['pinned']);
  });
});

describe('selected calendar day', () => {
  it('daily tasks include both completion states and exclude event, periods and unscheduled tasks', () => {
    const dated = view(makeTask({ id: 'dated', timing: { type: 'date', startDate: null, endDate: '2026-10-03', timeZone: ZONE } }));
    const done = view(makeTask({ id: 'done', completion: 'completed', timing: { type: 'time', startAt: null, endAt: '2026-10-03T00:00:00.000Z', timeZone: 'America/New_York' } }));
    const next = view(makeTask({ id: 'next', timing: { type: 'time', startAt: null, endAt: '2026-10-03T15:00:00.000Z', timeZone: ZONE } }));
    expect(ids(selectDailyTasks([view(makeEvent()), view(makeWindow()), next, done, view(makeTask()), dated], '2026-10-03', ZONE))).toEqual(['dated', 'done']);
  });

  it('calendar agenda includes date spans and intersects exclusive time intervals in the navigation zone', () => {
    const allDay = view(makeEvent({ id: 'all-day', timing: { type: 'date', startDate: '2026-10-01', endDate: '2026-10-03', timeZone: 'America/New_York' } }));
    const crossing = view(makeEvent({ id: 'crossing', timing: { type: 'time', startAt: '2026-10-02T14:00:00.000Z', endAt: '2026-10-02T16:00:00.000Z', timeZone: 'America/New_York' } }));
    const ended = view(makeEvent({ id: 'ended', timing: { type: 'time', startAt: '2026-10-02T13:00:00.000Z', endAt: '2026-10-02T15:00:00.000Z', timeZone: ZONE } }));
    const open = timedWindow('open', '2026-10-02T14:00:00.000Z', null);
    const due = view(makeDeadline({ id: 'due', timing: { type: 'time', startAt: null, endAt: '2026-10-03T02:00:00.000Z', timeZone: ZONE } }));
    expect(ids(selectCalendarAgenda([due, ended, crossing, allDay, open, view(makeTask())], '2026-10-03', ZONE))).toEqual(['all-day', 'crossing', 'open', 'due']);
    expect(ids(selectCalendarAgenda([allDay], '2026-10-04', ZONE))).toEqual([]);
  });

  it('a timed due instant at navigation midnight belongs only to the new day', () => {
    const due = view(makeTask({ timing: { type: 'time', startAt: null, endAt: '2026-03-09T04:00:00.000Z', timeZone: 'America/New_York' } }));
    expect(selectDailyTasks([due], '2026-03-08', 'America/New_York')).toEqual([]);
    expect(ids(selectDailyTasks([due], '2026-03-09', 'America/New_York'))).toEqual(['task-1']);
  });

  it('projects a weekly event on selected weekdays with its local time and inclusive end date', () => {
    const weekly = view(makeEvent({
      id: 'weekly-seminar',
      timing: { type: 'time', startAt: '2026-10-05T00:00:00.000Z', endAt: '2026-10-05T01:00:00.000Z', timeZone: ZONE },
      recurrence: { frequency: 'weekly', daysOfWeek: [1, 3], untilDate: '2026-10-14' },
    }));

    expect(getWeeklyOccurrenceForDate(weekly, '2026-10-07')?.display.timing).toEqual({
      type: 'time', startAt: '2026-10-07T00:00:00.000Z', endAt: '2026-10-07T01:00:00.000Z', timeZone: ZONE,
    });
    expect(getWeeklyOccurrenceForDate(weekly, '2026-10-08')).toBeNull();
    expect(getWeeklyOccurrenceForDate(weekly, '2026-10-14')?.display.id).toBe('weekly-seminar');
    expect(getWeeklyOccurrenceForDate(weekly, '2026-10-19')).toBeNull();
    expect(ids(selectCalendarAgenda([weekly], '2026-10-07', ZONE))).toEqual(['weekly-seminar']);
  });

  it('uses the next upcoming weekly occurrence for home cards and sorting', () => {
    const weekly = view(makeEvent({
      id: 'weekly-seminar',
      timing: { type: 'time', startAt: '2026-10-05T00:00:00.000Z', endAt: '2026-10-05T01:00:00.000Z', timeZone: ZONE },
      recurrence: { frequency: 'weekly', daysOfWeek: [1, 3], untilDate: null },
    }));
    const next = getNextWeeklyOccurrence(weekly, ms('2026-10-06T01:00:00.000Z'));
    expect(next?.display.timing).toEqual({
      type: 'time', startAt: '2026-10-07T00:00:00.000Z', endAt: '2026-10-07T01:00:00.000Z', timeZone: ZONE,
    });
    expect(ids(selectUrgentHomeTimeline([weekly], ms('2026-10-06T01:00:00.000Z')))).toEqual(['weekly-seminar']);
  });
});
