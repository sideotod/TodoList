import { describe, expect, it } from 'vitest';
import { isKoreanPublicHoliday } from '../../src/features/calendar/korean-holidays';

describe('Korean public holidays', () => {
  it('marks lunar holidays and their substitute days', () => {
    expect(isKoreanPublicHoliday('2026-02-16')).toBe(true);
    expect(isKoreanPublicHoliday('2026-02-17')).toBe(true);
    expect(isKoreanPublicHoliday('2026-02-18')).toBe(true);
    expect(isKoreanPublicHoliday('2026-10-03')).toBe(true);
    expect(isKoreanPublicHoliday('2026-10-05')).toBe(true);
    expect(isKoreanPublicHoliday('2026-10-09')).toBe(true);
  });

  it('distinguishes ordinary weekend days and fixed holidays', () => {
    expect(isKoreanPublicHoliday('2026-10-10')).toBe(false);
    expect(isKoreanPublicHoliday('2026-07-17')).toBe(true);
    expect(isKoreanPublicHoliday('2025-07-17')).toBe(false);
  });
});
