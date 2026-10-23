import { describe, expect, it } from 'vitest';
import { parseRouteDate } from '../../src/lib/route-date';

describe('parseRouteDate', () => {
  it('accepts a real ISO calendar date', () => {
    expect(parseRouteDate('2026-10-11')).toBe('2026-10-11');
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseRouteDate('2026-2-03')).toBeNull();
    expect(parseRouteDate('2026-02-30')).toBeNull();
    expect(parseRouteDate(null)).toBeNull();
  });
});
