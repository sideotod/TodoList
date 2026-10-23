import { describe, expect, it } from 'vitest';
import { buildProposal, getEffectiveItemKind, type BuildInput } from '../../src/features/items/item-editor-proposal';
import { getCountdownTargetLabel, getCountdownWindowLabel } from '../../src/features/items/countdown-copy';
import { parseLocalDateTime } from '../../src/domain/time';
import { makeDeadline, makeEvent, makeTask, makeWindow } from '../fixtures/items';
import type { ProposedCalendarItem } from '../../src/domain/items';

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    id: 'new-item', kind: 'event', title: '입력 제목', category: '', categoryColor: '#0066CC', notes: '', sourceUrl: '',
    mode: 'time', timeZone: 'Asia/Seoul', startDate: '2026-10-11', endDate: '2026-10-13', startClock: '09:00', endClock: '17:00',
    startResolution: parseLocalDateTime('2026-10-11', '09:00', 'Asia/Seoul'), endResolution: parseLocalDateTime('2026-10-13', '17:00', 'Asia/Seoul'),
    startFold: null, endFold: null, hasEventEnd: true, hasDeadlineStart: true, hasWindowEnd: true,
    includeEventColor: true, showInProgressSummary: false, completion: 'pending', checklist: [],
    countdownEnabled: true, daysBefore: 3, eventCountdownReference: 'end',
    onFieldError: () => {}, ...overrides,
  };
}

