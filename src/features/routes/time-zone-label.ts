export const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: '한국 · 서울' },
  { value: 'America/New_York', label: '미국 동부 · 뉴욕' },
  { value: 'America/Chicago', label: '미국 중부 · 시카고' },
  { value: 'America/Denver', label: '미국 산악 · 덴버' },
  { value: 'America/Los_Angeles', label: '미국 서부 · 로스앤젤레스' },
  { value: 'Asia/Dubai', label: '중동 · 두바이' },
  { value: 'Asia/Riyadh', label: '중동 · 리야드' },
  { value: 'Asia/Tokyo', label: '일본 · 도쿄' },
  { value: 'Europe/London', label: '유럽 · 런던' },
  { value: 'Europe/Paris', label: '유럽 · 파리' },
  { value: 'Europe/Berlin', label: '유럽 · 베를린' },
  { value: 'Asia/Shanghai', label: '중국 · 상하이' },
] as const;

export type TimeZoneOption = { value: string; label: string };

export function getTimeZoneOptions(currentTimeZone: string): readonly TimeZoneOption[] {
  if (TIME_ZONE_OPTIONS.some((option) => option.value === currentTimeZone)) return TIME_ZONE_OPTIONS;
  return [{ value: currentTimeZone, label: '현재 설정' }, ...TIME_ZONE_OPTIONS];
}

export function formatTimeZoneLabel(timeZone: string, regionAndCity: string, instant = new Date()): string {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const normalizedOffset = offset === 'GMT' ? 'UTC+0:00' : offset?.replace(/^GMT([+-])0(\d):/, 'UTC$1$2:').replace(/^GMT([+-])/, 'UTC$1');
  const city = regionAndCity.split('·').at(-1)?.trim() || regionAndCity;
  return normalizedOffset ? `${city} · ${normalizedOffset}` : city;
}
