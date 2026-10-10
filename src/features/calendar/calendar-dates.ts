const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export type CalendarCell = { date: string; inMonth: boolean; dayOfMonth: number; weekday: number };

function utcDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateKey(date: Date): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftDate(date: string, amount: number): string {
  const shifted = utcDate(date);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return dateKey(shifted);
}

export function getMonthCells(monthKey: string): CalendarCell[] {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayOffset = first.getUTCDay();
  const rowCount = Math.ceil((firstDayOffset + lastDay) / 7);
  const start = new Date(Date.UTC(year, month - 1, 1 - firstDayOffset, 12));

  return Array.from({ length: rowCount * 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const cellDate = dateKey(date);
    return {
      date: cellDate,
      inMonth: date.getUTCMonth() === month - 1,
      dayOfMonth: date.getUTCDate(),
      weekday: date.getUTCDay(),
    };
  });
}

export function getMonthHeading(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export function formatKoreanDate(date: string, timeZone = 'Asia/Seoul'): string {
  const parsed = utcDate(date);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone,
  }).formatToParts(parsed);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const month = (values.get('month') ?? '').replace(/월$/, '');
  const day = (values.get('day') ?? '').replace(/일$/, '');
  return `${month}월 ${day}일 (${values.get('weekday')})`;
}

export function formatCalendarHeading(date: string): string {
  const parsed = utcDate(date);
  const parts = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).formatToParts(parsed);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('month')}월 ${values.get('day')}일 ${values.get('weekday')}`;
}

export function getWeekdayLabels(): readonly string[] {
  return WEEKDAYS;
}

export function getDateMonth(date: string): string {
  return date.slice(0, 7);
}

export function moveToMonthDate(date: string, targetMonth: string): string {
  const [, , dayValue] = date.split('-');
  const [year, month] = targetMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(dayValue), lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
