import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = 'http://127.0.0.1:3001';
const outputDirectory = path.join(directory, 'evidence');
const viewport = { width: 1512, height: 790 };

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await context.addInitScript(() => {
    localStorage.removeItem('todolist:desktop-preview:v2');
    localStorage.setItem('todolist:desktop-preview:v1', JSON.stringify({
      completedIds: [],
      pending: ['design-task-meeting', 'design-task-equipment', 'design-task-draft'],
      completed: [],
    }));
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/?preview=design`);
  await page.locator('[data-testid="home-workspace"]').waitFor();
  await page.screenshot({ path: path.join(outputDirectory, '01-home-after.png') });
  const homeMetrics = await page.evaluate(() => {
    const measure = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      workspace: measure(document.querySelector('[data-testid="home-workspace"]')),
      periodCards: [...document.querySelectorAll('[data-period-phase]')].slice(0, 3).map((card) => ({
        title: card.getAttribute('aria-label'),
        bounds: measure(card),
        contentClipped: [...card.querySelectorAll('h3, button')].some((node) => node.scrollWidth > node.clientWidth),
        track: measure(card.querySelector('[class*="track"]')),
      })),
      taskList: measure(document.querySelector('[aria-label="선택한 날짜의 할 일"]')),
      markerCount: document.querySelectorAll('[class*="startMarker"]').length,
      desktopDots: [...document.querySelectorAll('[class*="dotDesktop"]')].slice(0, 2).map((node) => measure(node)),
    };
  });

  const expand = page.getByRole('button', { name: /추가 기간 목록 펼치기/ });
  if (await expand.count()) {
    await expand.click();
    await page.getByTestId('period-overflow-overlay').waitFor({ state: 'visible' });
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(outputDirectory, '02-periods-expanded-after.png') });
  }

  await page.goto(`${baseUrl}/calendar/?preview=design`);
  await page.locator('[data-active="calendar"] > div').waitFor();
  await page.screenshot({ path: path.join(outputDirectory, '03-calendar-after.png') });
  const calendarMetrics = await page.evaluate(() => {
    const rect = document.querySelector('[data-active="calendar"] > div')?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      content: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) } : null,
    };
  });

  await page.goto(`${baseUrl}/settings/?preview=design`);
  await page.getByRole('heading', { name: '기기 알림' }).waitFor();
  await page.screenshot({ path: path.join(outputDirectory, '04-settings-after.png') });

  await page.setViewportSize({ width: 1000, height: 780 });
  await page.goto(`${baseUrl}/?preview=design`);
  await page.locator('[data-testid="home-workspace"]').waitFor();
  await page.screenshot({ path: path.join(outputDirectory, '06-home-todomate-window-1000x780.png') });
  const todoMateWindowMetrics = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    workspace: (() => {
      const rect = document.querySelector('[data-testid="home-workspace"]')?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) } : null;
    })(),
  }));

  await page.setViewportSize({ width: 2000, height: 1564 });
  await page.goto(`${baseUrl}/?preview=design`);
  await page.locator('[data-testid="home-workspace"]').waitFor();
  await page.screenshot({ path: path.join(outputDirectory, '05-home-todomate-size-after.png') });
  const referenceSizeMetrics = await page.evaluate(() => {
    const rect = document.querySelector('[data-testid="home-workspace"]')?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      workspace: rect ? { x: Math.round(rect.x), width: Math.round(rect.width), right: Math.round(rect.right) } : null,
    };
  });

  console.log(JSON.stringify({ homeMetrics, calendarMetrics, todoMateWindowMetrics, referenceSizeMetrics }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
