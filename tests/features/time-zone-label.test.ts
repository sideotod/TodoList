import { describe, expect, it } from 'vitest';
import { formatTimeZoneLabel, getTimeZoneOptions } from '../../src/features/routes/time-zone-label';

describe('formatTimeZoneLabel', () => {
  it('shows the selected city with its real UTC offset at the supplied instant', () => {
    expect(formatTimeZoneLabel('Asia/Seoul', '한국 · 서울', new Date('2026-10-09T00:00:00Z')))
      .toBe('서울 · UTC+9:00');
    expect(formatTimeZoneLabel('America/New_York', '미국 동부 · 뉴욕', new Date('2026-10-09T00:00:00Z')))
      .toBe('뉴욕 · UTC-4:00');
  });

  it('uses the daylight saving offset for the selected instant', () => {
    expect(formatTimeZoneLabel('America/Los_Angeles', '미국 서부 · 로스앤젤레스', new Date('2026-07-09T00:00:00Z')))
      .toBe('로스앤젤레스 · UTC-7:00');
    expect(formatTimeZoneLabel('America/Los_Angeles', '미국 서부 · 로스앤젤레스', new Date('2026-12-09T00:00:00Z')))
      .toBe('로스앤젤레스 · UTC-8:00');
  });

  it('offers separate region and city choices backed by IANA time zones', () => {
    const options = getTimeZoneOptions('Asia/Seoul');
    expect(options).toEqual(expect.arrayContaining([
      { value: 'Asia/Seoul', label: '한국 · 서울' },
      { value: 'America/New_York', label: '미국 동부 · 뉴욕' },
      { value: 'America/Los_Angeles', label: '미국 서부 · 로스앤젤레스' },
      { value: 'Asia/Dubai', label: '중동 · 두바이' },
      { value: 'Asia/Riyadh', label: '중동 · 리야드' },
      { value: 'Asia/Tokyo', label: '일본 · 도쿄' },
      { value: 'Europe/Berlin', label: '유럽 · 베를린' },
      { value: 'Asia/Shanghai', label: '중국 · 상하이' },
    ]));
    expect(options.map((option) => option.label).join(' ')).not.toMatch(/UTC|GMT|[+-]\d{2}:?\d{2}/);
  });

  it('keeps an existing IANA setting selectable if it is outside the common choices', () => {
    expect(getTimeZoneOptions('UTC')[0]).toEqual({ value: 'UTC', label: '현재 설정' });
  });
});
