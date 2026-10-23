import { Temporal } from '@js-temporal/polyfill';

export function parseRouteDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return Temporal.PlainDate.from(value).toString();
  } catch {
    return null;
  }
}

export function updateRouteSearchParam(name: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function updateRouteDate(date: string): void {
  updateRouteSearchParam('date', date);
}
