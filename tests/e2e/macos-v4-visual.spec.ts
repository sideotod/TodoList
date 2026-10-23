import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1512, height: 982 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
];
const outputDirectory = join(process.cwd(), 'test-results', 'macos-v4');

test('captures the v4 macOS reference screens at the supported desktop sizes', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(outputDirectory, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date('2026-10-23T03:00:00.000Z'));
    const suffix = `${viewport.width}x${viewport.height}`;
    const capture = async (name: string) => {
      await expect(page.locator('[data-app-state]')).toBeVisible();
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(horizontalOverflow, `${name} has horizontal overflow at ${suffix}`).toBe(false);
      await page.screenshot({ path: join(outputDirectory, `${name}-${suffix}.png`), animations: 'disabled' });
    };

    await page.goto('/?preview=design&date=2026-10-23');
    await expect(page.getByRole('heading', { name: '오늘', exact: true })).toBeVisible();
    await capture('today');
    await page.locator('[data-testid="home-workspace"] [data-task-id="design-task-draft"] button').nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture('task-detail');

    await page.goto('/progress/?preview=design');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    await capture('progress');
    await page.locator('article').filter({ hasText: '학회 논문 제출' }).getByRole('button', { name: '학회 논문 제출', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture('progress-detail');

    for (const view of ['day', 'week', 'month', 'year'] as const) {
      await page.goto(`/calendar/?preview=design&date=2026-10-23&view=${view}`);
      await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
      await capture(`calendar-${view}`);
      if (view === 'day') {
        await page.getByRole('button', { name: /연구실 세미나/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await capture('event-detail');
      }
    }

    await page.goto('/settings/?preview=design');
    await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
    await capture('settings');

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(horizontalOverflow, `horizontal overflow at ${suffix}`).toBe(false);
  }
});
