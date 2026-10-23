import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DESIGN_PREVIEW_ITEMS } from '../../../src/features/home/preview-data';
import { MonthTaskGrid } from '../../../src/features/home/MonthTaskGrid';
import { toLocalView } from '../../../src/lib/local-preview-store';
import { makeTask } from '../../fixtures/items';

describe('month agenda', () => {
  it('shows only task counts and task previews on the home calendar', () => {
    const html = renderToStaticMarkup(createElement(MonthTaskGrid, {
      items: DESIGN_PREVIEW_ITEMS,
      month: '2026-10',
      selectedDate: '2026-10-03',
      onSelectDate: () => undefined,
      onChangeMonth: () => undefined,
      showHeading: false,
    }));

    expect(html).toContain('aria-label="10월 3일 (토), 할 일 3개"');
    expect(html).not.toContain('달력 표시 범례');
    expect(html).not.toContain('마감·기간');
    expect(html).not.toContain('장학금 신청');
  });

  it('shows one color marker per task category while keeping the real task count', () => {
    const due = { type: 'date' as const, startDate: null, endDate: '2026-10-20', timeZone: 'Asia/Seoul' };
    const items = [
      toLocalView(makeTask({ id: 'research-one', title: '연구 초안', category: '연구', categoryColor: 'violet', timing: due })),
      toLocalView(makeTask({ id: 'research-two', title: '연구 자료', category: '연구', categoryColor: 'violet', timing: due })),
      toLocalView(makeTask({ id: 'study-one', title: '수업 복습', category: '수업', categoryColor: 'amber', timing: due })),
    ];
    const html = renderToStaticMarkup(createElement(MonthTaskGrid, {
      items,
      month: '2026-10',
      selectedDate: '2026-10-20',
      onSelectDate: () => undefined,
      onChangeMonth: () => undefined,
      showHeading: false,
    }));
    const dateCell = html.match(/<button(?=[^>]*id="month-day-2026-10-20")[\s\S]*?<\/button>/)?.[0];

    expect(dateCell).toContain('할 일 3개');
    expect(dateCell).toContain('연구 초안');
    expect(dateCell).toContain('연구 자료');
    expect(dateCell?.match(/dotDesktop/g)).toHaveLength(2);
  });
});
