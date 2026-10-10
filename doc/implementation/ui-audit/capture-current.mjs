import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(directory, 'current-2026-10-06');
const baseUrl = 'http://127.0.0.1:3001';
const viewport = { width: 1000, height: 780 };

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    const browserErrors = [];
    const failedResponses = [];
    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
    });
    await page.clock.install({ time: new Date('2026-10-05T06:48:00.000Z') });
    await page.goto(`${baseUrl}/?preview=design`);
    await page.locator('[data-app-state="design-preview"] [data-testid="home-workspace"]').waitFor();
    await page.getByRole('heading', { name: '임박한 일정' }).waitFor();
    await page.getByRole('gridcell', { name: /10월 12일/ }).click();
    await page.screenshot({ path: path.join(outputDirectory, '05-implementation-home-1000x780.png') });

    const homeMetrics = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        x: Math.round(value.x), y: Math.round(value.y),
        width: Math.round(value.width), height: Math.round(value.height),
        right: Math.round(value.right), bottom: Math.round(value.bottom),
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      now: new Date().toISOString(),
      frame: rect(document.querySelector('[data-app-state="design-preview"]')),
      monthHeader: rect(document.querySelector('[aria-label="월 이동"]')?.parentElement),
      periodBoard: rect(document.querySelector('[aria-label="임박한 일정"]')),
      periodCards: [...document.querySelectorAll('[data-period-phase]')].slice(0, 3).map((card) => ({
        title: card.getAttribute('aria-label'),
        text: card.innerText.replaceAll('\n', ' · '),
        card: rect(card),
        track: rect(card.querySelector('[class*="track"]')),
      })),
      monthGrid: rect(document.querySelector('[aria-label="월간 할 일"]')),
      weekdayRow: rect(document.querySelector('[aria-label="월간 할 일"] [role="row"]')),
      weekdayCells: [...document.querySelectorAll('[aria-label="월간 할 일"] [role="columnheader"]')].map(rect),
      dateRows: [...document.querySelectorAll('[aria-label="월간 할 일"] [role="row"]')].map(rect),
      selectedHeading: document.querySelector('[aria-label="선택한 날짜의 할 일"] h2')?.textContent,
      selectedDateBadge: rect(document.querySelector('[aria-selected="true"] [class*="dateBadge"]')),
      selectedDate: rect(document.querySelector('[aria-selected="true"]')),
      selectedTasks: rect(document.querySelector('[aria-label="선택한 날짜의 할 일"]')),
      selectedTaskRows: [...document.querySelectorAll('[aria-label="선택한 날짜의 할 일"] [data-task-id]')].map(rect),
      undatedTasksLink: rect(document.querySelector('[aria-label="선택한 날짜의 할 일"] a')),
      addButton: rect(document.querySelector('[aria-label="할 일 추가"]')),
      bottomNav: rect(document.querySelector('[aria-label="주요 메뉴"]')),
    };
    });

    const expand = page.getByRole('button', { name: /전체 임박 일정 펼치기/ });
    await expand.click();
    await page.getByTestId('period-overflow-overlay').waitFor({ state: 'visible' });
    await page.waitForTimeout(260);
    await page.screenshot({ path: path.join(outputDirectory, '06-implementation-overlay-1000x780.png') });
    const overlayMetrics = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="period-overflow-overlay"]');
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), zIndex: getComputedStyle(node).zIndex };
    });

    await page.keyboard.press('Escape');
    await page.getByTestId('period-overflow-overlay').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '기간 일정 추가 메뉴' }).click();
    const menu = page.getByRole('menu', { name: '기간 일정 추가' });
    await menu.waitFor();
    await page.waitForTimeout(180);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(outputDirectory, '07-implementation-menu-1000x780.png') });
    const menuMetrics = await menu.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    await page.getByRole('menuitem', { name: /선착순 신청 추가/ }).click();
    const editor = page.getByRole('dialog');
    await editor.waitFor();
    await page.screenshot({ path: path.join(outputDirectory, '08-implementation-period-form-1000x780.png') });
    const editorMetrics = await editor.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    });

    console.log(JSON.stringify({ homeMetrics, overlayMetrics, menuMetrics, editorMetrics, browserErrors, failedResponses }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
