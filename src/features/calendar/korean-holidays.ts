type HolidayRule = {
  name: string;
  weekendSubstitute: 'both' | 'sunday' | 'none';
  overlapSubstitute: boolean;
};

const holidaysByYear = new Map<number, Set<string>>();
const lunarDateFormatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
});

export function isKoreanPublicHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  if (!Number.isInteger(year) || date.length !== 10) return false;
  let holidays = holidaysByYear.get(year);
  if (!holidays) {
    holidays = createHolidaySet(year);
    holidaysByYear.set(year, holidays);
  }
  return holidays.has(date);
}

function createHolidaySet(year: number): Set<string> {
  const base = new Map<string, HolidayRule[]>();
  const add = (date: string, rule: HolidayRule) => {
    const rules = base.get(date) ?? [];
    rules.push(rule);
    base.set(date, rules);
  };
  const national: HolidayRule = { name: '국경일', weekendSubstitute: 'both', overlapSubstitute: true };
  const lunarSequence: HolidayRule = { name: '설날·추석', weekendSubstitute: 'sunday', overlapSubstitute: true };
  const allWeekend: HolidayRule = { name: '공휴일', weekendSubstitute: 'both', overlapSubstitute: true };
  const none: HolidayRule = { name: '공휴일', weekendSubstitute: 'none', overlapSubstitute: false };

  addDate(year, 1, 1, none, add);
  addDate(year, 3, 1, national, add);
  addDate(year, 5, 5, allWeekend, add);
  addDate(year, 6, 6, none, add);
  addDate(year, 8, 15, national, add);
  addDate(year, 10, 3, national, add);
  addDate(year, 10, 9, national, add);
  addDate(year, 12, 25, allWeekend, add);

  if (year >= 2026) {
    addDate(year, 5, 1, allWeekend, add);
    addDate(year, 7, 17, national, add);
  }
  if (year === 2026) addDate(year, 6, 3, none, add);

  const daysInYear = isLeapYear(year) ? 366 : 365;
  for (let index = 0; index < daysInYear; index += 1) {
    const date = addDays(`${year}-01-01`, index);
    const lunar = getLunarParts(date);
    if (!lunar || lunar.isLeapMonth) continue;
    if ((lunar.month === 1 && (lunar.day === 1 || lunar.day === 2))
      || (lunar.month === 8 && lunar.day >= 14 && lunar.day <= 16)) {
      add(date, lunarSequence);
    }
    if (lunar.month === 4 && lunar.day === 8) add(date, allWeekend);
    const next = getLunarParts(addDays(date, 1));
    if (lunar.month === 12 && next?.month === 1 && next.day === 1) add(date, lunarSequence);
  }

  const observed = new Set<string>();
  for (const [date, rules] of base) {
    const weekday = getWeekday(date);
    const isWeekend = weekday === 0 || weekday === 6;
    const qualifiesByWeekend = rules.some((rule) => rule.weekendSubstitute === 'both'
      || (rule.weekendSubstitute === 'sunday' && weekday === 0));
    const qualifiesByOverlap = rules.some((rule) => rule.overlapSubstitute) && rules.length > 1;
    if ((!isWeekend || !qualifiesByWeekend) && !qualifiesByOverlap) continue;

    let candidate = addDays(date, 1);
    while (getWeekday(candidate) === 0 || base.has(candidate) || observed.has(candidate)) {
      candidate = addDays(candidate, 1);
    }
    observed.add(candidate);
    if (getWeekday(candidate) === 6) {
      candidate = addDays(candidate, 1);
      while (getWeekday(candidate) === 0 || base.has(candidate) || observed.has(candidate)) {
        candidate = addDays(candidate, 1);
      }
      observed.add(candidate);
    }
  }

  return new Set([...base.keys(), ...observed]);
}

function addDate(year: number, month: number, day: number, rule: HolidayRule, add: (date: string, rule: HolidayRule) => void) {
  add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, rule);
}

function getLunarParts(date: string): { month: number; day: number; isLeapMonth: boolean } | null {
  const parts = lunarDateFormatter.formatToParts(new Date(`${date}T12:00:00Z`));
  const monthText = parts.find((part) => part.type === 'month')?.value;
  const dayText = parts.find((part) => part.type === 'day')?.value;
  if (!monthText || !dayText) return null;
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { month, day, isLeapMonth: /bis|leap/i.test(monthText) };
}

function getWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
