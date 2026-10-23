import { expect, test } from '@playwright/test';

test('starts without a preview query and keeps locally saved tasks after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="home-workspace"]')).toBeVisible();
  await expect(page.locator('[data-app-state="local-only"]')).toBeVisible();

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 할 일', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 할 일' });
  await editor.getByLabel('할 일 이름', { exact: true }).fill('로컬 저장 확인');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('로컬 저장 확인', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('로컬 저장 확인', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(page.locator('[data-view="week"]')).toBeVisible();
  await page.getByRole('link', { name: '설정 · 내 공간' }).click();
  await expect(page.getByRole('dialog', { name: '설정' })).toBeVisible();
  await expect(page.locator('[data-app-state="local-only"]')).toBeVisible();
});

test('home, calendar and settings expose one main landmark each', async ({ page }) => {
  const routes = [
    { href: '/?preview=design', ready: '[data-testid="home-workspace"]' },
    { href: '/calendar/?preview=design', ready: '[data-view="week"]' },
    { href: '/settings/?preview=design', ready: 'h1' },
  ];
  for (const { href, ready } of routes) {
    await page.goto(href);
    await expect(page.locator(ready)).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
  }
});

test('home date and weekly date context stay aligned across navigation', async ({ page }) => {
  await page.goto('/?preview=design&date=2026-10-10');
  await expect(page.getByRole('heading', { name: '10월 10일 토요일', exact: true })).toBeVisible();

  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(page.getByRole('heading', { name: /2026년 10월 5일.*11일/ })).toBeVisible();
  await expect(page).toHaveURL(/date=2026-10-10/);

  await page.getByRole('button', { name: '다음 주' }).click();
  await expect(page.getByRole('heading', { name: /2026년 10월 12일.*18일/ })).toBeVisible();
  await expect(page).toHaveURL(/date=2026-10-17/);

  await page.getByRole('link', { name: '홈' }).click();
  await expect(page.getByRole('heading', { name: '10월 17일 토요일', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/date=2026-10-17/);
});

test('calendar exposes its existing period list without losing the weekly view', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/calendar/?preview=design');
  await page.getByRole('button', { name: '기간 일정 보기' }).click();
  await expect(page.getByRole('region', { name: '기간별 일정' })).toBeVisible();
  await expect(page.getByText('수강신청', { exact: true })).toBeVisible();
  const route = page.locator('[data-route="calendar"]');
  expect(await route.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);

  await page.getByRole('button', { name: '주간 캘린더 보기' }).click();
  await expect(page.getByRole('region', { name: '시간표 스크롤 영역' })).toBeVisible();
  await expect(page).not.toHaveURL(/filter=period/);
});

test('all D-day navigates to Progress while home sorting opens its reorder view', async ({ page }) => {
  await page.goto('/?preview=design');
  await page.getByRole('button', { name: '전체 D-day 보기' }).click();
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '학회 논문 제출', exact: true })).toBeVisible();

  await page.goto('/?preview=design');
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  const sortDialog = page.getByRole('dialog', { name: '디데이 정렬' });
  await expect(sortDialog).toBeVisible();
  await expect(sortDialog.getByText('끌어서 순서를 바꾸세요.')).toBeVisible();
  await expect(sortDialog.getByRole('button', { name: '저장' })).toBeVisible();
});

test('checklist-complete periods appear in the Progress completed filter', async ({ page }) => {
  await page.goto('/?preview=design');
  await page.evaluate(() => {
    const item = {
      id: 'checklist-complete-period',
      kind: 'window',
      title: '완료한 제출 준비',
      timing: { type: 'date', startDate: '2026-10-13', endDate: '2026-10-20', timeZone: 'Asia/Seoul' },
      completion: 'pending',
      checklist: [{ id: 'proof', title: '제출 서류 확인', completed: true }],
      startCountdown: { enabled: true, daysBefore: 1 },
    };
    window.localStorage.setItem('todolist:desktop-preview:v2', JSON.stringify({
      version: 2,
      items: [item],
      taskOrders: {},
      reminderOffsets: {},
      remindersEnabled: false,
    }));
  });
  await page.reload();
  await page.goto('/progress/?preview=design');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  const completedCard = page.locator('article').filter({ has: page.getByRole('button', { name: '완료한 제출 준비', exact: true }) });
  await expect(completedCard).toBeVisible();
  await expect(completedCard.getByRole('button', { name: '완료 취소' })).toHaveAttribute('aria-pressed', 'true');
});

test('settings uses one compact fixed-accent explanation at desktop window sizes', async ({ page }) => {
  for (const viewport of [{ width: 800, height: 600 }, { width: 900, height: 700 }, { width: 1000, height: 780 }, { width: 1100, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/settings/?preview=design');
    await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
    await expect(page.getByText('Apple Blue', { exact: true })).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  }
});
