import { expect, test } from '@playwright/test';

test('collapsed all-day label stays on one line without shifting weekday columns', async ({ page }) => {
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/calendar/?preview=design');

    const allDay = page.getByRole('region', { name: '종일·기간 일정' });
    const toggle = allDay.locator('button[aria-controls="week-all-day-board"]');
    await toggle.click();
    await expect(toggle).toContainText(/\d+개/);

    const textLineCounts = await toggle.locator('span').evaluateAll((spans) => spans.map((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.y))).size;
    }));

    expect(textLineCounts).toEqual([1, 1]);

    const layout = await page.evaluate(() => {
      const allDay = document.querySelector('[aria-label="종일·기간 일정"]');
      const toggle = allDay?.querySelector('button[aria-controls="week-all-day-board"]');
      const firstDate = document.querySelector('[aria-label="주간 날짜"] > div');
      const firstAllDayCell = document.querySelector('#week-all-day-board > div');
      const buttonRect = toggle?.getBoundingClientRect();
      const sectionRect = allDay?.getBoundingClientRect();
      return {
        dateColumnLeft: firstDate?.getBoundingClientRect().left,
        allDayColumnLeft: firstAllDayCell?.getBoundingClientRect().left,
        labelRight: buttonRect?.right,
        sectionRight: sectionRect?.right,
      };
    });
    expect(layout.dateColumnLeft).not.toBeUndefined();
    expect(layout.allDayColumnLeft).not.toBeUndefined();
    expect(layout.labelRight).not.toBeUndefined();
    expect(layout.sectionRight).not.toBeUndefined();
    expect(Math.abs(layout.dateColumnLeft! - layout.allDayColumnLeft!)).toBeLessThanOrEqual(1);
    expect(layout.labelRight).toBeLessThanOrEqual(layout.sectionRight!);
  }
});
