import { describe, expect, it } from 'vitest';
import { formatDateDisplay, parseDateDraft, parseTimeDraft } from '../../src/features/items/date-time-picker';

describe('date and time picker input parsing', () => {
  it('formats a stored date and accepts ISO or dotted date input', () => {
    expect(formatDateDisplay('2026-10-09')).toBe('2026. 10. 09.');
    expect(parseDateDraft('2026-10-09')).toBe('2026-10-09');
    expect(parseDateDraft('2026. 10. 9.')).toBe('2026-10-09');
    expect(parseDateDraft('2026-02-30')).toBeNull();
  });

  it('accepts only valid 24-hour times', () => {
    expect(parseTimeDraft('09:05')).toBe('09:05');
    expect(parseTimeDraft('23:59')).toBe('23:59');
    expect(parseTimeDraft('24:00')).toBeNull();
    expect(parseTimeDraft('09:60')).toBeNull();
  });
});
