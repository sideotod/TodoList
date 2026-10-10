import type { Page } from '@playwright/test';

export async function chooseHomeDate(page: Page, date = '2026-10-03'): Promise<void> {
  const [year, month] = date.split('-').map(Number);
  const heading = page.getByRole('heading', { name: /\d{4}년\s*\d{1,2}월/ });
  for (let tries = 0; tries < 120; tries += 1) {
    const match = /(\d{4})년\s*(\d{1,2})월/.exec(await heading.innerText());
    if (!match) throw new Error('월간 달력 제목 형식이 올바르지 않습니다.');
    const delta = (year - Number(match[1])) * 12 + month - Number(match[2]);
    if (delta === 0) {
      await page.locator(`#month-day-${date}`).click();
      return;
    }
    await page.getByRole('button', { name: delta > 0 ? '다음 달' : '이전 달' }).first().click();
  }
  throw new Error('테스트 날짜로 이동하지 못했습니다.');
}