describe('editor proposal', () => {
  it('converts only new multi-day drafts and keeps an existing kind', () => {
    expect(getEffectiveItemKind(null, 'event', true, 'start')).toBe('window');
    expect(getEffectiveItemKind(null, 'event', true, 'deadline')).toBe('deadline');
    expect(getEffectiveItemKind(null, 'event', false, 'deadline')).toBe('event');
    for (const kind of ['task', 'event', 'deadline', 'window'] as const) {
      expect(getEffectiveItemKind(kind, 'event', true, 'start')).toBe(kind);
    }
  });

  it('saves the displayed shared countdown to the actual period, without event-only fields', () => {
    for (const kind of ['window', 'deadline'] as const) {
      const result = buildProposal(input({ kind, focus: kind === 'window' ? 'start' : 'deadline' }));
      expect(result).toMatchObject({ kind, startCountdown: { enabled: true, daysBefore: 3 } });
      expect(result).not.toHaveProperty('countdown');
      expect(result).not.toHaveProperty('showInProgressSummary');
      expect(result).not.toHaveProperty('recurrence');
    }
  });

  it.each([false, true])('preserves countdown enabled=%s and 0/1/30 without substituting defaults', (enabled) => {
    for (const daysBefore of [0, 1, 30]) {
      expect(buildProposal(input({ kind: 'window', countdownEnabled: enabled, daysBefore }))).toMatchObject({ startCountdown: { enabled, daysBefore } });
    }
  });

  const imported = { uid: 'ical-id', occurrenceKey: 'occurrence', componentFingerprint: 'fingerprint' };
  const originals: ProposedCalendarItem[] = [
    makeTask({ importSource: imported, categoryColor: '#123456', completion: 'completed' }),
    makeTask({ timing: { type: 'time', startAt: null, endAt: '2026-11-01T06:30:42.123Z', timeZone: 'America/New_York' } }),
    makeEvent({ timing: { type: 'time', startAt: '2026-11-01T06:30:42.123Z', endAt: null, timeZone: 'America/New_York' }, importSource: imported }),
    makeEvent({ categoryColor: '#abcdef', notes: '', sourceUrl: '', showInProgressSummary: false, countdown: { enabled: false, daysBefore: 0, reference: 'end' }, recurrence: { frequency: 'weekly', daysOfWeek: [1, 3], untilDate: '2026-12-31' } }),
    makeDeadline({ focus: 'deadline', timing: { type: 'date', startDate: '2026-10-01', endDate: '2026-10-03', timeZone: 'Asia/Seoul' }, startCountdown: { enabled: true, daysBefore: 30 }, importSource: imported, checklist: [{ id: 'child-id', title: '준비', completed: true }], completion: 'completed' }),
    makeDeadline(),
    makeWindow({ focus: 'start', timing: { type: 'time', startAt: '2026-10-01T00:00:45.999Z', endAt: null, timeZone: 'Asia/Seoul' }, importSource: imported }),
  ];
  it.each(originals.map((initial, index) => ({ initial, index })))('title-only round-trip keeps all original fields (#$index)', ({ initial }) => {
    const result = buildProposal(input({
      initial, id: initial.id, kind: initial.kind, title: '제목만 수정',
      notes: initial.notes ?? '', sourceUrl: initial.sourceUrl ?? '',
      completion: 'completion' in initial ? initial.completion ?? 'pending' : 'pending',
      checklist: initial.kind === 'window' || initial.kind === 'deadline' ? initial.checklist : [],
      recurrence: initial.kind === 'event' ? initial.recurrence : undefined,
      focus: initial.kind === 'window' || initial.kind === 'deadline' ? initial.focus : undefined,
    }));
    expect(result).toStrictEqual({ ...initial, title: '제목만 수정' });
  });

  it('keeps import and color while allowing intentional optional-field removal', () => {
    const initial = makeEvent({ categoryColor: '#123456', category: '연구', notes: '메모', sourceUrl: 'https://example.com', importSource: imported });
    const result = buildProposal(input({ initial, id: initial.id, kind: 'event', category: '', categoryChanged: true, notes: '', sourceUrl: '' }));
    expect(result).toMatchObject({ importSource: imported });
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('sourceUrl');
    expect(result).not.toHaveProperty('category');
  });

  it('reports unchosen DST fold instead of silently choosing the first instant', () => {
    const errors: Record<string, string> = {};
    buildProposal(input({ kind: 'window', timingChanged: true, startResolution: parseLocalDateTime('2026-11-01', '01:30', 'America/New_York'), onFieldError: (path, message) => { errors[path] = message; } }));
    expect(errors['timing.startAt']).toContain('첫 번째/두 번째');
  });

  it('changing only the end keeps the untouched start second and DST occurrence', () => {
    const initial = makeEvent({ timing: { type: 'time', startAt: '2026-11-01T06:30:42.123Z', endAt: '2026-11-01T07:30:27.789Z', timeZone: 'America/New_York' } });
    const errors: Record<string, string> = {};
    const result = buildProposal(input({ initial, id: initial.id, kind: 'event', timingChanged: true, timeZone: 'America/New_York', startDate: '2026-11-01', endDate: '2026-11-01', startClock: '01:30', endClock: '03:30', startResolution: parseLocalDateTime('2026-11-01', '01:30', 'America/New_York'), endResolution: parseLocalDateTime('2026-11-01', '03:30', 'America/New_York'), onFieldError: (path, message) => { errors[path] = message; } }));
    expect(errors).toEqual({});
    expect(result).toMatchObject({ timing: { startAt: '2026-11-01T06:30:42.123Z', endAt: '2026-11-01T08:30:00.000Z' } });
  });
});

describe('countdown meaning', () => {
  it('matches the existing actual event/period reference', () => {
    expect(getCountdownTargetLabel('event', 'end')).toBe('종료');
    expect(getCountdownTargetLabel('window', 'end', 'deadline')).toBe('시작');
    expect(getCountdownTargetLabel('deadline', 'start', 'deadline')).toBe('마감');
    expect(getCountdownTargetLabel('deadline', 'end')).toBe('시작');
  });
  it('explains zero as hidden, rather than showing on the day', () => {
    expect(getCountdownWindowLabel(0)).toBe('0일 · 숫자 숨김');
    expect(getCountdownWindowLabel(3)).toBe('3일 전부터');
  });
});
