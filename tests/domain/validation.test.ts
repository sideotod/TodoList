import { describe, expect, it } from 'vitest';
import {
  makeDeadline,
  makeEvent,
  makeTask,
  makeWindow,
  withCanonicalMetadata,
} from '../fixtures/items';
import {
  validateCanonicalItem,
  validateProposedItem,
} from '../../src/domain/validation';

describe('validateProposedItem', () => {
  it('accepts the V1 proposal without deferred reminders', () => {
    const proposal: Record<string, unknown> = { ...makeTask() };
    delete proposal.reminders;
    expect(validateProposedItem(proposal).valid).toBe(true);
  });

  it('accepts valid custom category colors and rejects malformed hex colors', () => {
    expect(validateProposedItem(makeTask({ category: '연구', categoryColor: '#3B82F6' })).valid).toBe(true);
    expect(validateProposedItem({ ...makeTask(), category: '연구', categoryColor: '#xyz' }).valid).toBe(false);
  });

  it('rejects the deferred reminders field rather than silently losing it', () => {
    expect(validateProposedItem({ ...makeTask(), reminders: [] }).valid).toBe(false);
  });

  it('reject_blank_title', () => {
    expect(validateProposedItem(makeTask({ title: ' \n\t ' })).valid).toBe(false);
  });

  it('task_has_no_range', () => {
    const dateTask = {
      ...makeTask(),
      timing: {
        type: 'date',
        startDate: '2026-10-02',
        endDate: '2026-10-03',
        timeZone: 'Asia/Seoul',
      },
    };
    const timeTask = {
      ...makeTask(),
      timing: {
        type: 'time',
        startAt: '2026-10-02T01:00:00.000Z',
        endAt: '2026-10-03T01:00:00.000Z',
        timeZone: 'Asia/Seoul',
      },
    };

    expect(validateProposedItem(dateTask).valid).toBe(false);
    expect(validateProposedItem(timeTask).valid).toBe(false);
  });

  it('event_requires_start_but_allows_an_unknown_end', () => {
    const noDateStart = {
      ...makeEvent(),
      timing: {
        type: 'date',
        startDate: null,
        endDate: '2026-10-03',
        timeZone: 'Asia/Seoul',
      },
    };
    const noTimeEnd = {
      ...makeEvent(),
      timing: {
        type: 'time',
        startAt: '2026-10-02T01:00:00.000Z',
        endAt: null,
        timeZone: 'Asia/Seoul',
      },
    };

    expect(validateProposedItem(noDateStart).valid).toBe(false);
    expect(validateProposedItem(noTimeEnd).valid).toBe(true);
  });

  it('window_unknown_end_only_for_time', () => {
    const dateWindowWithoutEnd = {
      ...makeWindow(),
      timing: {
        type: 'date',
        startDate: '2026-10-03',
        endDate: null,
        timeZone: 'Asia/Seoul',
      },
    };
    const timeWindowWithoutEnd = {
      ...makeWindow(),
      timing: {
        type: 'time',
        startAt: '2026-10-02T01:00:00.000Z',
        endAt: null,
        timeZone: 'Asia/Seoul',
      },
      startCountdown: { enabled: true, daysBefore: 1 },
    };

    expect(validateProposedItem(dateWindowWithoutEnd).valid).toBe(false);
    expect(validateProposedItem(timeWindowWithoutEnd).valid).toBe(true);
  });

  it('checklist_limits_and_unique_ids', () => {
    const tooMany = Array.from({ length: 5 }, (_, index) => ({
      id: `check-${index}`,
      title: `단계 ${index}`,
      completed: false,
    }));
    const duplicateIds = [
      { id: 'same-id', title: '첫 단계', completed: false },
      { id: 'same-id', title: '다음 단계', completed: false },
    ];

    expect(validateProposedItem(makeDeadline({ checklist: tooMany.slice(0, 4) })).valid).toBe(true);
    expect(validateProposedItem(makeDeadline({ checklist: tooMany }))).toMatchObject({ valid: false, issues: [{ path: 'checklist', code: 'too_many_items' }] });
    expect(validateProposedItem(makeDeadline({ checklist: duplicateIds })).valid).toBe(false);
  });

  it('accepts legacy independent checklist rows and validates optional stable task links', () => {
    const linked = makeDeadline({ checklist: [{ id: 'step-1', title: '자료 준비', completed: false, linkedTaskId: 'task-1' }] });
    const legacy = makeDeadline({ checklist: [{ id: 'step-2', title: '기존 항목', completed: true }] });

    expect(validateProposedItem(linked).valid).toBe(true);
    expect(validateProposedItem(legacy).valid).toBe(true);
    expect(validateProposedItem(makeDeadline({ checklist: [{ id: 'step-3', title: '잘못된 연결', completed: false, linkedTaskId: '' }] })).valid).toBe(false);
  });

  it('metadata_not_allowed_in_proposal', () => {
    expect(validateProposedItem({ ...makeTask(), revision: 1 }).valid).toBe(false);
  });

  it('accepts a one-day date event and rejects a zero-length time event', () => {
    const sameDate = makeEvent();
    const sameInstant = {
      ...makeEvent(),
      timing: {
        type: 'time',
        startAt: '2026-10-02T01:00:00.000Z',
        endAt: '2026-10-02T01:00:00.000Z',
        timeZone: 'Asia/Seoul',
      },
    };

    expect(validateProposedItem(sameDate).valid).toBe(true);
    expect(validateProposedItem(sameInstant).valid).toBe(false);
  });

  it('accepts an event countdown with a selected start or end reference', () => {
    const event = makeEvent({ countdown: { enabled: true, daysBefore: 3, reference: 'end' } });
    expect(validateProposedItem(event).valid).toBe(true);
    expect(validateProposedItem({ ...event, countdown: { enabled: true, daysBefore: 31, reference: 'end' } }).valid).toBe(false);
    expect(validateProposedItem({ ...event, countdown: { enabled: true, daysBefore: 3, reference: 'middle' } }).valid).toBe(false);
  });

  it('accepts an explicit choice to keep an event out of the home progress summary', () => {
    expect(validateProposedItem({ ...makeEvent(), showInProgressSummary: false }).valid).toBe(true);
    expect(validateProposedItem({ ...makeEvent(), showInProgressSummary: 'false' }).valid).toBe(false);
  });

  it('validates weekly recurrence weekdays and an inclusive end date', () => {
    const weekly = makeEvent({
      timing: { type: 'date', startDate: '2026-10-03', endDate: '2026-10-03', timeZone: 'Asia/Seoul' },
      recurrence: { frequency: 'weekly', daysOfWeek: [6], untilDate: '2026-10-31' },
    });
    expect(validateProposedItem(weekly).valid).toBe(true);
    expect(validateProposedItem({ ...weekly, recurrence: { ...weekly.recurrence!, daysOfWeek: [6, 6] } }).valid).toBe(false);
    expect(validateProposedItem({ ...weekly, recurrence: { ...weekly.recurrence!, untilDate: '2026-10-02' } }).valid).toBe(false);
  });

  it('rejects end-based event countdowns when the event has no end time', () => {
    const startOnly = makeEvent({
      timing: { type: 'time', startAt: '2026-10-02T01:00:00.000Z', endAt: null, timeZone: 'Asia/Seoul' },
      countdown: { enabled: true, daysBefore: 1, reference: 'end' },
    });
    expect(validateProposedItem(startOnly).valid).toBe(false);
  });

  it('validates a saved multi-day schedule focus', () => {
    expect(validateProposedItem(makeDeadline({ focus: 'deadline' })).valid).toBe(true);
    expect(validateProposedItem({ ...makeDeadline(), focus: 'middle' }).valid).toBe(false);
  });
});

describe('validateCanonicalItem', () => {
  it('accepts a proposal with canonical metadata added separately', () => {
    expect(validateCanonicalItem(withCanonicalMetadata(makeTask())).valid).toBe(true);
  });
});
