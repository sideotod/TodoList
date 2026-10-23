import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DESIGN_PREVIEW_DATE, DESIGN_PREVIEW_ITEMS } from '../../../src/features/home/preview-data';
import { SelectedDayTasks } from '../../../src/features/home/SelectedDayTasks';

describe('selected day agenda', () => {
  it('puts tasks first and excludes duplicate D-day deadlines from the secondary agenda', () => {
    const html = renderToStaticMarkup(createElement(SelectedDayTasks, {
      categories: [{ name: '기본', color: 'teal' }],
      date: DESIGN_PREVIEW_DATE,
      items: DESIGN_PREVIEW_ITEMS,
      taskOrder: { pending: [], completed: [] },
    }));

    expect(html).toContain('선택한 날짜의 일정과 할 일');
    expect(html).toContain('일정');
    expect(html).toContain('연구실 세미나');
    expect(html).not.toContain('학회 논문 제출');
    expect(html.indexOf('aria-label="할 일"')).toBeLessThan(html.indexOf('aria-label="일정"'));
    expect(html).toContain('할 일');
    expect(html).toContain('논문 초안 정리');
  });
});
