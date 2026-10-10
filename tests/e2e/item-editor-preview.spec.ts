import { test, expect, type Page } from '@playwright/test';
import type { ProposedCalendarItem } from '../../src/domain/items';
import { chooseHomeDate } from './preview-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-06T03:00:00.000Z'));
  await page.goto('/?preview=design');
});

async function openPeriod(page: Page, kind: 'window' | 'deadline' = 'window') {
  if (kind === 'deadline') {
    await page.goto('/calendar/?filter=period&preview=design');
    await page.getByRole('button', { name: '학회 논문 제출', exact: true }).click();
    await page.getByRole('dialog', { name: '학회 논문 제출' }).getByRole('button', { name: '수정', exact: true }).click();
    return page.getByRole('dialog');
  }
  await page.getByRole('button', { name: kind === 'window' ? '수강신청' : '학회 논문 제출', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '수정', exact: true }).click();
  return page.getByRole('dialog');
}

async function storedItem(page: Page, title: string) {
  return page.evaluate((name) => {
    const record = JSON.parse(localStorage.getItem('todolist:desktop-preview:v2') ?? '{}') as {
      items?: ProposedCalendarItem[];
      reminderOffsets?: Record<string, number>;
    };
    const item = record.items?.find((entry) => entry.title === name);
    return { item, reminder: item ? record.reminderOffsets?.[item.id] : undefined };
  }, title);
}

test('compact period keeps the selected kind, visible footer and keyboard focus', async ({ page }) => {
  const editor = await openPeriod(page);
  const title = editor.getByRole('textbox', { name: /^제목/ });
  await expect(title).toBeFocused();
  await expect(editor.getByLabel('유형')).toHaveCount(0);
  await expect(editor.getByLabel('시간대')).toBeHidden();
  await expect(editor.getByLabel('하위 할 일 추가')).toBeHidden();
  const bounds = await editor.boundingBox();
  expect(bounds?.width).toBe(440);
  expect(bounds?.height).toBeLessThan(570);
  expect((await title.boundingBox())?.width).toBe((bounds?.width ?? 0) - 48);
  expect(await editor.evaluate((element) => {
    const body = element.querySelector('form > div')!;
    return body.scrollHeight === body.clientHeight;
  })).toBe(true);
  const save = editor.getByRole('button', { name: '저장', exact: true });
  const cancel = editor.getByRole('button', { name: '취소', exact: true });
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  expect((await save.boundingBox())?.x).toBeLessThan((await cancel.boundingBox())?.x ?? 0);
  await save.focus();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(page.getByRole('button', { name: '수강신청', exact: true })).toBeFocused();

  await openPeriod(page, 'deadline');
  await expect(page.getByRole('heading', { name: '일정 수정', exact: true })).toBeVisible();
  await expect(editor.getByLabel('유형')).toHaveCount(0);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: /^학회 논문 제출/ })).toBeFocused();
});

test('expanded fields save, survive collapsing, and remain intact when editing a title', async ({ page }) => {
  const editor = await openPeriod(page);
  await editor.getByRole('textbox', { name: /^제목/ }).fill('기간 기능 보존');
  await editor.getByRole('button', { name: '변경', exact: true }).click();
  const timeSettings = page.getByRole('dialog', { name: '시간 설정' });
  await timeSettings.getByLabel('정확한 시각', { exact: true }).check();
  await timeSettings.getByLabel('종료 시각도 기록').check();
  await timeSettings.getByLabel('시작 날짜', { exact: true }).fill('2026-10-07');
  await timeSettings.getByLabel('시작 시각', { exact: true }).fill('09:15');
  await timeSettings.getByLabel('종료 날짜', { exact: true }).fill('2026-10-09');
  await timeSettings.getByLabel('종료 시각', { exact: true }).fill('17:30');
  await timeSettings.getByText('기기 알림', { exact: true }).click();
  await timeSettings.getByRole('button', { name: '1시간 전' }).click();
  await timeSettings.getByRole('button', { name: '적용', exact: true }).click();
  await editor.getByRole('spinbutton').fill('3');
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  for (let i = 1; i <= 4; i += 1) {
    await editor.getByLabel('하위 할 일 추가', { exact: true }).fill(`준비 ${i}`);
    await editor.getByLabel('하위 할 일 추가', { exact: true }).press('Enter');
  }
  await editor.getByLabel('준비 1 완료', { exact: true }).check();
  await editor.getByLabel('하위 할 일 추가', { exact: true }).fill('다섯 번째');
  await editor.getByLabel('하위 할 일 추가', { exact: true }).press('Enter');
  await expect(editor.getByRole('alert')).toContainText('최대 4개');
  await editor.getByLabel('하위 할 일 추가', { exact: true }).fill('');
  await editor.getByLabel('신청 완료', { exact: true }).check();
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByRole('button', { name: /^추가 설정/ }).click();
  await editor.getByLabel('시간대', { exact: true }).fill('Asia/Seoul');
  await editor.getByLabel(/^메모/).fill('메모와 링크를 접어도 저장');
  await editor.getByLabel(/^관련 링크/).fill('https://example.com/application');
  await expect(editor.getByLabel(/^분류/)).toHaveCount(0);
  await expect(editor.getByLabel('완료', { exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: /^추가 설정/ }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  const first = await storedItem(page, '기간 기능 보존');
  expect(first.item).toMatchObject({ kind: 'window', completion: 'completed', startCountdown: { enabled: true, daysBefore: 3 }, notes: '메모와 링크를 접어도 저장', sourceUrl: 'https://example.com/application', timing: { type: 'time', startAt: '2026-10-07T00:15:00.000Z', endAt: '2026-10-09T08:30:00.000Z', timeZone: 'Asia/Seoul' } });
  expect(first.item).not.toHaveProperty('category');
  expect(first.item?.kind === 'window' && first.item.checklist.length).toBe(4);
  expect(first.reminder).toBe(60);
  await page.goto('/calendar/?filter=period&preview=design');
  await page.getByRole('button', { name: '기간 기능 보존', exact: true }).click();
  const details = page.getByRole('dialog', { name: '기간 기능 보존' });
  await details.getByRole('button', { name: '수정', exact: true }).click();
  await expect(editor.getByLabel(/^메모/)).toBeVisible();
  await editor.getByRole('textbox', { name: /^제목/ }).fill('기간 기능 수정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  const second = await storedItem(page, '기간 기능 수정');
  expect(second).toEqual({ ...first, item: { ...first.item, title: '기간 기능 수정' } });
  await page.reload();
  expect(await storedItem(page, '기간 기능 수정')).toEqual(second);
});

test('dirty Escape and checklist deletion ask before discarding and cancel preserves data', async ({ page }) => {
  const editor = await openPeriod(page);
  await editor.getByRole('textbox', { name: /^제목/ }).fill('폐기 확인');
  await page.keyboard.press('Escape');
  await expect(editor.getByRole('textbox', { name: /^제목/ })).toHaveValue('폐기 확인');
  await expect(page.getByRole('alertdialog')).toContainText('저장하지 않고 닫을까요?');
  await page.getByRole('button', { name: '계속 편집' }).click();
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기' }).click();
  await expect(editor).toBeHidden();
  expect((await storedItem(page, '폐기 확인')).item).toBeUndefined();

  await openPeriod(page, 'deadline');
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByRole('button', { name: /삭제$/ }).first().click();
  await expect(editor).toHaveAttribute('data-dirty', 'true');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '계속 편집' }).click();
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기' }).click();
  await openPeriod(page, 'deadline');
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await expect(editor.getByLabel('하위 할 일 이름', { exact: true })).toHaveCount(3);
});

test('timezone errors reveal settings and DST gaps/folds stay resolvable', async ({ page }) => {
  const editor = await openPeriod(page);
  await editor.getByRole('textbox', { name: /^제목/ }).fill('DST 신청');
  await editor.getByRole('button', { name: '변경', exact: true }).click();
  const timeSettings = page.getByRole('dialog', { name: '시간 설정' });
  await timeSettings.getByLabel('정확한 시각', { exact: true }).check();
  await timeSettings.getByLabel('종료 시각도 기록').uncheck();
  await timeSettings.getByRole('button', { name: '적용', exact: true }).click();
  await editor.getByRole('button', { name: /^추가 설정/ }).click();
  await editor.getByLabel('시간대', { exact: true }).fill('Invalid/Zone');
  await editor.getByRole('button', { name: /^추가 설정/ }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor.getByLabel('시간대', { exact: true })).toBeVisible();
  await expect(editor.getByText('유효한 IANA 시간대를 입력해 주세요.', { exact: true })).toBeVisible();
  await editor.getByLabel('시간대', { exact: true }).fill('America/New_York');
  await editor.getByRole('button', { name: '변경', exact: true }).click();
  const resolvedTimeSettings = page.getByRole('dialog', { name: '시간 설정' });
  const dateTrigger = resolvedTimeSettings.getByRole('button', { name: '시작 날짜 달력 선택 열기' });
  await dateTrigger.click();
  const datePicker = page.getByRole('group', { name: '시작 날짜 달력' });
  const datePickerBox = await datePicker.boundingBox();
  const dateTriggerBox = await dateTrigger.boundingBox();
  expect(datePickerBox?.y).toBeGreaterThanOrEqual((dateTriggerBox?.y ?? 0) + (dateTriggerBox?.height ?? 0));
  expect((datePickerBox?.y ?? 0) + (datePickerBox?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 780);
  await datePicker.getByRole('button', { name: '2026-10-06 선택' }).click();
  const timeTrigger = resolvedTimeSettings.getByRole('button', { name: '시작 시각 시각 선택 열기' });
  await timeTrigger.click();
  const timePicker = page.getByRole('group', { name: '시작 시각 시각 선택' });
  const timePickerBox = await timePicker.boundingBox();
  const timeTriggerBox = await timeTrigger.boundingBox();
  expect(timePickerBox?.y).toBeGreaterThanOrEqual((timeTriggerBox?.y ?? 0) + (timeTriggerBox?.height ?? 0));
  expect((timePickerBox?.y ?? 0) + (timePickerBox?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 780);
  await timePicker.getByRole('button', { name: '완료', exact: true }).click();
  await resolvedTimeSettings.getByLabel('시작 날짜', { exact: true }).fill('2026-03-08');
  await resolvedTimeSettings.getByLabel('시작 시각', { exact: true }).fill('02:30');
  await expect(resolvedTimeSettings.getByText('이 날짜에는 입력한 시각이 없습니다. 다른 시각을 선택해 주세요.')).toBeVisible();
  await resolvedTimeSettings.getByRole('button', { name: '적용', exact: true }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: '변경', exact: true }).click();
  const foldSettings = page.getByRole('dialog', { name: '시간 설정' });
  await foldSettings.getByLabel('시작 날짜', { exact: true }).fill('2026-11-01');
  await foldSettings.getByLabel('시작 시각', { exact: true }).fill('01:30');
  await expect(foldSettings.getByLabel('첫 번째 시각 (-04:00)')).toBeVisible();
  await expect(foldSettings.getByLabel('두 번째 시각 (-05:00)')).toBeVisible();
  await foldSettings.getByLabel('두 번째 시각 (-05:00)').check();
  await foldSettings.getByRole('button', { name: '적용', exact: true }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  expect((await storedItem(page, 'DST 신청')).item).toMatchObject({ timing: { type: 'time', startAt: '2026-11-01T06:30:00.000Z', endAt: null, timeZone: 'America/New_York' } });
});

test('deadline retains optional start, countdown and completion', async ({ page }) => {
  const editor = await openPeriod(page, 'deadline');
  await editor.getByRole('textbox', { name: /^제목/ }).fill('기간 내 마감');
  await editor.getByRole('button', { name: '변경', exact: true }).click();
  const timeSettings = page.getByRole('dialog', { name: '시간 설정' });
  await timeSettings.getByLabel('날짜', { exact: true }).check();
  await timeSettings.getByLabel('기간 시작일도 기록').uncheck();
  await timeSettings.getByLabel('기간 시작일도 기록').check();
  await timeSettings.getByLabel('시작일', { exact: true }).fill('2026-10-06');
  await timeSettings.getByLabel('종료일', { exact: true }).fill('2026-10-12');
  await timeSettings.getByRole('button', { name: '적용', exact: true }).click();
  await editor.getByLabel('시작 카운트다운 표시', { exact: true }).check();
  await editor.getByRole('spinbutton').fill('2');
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByLabel('제출 완료', { exact: true }).check();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  expect((await storedItem(page, '기간 내 마감')).item).toMatchObject({ kind: 'deadline', timing: { type: 'date', startDate: '2026-10-06', endDate: '2026-10-12' }, startCountdown: { enabled: true, daysBefore: 2 }, completion: 'completed' });
});

test('long form has one body scroller and a reachable footer on desktop and mobile', async ({ page }) => {
  const editor = await openPeriod(page);
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByRole('button', { name: /^추가 설정/ }).click();
  await editor.getByLabel(/^메모/).fill('긴 메모\n'.repeat(100));
  for (const viewport of [{ width: 1000, height: 780 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const geometry = await editor.evaluate((element) => {
      const body = element.querySelector('form > div')!;
      const footer = element.querySelector('footer')!;
      return { dialogScroll: element.scrollHeight - element.clientHeight, bodyScroll: body.scrollHeight - body.clientHeight, footer: footer.getBoundingClientRect().bottom, documentWidth: document.documentElement.scrollWidth, bodyBottom: body.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top };
    });
    expect(geometry.dialogScroll).toBe(0);
    expect(geometry.bodyScroll).toBeGreaterThan(0);
    expect(geometry.footer).toBeLessThanOrEqual(viewport.height);
    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(geometry.bodyBottom).toBeLessThanOrEqual(geometry.footerTop);
    await editor.getByLabel(/^관련 링크/).fill('https://example.com/long-form');
    await expect(editor.getByRole('button', { name: '취소', exact: true })).toBeVisible();
    await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeVisible();
  }
});

test('weekly calendar keeps navigation, late hours and empty slot prefill', async ({ page }) => {
  await page.goto('/calendar/?preview=design');
  await page.setViewportSize({ width: 1000, height: 600 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 10월 4일 – 10일');
  await expect(page.getByRole('button', { name: '오늘', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Todo 홈' })).toHaveCount(0);
  await page.getByRole('button', { name: '이전 주' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2026년 9월 27일 – 10월 3일');
  await page.getByRole('button', { name: '다음 주' }).click();
  const scroller = page.getByRole('region', { name: '시간표 스크롤 영역' });
  const scrollerBounds = await scroller.boundingBox();
  const firstTimeLabel = page.getByText('08:00', { exact: true });
  const firstTimeLabelBounds = await firstTimeLabel.boundingBox();
  expect(scrollerBounds).not.toBeNull();
  expect(firstTimeLabelBounds).not.toBeNull();
  expect(firstTimeLabelBounds!.y).toBeGreaterThanOrEqual(scrollerBounds!.y);
  const firstColumn = page.locator('section[aria-label="시간 일정"] > div:nth-of-type(2) > div').first();
  const firstHourLine = page.locator('section[aria-label="시간 일정"] [class*="hourLine"][data-major="true"]').first();
  const secondHourLine = page.locator('section[aria-label="시간 일정"] [class*="hourLine"][data-major="false"]').first();
  const alpha = (color: string) => Number(color.match(/\/\s*([\d.]+)%?\)$/)?.[1] ?? color.match(/,\s*([\d.]+)\)$/)?.[1] ?? 1);
  expect(alpha(await firstColumn.evaluate((element) => getComputedStyle(element).borderLeftColor))).toBeLessThan(0.13);
  const majorLineAlpha = alpha(await firstHourLine.evaluate((element) => getComputedStyle(element).backgroundColor));
  const minorLineAlpha = alpha(await secondHourLine.evaluate((element) => getComputedStyle(element).backgroundColor));
  expect(majorLineAlpha).toBeLessThan(0.13);
  expect(minorLineAlpha).toBeLessThan(majorLineAlpha);
  await scroller.focus();
  await page.keyboard.press('End');
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Home');
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);
  const emptySlot = page.getByLabel('2026-10-09 일정 추가', { exact: true });
  const emptySlotBounds = await emptySlot.boundingBox();
  expect(emptySlotBounds).not.toBeNull();
  await emptySlot.click({ position: { x: 50, y: emptySlotBounds!.height * (4.5 / 14) } });
  const editor = page.getByRole('dialog');
  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const revealButton = timeSettings.getByRole('button', { name: /시간 설정/ });
  const timePanel = editor.getByRole('region', { name: '일정 시간 상세' });
  await revealButton.click();
  await expect(revealButton).toHaveAttribute('aria-expanded', 'true');
  await expect(timePanel.getByLabel('시작 날짜', { exact: true })).toHaveValue('2026. 10. 09.');
  await expect(timePanel.getByLabel('시작 시각', { exact: true })).toHaveValue('12:30');
  await expect(timePanel.getByLabel('종료 시각', { exact: true })).toHaveValue('13:00');
  await expect(timePanel).toBeVisible();
  await expect(page.getByRole('dialog', { name: '시간 설정' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await page.goto('/calendar/?filter=period&preview=design');
  await expect(page.getByRole('region', { name: '기간별 일정' })).toBeVisible();
  await expect(page).toHaveURL(/filter=period/);
  await page.goto('/calendar/?preview=design');
  expect(new URL(page.url()).searchParams.get('preview')).toBe('design');
  await expect(scroller).toBeVisible();
});

test('weekly calendar keeps the home content width on desktop and mobile', async ({ page }) => {
  const homePage = page.locator('div[class*="HomeExperience_page"]');
  await expect(homePage).toBeVisible();
  const homeWidth = (await homePage.boundingBox())?.width;
  const homePadding = await homePage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  });
  await page.goto('/calendar/?preview=design');
  const weekPage = page.locator('main[data-view="week"]');
  await expect(weekPage).toBeVisible();
  expect((await weekPage.boundingBox())?.width).toBe(homeWidth);
  const weekPadding = await weekPage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  });
  expect(weekPadding).toEqual(homePadding);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?preview=design');
  const mobileHomePage = page.locator('div[class*="HomeExperience_page"]');
  const mobileHomeWidth = (await mobileHomePage.boundingBox())?.width;
  const mobileHomePadding = await mobileHomePage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  });
  await page.goto('/calendar/?preview=design');
  const mobileWeekPage = page.locator('main[data-view="week"]');
  expect((await mobileWeekPage.boundingBox())?.width).toBe(mobileHomeWidth);
  expect(await mobileWeekPage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  })).toEqual(mobileHomePadding);
});

test('calendar event edits preserve existing local reminder and dates with settings folded', async ({ page }) => {
  await page.goto('/calendar/?preview=design');
  await page.getByRole('button', { name: /^연구실 세미나 / }).click();
  const details = page.getByRole('dialog', { name: '연구실 세미나' });
  await expect(details.getByRole('heading', { name: '연구실 세미나', exact: true })).toBeVisible();
  await expect(details.getByRole('img', { name: '시작 예정' })).toBeVisible();
  await expect(details.getByRole('button', { name: '상세 닫기' })).toHaveCount(0);
  await expect(details).toContainText('10.06 13:00');
  await details.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const revealButton = timeSettings.getByRole('button', { name: /시간 설정/ });
  const timePanel = editor.locator('#event-time-reveal');
  await revealButton.click();
  await expect(revealButton).toHaveAttribute('aria-expanded', 'true');
  await expect(timePanel.getByLabel('알림')).toHaveCount(0);
  await expect(timePanel.getByLabel('기준 시각')).toHaveCount(0);
  await expect(timePanel.getByLabel('카운트다운 일수')).toHaveCount(0);
  await expect(timePanel.getByLabel('시작 카운트다운')).not.toBeChecked();
  await timePanel.getByText('시작 카운트다운', { exact: true }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  const first = await storedItem(page, '연구실 세미나');
  expect(first.reminder).toBeUndefined();
  expect(first.item).toMatchObject({ countdown: { enabled: true, daysBefore: 1, reference: 'start' } });
  await page.getByRole('button', { name: /^연구실 세미나 / }).click();
  await page.getByRole('dialog', { name: '연구실 세미나' }).getByRole('button', { name: '수정', exact: true }).click();
  const editedTimeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const editedTimePanel = editor.locator('#event-time-reveal');
  const editedRevealButton = editedTimeSettings.getByRole('button', { name: /시간 설정/ });
  await editedRevealButton.click();
  await expect(editedRevealButton).toHaveAttribute('aria-expanded', 'true');
  await expect(editedTimePanel.getByLabel('카운트다운 기준 시각')).toHaveValue('start');
  await editedRevealButton.click();
  await editor.getByRole('textbox', { name: '일정 이름' }).fill('알림 유지 세미나');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect(await storedItem(page, '알림 유지 세미나')).toEqual({ ...first, item: { ...first.item, title: '알림 유지 세미나' } });
  await expect(page.getByRole('button', { name: /^알림 유지 세미나 / })).toBeFocused();
});

test('task time and reminder expand inline without a popup or task completion controls', async ({ page }) => {
  await page.getByRole('button', { name: '할 일 추가', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 할 일' });
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  await editor.getByRole('textbox', { name: '할 일 이름' }).fill('시각과 알림 설정');
  await editor.getByLabel('날짜', { exact: true }).fill('2026-10-06');
  await expect(editor.getByLabel('완료', { exact: true })).toHaveCount(0);
  await expect(editor.getByRole('combobox', { name: '분류' })).toBeVisible();
  await expect(editor.getByText('추가 설정', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('시간대', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel(/^관련 링크/)).toBeVisible();
  await expect(editor.getByText('메모 선택')).toHaveCount(0);
  const timeToggle = editor.getByRole('checkbox', { name: '시간 설정' });
  await expect(timeToggle).not.toBeChecked();
  const timeReveal = editor.getByRole('region', { name: '시간 설정' }).locator('[data-open]');
  await expect(timeReveal).toHaveAttribute('aria-hidden', 'true');
  await expect(timeReveal).toHaveAttribute('data-open', 'false');
  await timeToggle.check();
  await expect(editor.getByRole('dialog', { name: '시간 설정' })).toHaveCount(0);
  await editor.getByLabel('마감 시각', { exact: true }).fill('09:00');
  await editor.getByText('기기 알림', { exact: true }).click();
  await editor.getByRole('button', { name: '30분 전' }).click();
  const saveButton = editor.getByRole('button', { name: '저장', exact: true });
  const cancelButton = editor.getByRole('button', { name: '취소', exact: true });
  expect((await saveButton.boundingBox())?.x).toBeLessThan((await cancelButton.boundingBox())?.x ?? 0);
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect(await storedItem(page, '시각과 알림 설정')).toMatchObject({
    item: { kind: 'task', timing: { type: 'time', endAt: '2026-10-06T00:00:00.000Z' } },
    reminder: 30,
  });
});

test('header titles edit in place and event time options open a side panel', async ({ page }) => {
  const logo = page.getByRole('link', { name: 'Todo 홈' });
  const menu = page.getByRole('button', { name: '메뉴' });
  const logoBox = await logo.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(Math.abs((logoBox?.y ?? 0) + (logoBox?.height ?? 0) / 2 - ((menuBox?.y ?? 0) + (menuBox?.height ?? 0) / 2))).toBeLessThanOrEqual(5);

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await expect(editor.getByRole('heading', { name: '새 일정' })).toBeVisible();
  const eventTitle = editor.getByRole('textbox', { name: '일정 이름' });
  await expect(eventTitle).toHaveValue('새 일정');
  await eventTitle.hover();
  expect(await eventTitle.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await eventTitle.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe('1px');
  expect(await eventTitle.evaluate((element) => getComputedStyle(element).borderRadius)).toBe('0px');
  await expect(editor.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  await expect(editor.getByText('추가 설정', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('시간대', { exact: true })).toHaveCount(0);
  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const timePanel = editor.locator('#event-time-reveal');
  const repeatSwitch = editor.getByRole('radiogroup', { name: '반복' }).getByRole('radio', { name: '매주 반복' });
  await timeSettings.getByRole('button', { name: /시간 설정/ }).click();
  await timePanel.getByLabel('상단 진행 카드 표시').check();
  const allDaySwitch = timePanel.getByRole('radiogroup', { name: '시간 방식' }).getByRole('radio', { name: '종일' });
  await expect(repeatSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(allDaySwitch).toHaveAttribute('aria-checked', 'false');
  await repeatSwitch.click();
  await expect(repeatSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(editor.getByRole('group', { name: '반복 요일' })).toBeVisible();
  await repeatSwitch.click();
  await allDaySwitch.click();
  await expect(allDaySwitch).toHaveAttribute('aria-checked', 'true');
  await timePanel.getByRole('radiogroup', { name: '시간 방식' }).getByRole('radio', { name: '정확한 시각' }).click();
  await expect(allDaySwitch).toHaveAttribute('aria-checked', 'false');
  await expect(timeSettings.getByRole('button', { name: /시간 설정/ })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => editor.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(600);
  await expect(page.getByRole('dialog', { name: '시간 설정' })).toHaveCount(0);
  await expect(timePanel.getByLabel('정확한 시각', { exact: true })).toHaveCount(0);
  await expect(timePanel.getByLabel('기준 시각')).toHaveCount(0);
  await expect(timePanel.getByLabel('카운트다운 일수')).toHaveCount(0);
  await timePanel.getByText('시작 카운트다운', { exact: true }).click();
  await timePanel.getByLabel('시작 날짜', { exact: true }).fill('2026-10-07');
  await timePanel.getByLabel('시작 시각', { exact: true }).fill('09:00');
  await timePanel.getByLabel('종료 날짜', { exact: true }).fill('2026-10-07');
  await timePanel.getByLabel('종료 시각', { exact: true }).fill('09:30');
  await editor.getByRole('textbox', { name: '일정 이름' }).fill('기준 시각이 있는 일정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect((await storedItem(page, '기준 시각이 있는 일정')).item).toMatchObject({
    kind: 'event',
    timing: { type: 'time', startAt: '2026-10-07T00:00:00.000Z', endAt: '2026-10-07T00:30:00.000Z' },
    countdown: { enabled: true, daysBefore: 1, reference: 'start' },
  });
  await expect(page.getByRole('region', { name: '선택한 날짜의 할 일' }).getByText('기준 시각이 있는 일정', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '임박한 일정' }).getByRole('article', { name: '기준 시각이 있는 일정' })).toBeVisible();

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  const sortDialog = page.getByRole('dialog', { name: '디데이 정렬' });
  await expect(sortDialog.getByRole('listitem', { name: /기준 시각이 있는 일정/ })).toBeVisible();
});

test('event editor aligns color and repeat controls with compact, ordered time fields', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  const palette = editor.getByRole('group', { name: '일정 색상' });
  const paletteLabel = palette.getByText('일정 색상', { exact: true }).last();
  const firstColor = palette.getByRole('button', { name: '일정 색상 1' });
  const paletteLabelBox = await paletteLabel.boundingBox();
  const firstColorBox = await firstColor.boundingBox();
  expect(paletteLabelBox).not.toBeNull();
  expect(firstColorBox).not.toBeNull();
  expect(Math.abs((paletteLabelBox!.y + paletteLabelBox!.height / 2) - (firstColorBox!.y + firstColorBox!.height / 2))).toBeLessThan(8);

  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  await timeSettings.getByRole('button', { name: /시간 설정/ }).click();
  const timePanel = editor.getByRole('region', { name: '일정 시간 상세' });
  const repeatControl = timePanel.getByRole('radiogroup', { name: '반복' });
  await expect(repeatControl).toBeVisible();
  await repeatControl.getByRole('radio', { name: '매주 반복' }).click();
  const weekdayButtons = timePanel.getByRole('group', { name: '반복 요일' }).getByRole('button');
  const weekdayTops = await weekdayButtons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(Math.max(...weekdayTops) - Math.min(...weekdayTops)).toBeLessThan(2);

  await expect(timePanel).toHaveCSS('border-left-style', 'solid');
  await expect(timePanel).toHaveCSS('border-left-width', '1px');
  const panelMotion = await timePanel.evaluate((element) => {
    const style = getComputedStyle(element);
    const durations = style.transitionDuration.split(',').map((duration) => {
      const value = Number.parseFloat(duration);
      return duration.includes('ms') ? value : value * 1000;
    });
    return { properties: style.transitionProperty.split(',').map((property) => property.trim()), longestDuration: Math.max(...durations) };
  });
  expect(panelMotion.properties).toEqual(['opacity', 'transform']);
  expect(panelMotion.longestDuration).toBeLessThanOrEqual(200);
  const startDate = await timePanel.getByLabel('시작 날짜', { exact: true }).boundingBox();
  const startTime = await timePanel.getByLabel('시작 시각', { exact: true }).boundingBox();
  const endDate = await timePanel.getByLabel('종료 날짜', { exact: true }).boundingBox();
  const endTime = await timePanel.getByLabel('종료 시각', { exact: true }).boundingBox();
  expect(startDate).not.toBeNull();
  expect(startTime).not.toBeNull();
  expect(endDate).not.toBeNull();
  expect(endTime).not.toBeNull();
  expect(Math.abs(startDate!.y - startTime!.y)).toBeLessThan(2);
  expect(startDate!.x).toBeLessThan(startTime!.x);
  expect(startTime!.y).toBeLessThan(endDate!.y);
  expect(Math.abs(endDate!.y - endTime!.y)).toBeLessThan(2);
  await expect(timePanel.getByRole('group', { name: '시작' })).toHaveCSS('border-style', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(timePanel).toHaveCSS('transition-property', 'none');
});

test('calendar event details, category settings and D-day sort use the same compact width', async ({ page }) => {
  await page.goto('/calendar/?preview=design');
  await page.getByRole('button', { name: /^연구실 세미나 / }).click();
  const details = page.getByRole('dialog', { name: '연구실 세미나' });
  const detailsWidth = (await details.boundingBox())?.width;
  await page.keyboard.press('Escape');

  await page.goto('/?preview=design');
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  const sortDialog = page.getByRole('dialog', { name: '디데이 정렬' });
  const sortWidth = (await sortDialog.boundingBox())?.width;
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '카테고리 설정' }).click();
  const categoryDialog = page.getByRole('dialog', { name: '카테고리 설정' });
  expect(detailsWidth).toBe(sortWidth);
  expect((await categoryDialog.boundingBox())?.width).toBe(sortWidth);
});

test('new schedule is a progress card and sortable item, never a daily task', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveText(['새 할 일', '새 일정', '디데이 정렬', '카테고리 설정']);
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();

  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByRole('textbox', { name: '일정 이름' }).fill('오늘의 새 일정');
  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const revealToggle = timeSettings.getByRole('button', { name: /시간 설정/ });
  const timePanel = editor.locator('#event-time-reveal');
  await expect(revealToggle).toHaveAttribute('aria-expanded', 'false');
  await revealToggle.click();
  await expect(revealToggle).toHaveAttribute('aria-expanded', 'true');
  const progressCardSwitch = timePanel.getByLabel('상단 진행 카드 표시');
  await expect(progressCardSwitch).not.toBeChecked();
  await progressCardSwitch.check();
  await expect(page.getByRole('dialog', { name: '시간 설정' })).toHaveCount(0);
  await expect(timePanel.getByLabel('시작 날짜 달력 선택 열기')).toBeVisible();
  await expect(timePanel.getByLabel('시작 시각 시각 선택 열기')).toBeVisible();
  await expect(timePanel.getByLabel('시작 시각', { exact: true })).toHaveValue('12:30');
  await revealToggle.click();
  await expect(revealToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(timePanel).toHaveAttribute('aria-hidden', 'true');
  await expect(timePanel).toBeHidden();
  await editor.getByRole('button', { name: '저장', exact: true }).click();

  expect((await storedItem(page, '오늘의 새 일정')).item).toMatchObject({ kind: 'event', title: '오늘의 새 일정', showInProgressSummary: true });
  await expect(page.getByRole('region', { name: '임박한 일정' }).getByRole('article', { name: '오늘의 새 일정' })).toBeVisible();
  await expect(page.getByRole('region', { name: '선택한 날짜의 할 일' }).getByText('오늘의 새 일정', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '디데이 정렬', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '디데이 정렬' }).getByRole('listitem', { name: /오늘의 새 일정/ })).toBeVisible();
});

test('schedule options align repeat controls and time settings open beside the editor', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  const initialWidth = (await editor.boundingBox())?.width ?? 0;

  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const timeSettingsButton = timeSettings.getByRole('button', { name: /시간 설정/ });
  const timePanel = editor.locator('#event-time-reveal');
  await expect(timePanel).toHaveAttribute('aria-hidden', 'true');
  await timeSettingsButton.click();
  await expect(timePanel).toBeVisible();

  const repeatOptions = timePanel.getByRole('radiogroup', { name: '반복' });
  const once = repeatOptions.getByRole('radio', { name: '한 번' });
  const weekly = repeatOptions.getByRole('radio', { name: '매주 반복' });
  await expect(once).toHaveAttribute('aria-checked', 'true');
  await weekly.click();
  await expect(weekly).toHaveAttribute('aria-checked', 'true');
  await expect(once).toHaveAttribute('aria-checked', 'false');
  const repeatLabel = timePanel.getByText('반복', { exact: true });
  const repeatLabelBox = await repeatLabel.boundingBox();
  const repeatControlsBox = await repeatOptions.boundingBox();
  const weekdayGroup = timePanel.getByRole('group', { name: '반복 요일' });
  await expect(weekdayGroup).toBeVisible();
  await expect(weekdayGroup.getByRole('button')).toHaveText(['월', '화', '수', '목', '금', '토', '일']);
  const weekdayBox = await weekdayGroup.boundingBox();
  expect(Math.abs((repeatLabelBox?.y ?? 0) + (repeatLabelBox?.height ?? 0) / 2 - ((repeatControlsBox?.y ?? 0) + (repeatControlsBox?.height ?? 0) / 2))).toBeLessThanOrEqual(4);
  expect(weekdayBox?.y ?? 0).toBeGreaterThan(repeatControlsBox?.y ?? 0);

  const eventTitle = editor.getByRole('textbox', { name: '일정 이름' });
  const titleBoxBefore = await eventTitle.boundingBox();
  const timingOptions = timePanel.getByRole('radiogroup', { name: '시간 방식' });
  const allDay = timingOptions.getByRole('radio', { name: '종일' });
  await allDay.click();
  await expect(allDay).toHaveAttribute('aria-checked', 'true');

  await expect(editor).toHaveAttribute('data-expanded', 'true');
  expect((await editor.boundingBox())?.width).toBeGreaterThan(initialWidth);
  const titleBoxAfter = await eventTitle.boundingBox();
  const timePanelBox = await timePanel.boundingBox();
  expect(Math.abs((titleBoxAfter?.width ?? 0) - (titleBoxBefore?.width ?? 0))).toBeLessThanOrEqual(4);
  expect(timePanelBox?.x ?? 0).toBeGreaterThan((titleBoxAfter?.x ?? 0) + (titleBoxAfter?.width ?? 0));
  await expect(timePanel.getByLabel('시작일 달력 선택 열기')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '시간 설정' })).toHaveCount(0);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기' }).click();
});

test('event countdown options can be edited from the schedule editor', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByLabel('일정 이름').fill('카운트다운 편집');
  await editor.getByRole('button', { name: '일정 색상 4' }).click();
  await editor.getByRole('region', { name: '일정 시간 설정' }).getByRole('button', { name: /시간 설정/ }).click();
  await editor.getByLabel('시작 카운트다운', { exact: true }).check();
  await editor.getByLabel('카운트다운 기준 시각', { exact: true }).selectOption('end');
  await editor.getByLabel('종료 며칠 전', { exact: true }).fill('3');
  await editor.getByRole('button', { name: '저장', exact: true }).click();

  expect((await storedItem(page, '카운트다운 편집')).item).toMatchObject({
    kind: 'event',
    categoryColor: '#272643',
    countdown: { enabled: true, daysBefore: 3, reference: 'end' },
  });
});

test('opening a progress card shows information, a quick countdown toggle and an edit path', async ({ page }) => {
  await page.getByRole('region', { name: '임박한 일정' }).getByRole('button', { name: '수강신청', exact: true }).click();
  const details = page.getByRole('dialog', { name: '수강신청' });
  expect((await details.boundingBox())?.width).toBeLessThanOrEqual(522);
  const card = details.getByRole('article', { name: '수강신청' });
  await expect(card).toHaveAttribute('data-expanded', 'true');
  await expect(card.getByRole('progressbar')).toBeVisible();
  expect((await card.boundingBox())?.height).toBeGreaterThan(100);
  const countdown = details.getByRole('switch', { name: '카운트다운' });
  await expect(countdown).toBeChecked();
  await countdown.click();
  await expect(countdown).not.toBeChecked();

  await details.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await expect(editor.getByRole('textbox', { name: /^제목/ })).toHaveValue('수강신청');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeVisible();
});

test('category settings use a compact dialog and readable category dots', async ({ page }) => {
  await chooseHomeDate(page, '2026-10-10');
  const selectedTasks = page.getByRole('region', { name: '선택한 날짜의 할 일' });
  const categoryHeading = selectedTasks.locator('[data-task-category="기본"] h3');
  await expect(categoryHeading).toBeVisible();
  const selectedTasksBounds = await selectedTasks.boundingBox();
  const categoryHeadingBounds = await categoryHeading.boundingBox();
  expect(selectedTasksBounds).not.toBeNull();
  expect(categoryHeadingBounds).not.toBeNull();
  expect(categoryHeadingBounds!.x).toBeGreaterThan(selectedTasksBounds!.x + 6);
  const categoryDot = categoryHeading.locator('span').first();
  await expect(categoryDot).toHaveCSS('width', '12px');
  await expect(categoryDot).toHaveCSS('height', '12px');

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '카테고리 설정' }).click();
  const manager = page.getByRole('dialog', { name: '카테고리 설정' });
  await expect(manager).toBeVisible();
  expect((await manager.boundingBox())?.width).toBeLessThanOrEqual(362);
});

test('new creation menu uses one event flow and preserves existing period cards', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveText(['새 할 일', '새 일정', '디데이 정렬', '카테고리 설정']);
  await expect(menuItems.getByText('선착순 신청', { exact: true })).toHaveCount(0);
  await expect(menuItems.getByText('기간 내 할 일', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const progressCards = page.getByRole('region', { name: '임박한 일정' });
  await expect(progressCards.getByRole('article', { name: '수강신청' })).toBeVisible();
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  const sortDialog = page.getByRole('dialog', { name: '디데이 정렬' });
  await expect(sortDialog).toHaveCSS('max-height', '410px');
  await expect(sortDialog.locator('[data-period-id="design-window-enrollment"]')).toBeVisible();
  await sortDialog.getByRole('button', { name: '전체 디데이 보기' }).click();
  await expect(sortDialog.getByTestId('all-periods-list')).toContainText('장학금 신청');
  const activeFirstCard = sortDialog.getByRole('list').first().locator('li > article').first();
  const completedFirstCard = sortDialog.getByTestId('all-periods-list').locator('li > article').first();
  await expect.poll(async () => {
    const activeBounds = await activeFirstCard.boundingBox();
    const completedBounds = await completedFirstCard.boundingBox();
    return Math.abs((activeBounds?.y ?? 0) - (completedBounds?.y ?? 0));
  }).toBeLessThanOrEqual(1);
});

test('home progress cards can be reordered with the keyboard and keep their saved order', async ({ page }) => {
  await page.goto('/?preview=design');
  const grid = page.getByTestId('period-card-grid');
  await expect(grid).toBeVisible();
  const cards = grid.locator('[data-period-card-id]');
  const initialIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
  expect(initialIds.length).toBeGreaterThan(1);
  await cards.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).not.toEqual(initialIds);
  const reorderedIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
  const savedOrder: string[] = await page.evaluate(() => JSON.parse(localStorage.getItem('todolist.period-order') ?? '[]'));
  expect(savedOrder.slice(0, reorderedIds.length)).toEqual(reorderedIds);
  await page.reload();
  const restoredCards = page.getByTestId('period-card-grid').locator('[data-period-card-id]');
  await expect(restoredCards.first()).toHaveAttribute('data-period-card-id', reorderedIds[0]!);
  expect(await restoredCards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).toEqual(reorderedIds);
});

test('home progress cards can be moved by holding and dragging to another card', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 780 });
  await page.goto('/?preview=design');
  const grid = page.getByTestId('period-card-grid');
  await expect(grid).toBeVisible();
  const cards = grid.locator('[data-period-card-id]');
  const initialIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
  expect(initialIds.length).toBeGreaterThan(1);
  const source = cards.nth(0);
  const target = cards.nth(1);
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  expect(sourceBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();

  await page.mouse.move(sourceBounds!.x + sourceBounds!.width / 2, sourceBounds!.y + sourceBounds!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await expect(source).toHaveAttribute('data-dragging', 'true');
  const currentTargetBounds = await target.boundingBox();
  expect(currentTargetBounds).not.toBeNull();
  await page.mouse.move(currentTargetBounds!.x + currentTargetBounds!.width / 2, currentTargetBounds!.y + currentTargetBounds!.height * 0.75, { steps: 6 });
  await expect(source).toHaveAttribute('data-drop-target', 'true');
  await page.mouse.up();

  await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).not.toEqual(initialIds);
});

test.describe('touch progress-card reordering', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  test('lets a touch hold drag a home card to another card', async ({ page }) => {
    await page.goto('/?preview=design');
    const grid = page.getByTestId('period-card-grid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('[data-period-card-id]');
    const initialIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
    expect(initialIds.length).toBeGreaterThan(1);
    await expect(cards.first()).toHaveCSS('touch-action', 'none');
    const sourceBounds = await cards.nth(0).boundingBox();
    const targetBounds = await cards.nth(1).boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();

    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: sourceBounds!.x + sourceBounds!.width / 2, y: sourceBounds!.y + sourceBounds!.height / 2 }] });
    await page.waitForTimeout(350);
    await expect(cards.nth(0)).toHaveAttribute('data-dragging', 'true');
    const currentTargetBounds = await cards.nth(1).boundingBox();
    expect(currentTargetBounds).not.toBeNull();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: currentTargetBounds!.x + currentTargetBounds!.width / 2, y: currentTargetBounds!.y + currentTargetBounds!.height * 0.75 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).not.toEqual(initialIds);
    await session.detach();
  });
});

test('date and time pickers stay below their fields and keep the time action visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 할 일' }).click();
  const editor = page.getByRole('dialog', { name: '새 할 일' });
  const dateTrigger = editor.getByRole('button', { name: '날짜 달력 선택 열기' });
  await dateTrigger.click();

  const datePicker = page.getByRole('group', { name: '날짜 달력' });
  await expect(datePicker).toBeVisible();
  const dateGeometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="group"][aria-label="날짜 달력"]');
    const trigger = document.querySelector<HTMLElement>('[aria-label="날짜 달력 선택 열기"]');
    const control = trigger?.parentElement;
    if (!panel || !(control instanceof HTMLElement)) throw new Error('날짜 달력 위치를 확인할 요소가 없습니다.');
    return { panelTop: panel.getBoundingClientRect().top, panelBottom: panel.getBoundingClientRect().bottom, anchorBottom: control.getBoundingClientRect().bottom, viewportBottom: window.innerHeight };
  });
  expect(dateGeometry.panelTop).toBeGreaterThanOrEqual(dateGeometry.anchorBottom + 7);
  expect(dateGeometry.panelBottom).toBeLessThanOrEqual(dateGeometry.viewportBottom);
  await page.keyboard.press('Escape');

  await editor.getByText('시간 설정', { exact: true }).click();
  const reveal = editor.locator('[data-open="true"]');
  await expect.poll(() => reveal.evaluate((element) => element.clientHeight)).toBeGreaterThan(100);
  const timeTrigger = editor.getByRole('button', { name: '마감 시각 시각 선택 열기' });
  await timeTrigger.click();
  const timePicker = page.getByRole('group', { name: '마감 시각 시각 선택' });
  await expect(timePicker).toBeVisible();
  const hourOptions = timePicker.getByRole('listbox', { name: '시' });
  const minuteOptions = timePicker.getByRole('listbox', { name: '분' });
  await hourOptions.getByRole('option', { name: '00', exact: true }).click();
  await minuteOptions.getByRole('option', { name: '00', exact: true }).click();
  await expect(timePicker.locator('strong')).toHaveText('00:00');
  await hourOptions.getByRole('option', { name: '23', exact: true }).click();
  await minuteOptions.getByRole('option', { name: '59', exact: true }).click();
  await expect(timePicker.locator('strong')).toHaveText('23:59');
  const timeGeometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="group"][aria-label="마감 시각 시각 선택"]');
    const trigger = document.querySelector<HTMLElement>('[aria-label="마감 시각 시각 선택 열기"]');
    const control = trigger?.parentElement;
    if (!panel || !(control instanceof HTMLElement)) throw new Error('시각 선택 위치를 확인할 요소가 없습니다.');
    const done = [...panel.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '완료');
    if (!done) throw new Error('시각 선택 완료 버튼을 찾지 못했습니다.');
    const panelRect = panel.getBoundingClientRect(); const anchorRect = control.getBoundingClientRect(); const doneRect = done.getBoundingClientRect();
    return { panelTop: panelRect.top, panelBottom: panelRect.bottom, anchorBottom: anchorRect.bottom, doneTop: doneRect.top, doneBottom: doneRect.bottom, viewportBottom: window.innerHeight };
  });
  expect(timeGeometry.panelTop).toBeGreaterThanOrEqual(timeGeometry.anchorBottom + 7);
  expect(timeGeometry.panelBottom).toBeLessThanOrEqual(timeGeometry.viewportBottom);
  expect(timeGeometry.doneTop).toBeGreaterThanOrEqual(timeGeometry.panelTop);
  expect(timeGeometry.doneBottom).toBeLessThanOrEqual(timeGeometry.panelBottom);
});

test('event time picker stays fully visible when its inline fields expand on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByRole('button', { name: /시간 설정/ }).click();

  const timeTrigger = editor.getByRole('button', { name: '시작 시각 시각 선택 열기' });
  await timeTrigger.click();
  const timePicker = page.getByRole('group', { name: '시작 시각 시각 선택' });
  await expect(timePicker).toBeVisible();
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="group"][aria-label="시작 시각 시각 선택"]');
    const trigger = document.querySelector<HTMLElement>('[aria-label="시작 시각 시각 선택 열기"]');
    const control = trigger?.parentElement;
    const done = panel && [...panel.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === '완료');
    if (!panel || !(control instanceof HTMLElement) || !done) throw new Error('일정 시각 선택 위치를 확인할 요소가 없습니다.');
    const panelRect = panel.getBoundingClientRect();
    const anchorRect = control.getBoundingClientRect();
    const doneRect = done.getBoundingClientRect();
    return {
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      anchorTop: anchorRect.top,
      anchorBottom: anchorRect.bottom,
      doneBottom: doneRect.bottom,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  const pickerIsBelow = geometry.panelTop >= geometry.anchorBottom + 7;
  const pickerIsAbove = geometry.panelBottom <= geometry.anchorTop - 7;
  expect(pickerIsBelow || pickerIsAbove).toBe(true);
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.panelTop).toBeGreaterThanOrEqual(0);
  expect(geometry.panelLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.panelRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.doneBottom).toBeLessThanOrEqual(geometry.panelBottom);
});

test('calendar header centers each weekday and home omits ended schedule cards', async ({ page }) => {
  await page.goto('/calendar/?preview=design');
  await expect(page.getByRole('link', { name: 'Todo 홈' })).toHaveCount(0);
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toBeVisible();
  const titleBox = await title.boundingBox();
  const previousArrowBox = await page.getByRole('button', { name: '이전 주' }).boundingBox();
  expect(Math.abs((titleBox?.y ?? 0) + (titleBox?.height ?? 0) / 2 - ((previousArrowBox?.y ?? 0) + (previousArrowBox?.height ?? 0) / 2))).toBeLessThanOrEqual(4);
  const monday = page.locator('[aria-label="요일"] > div').nth(2);
  expect(await monday.evaluate((element) => getComputedStyle(element).justifyItems)).toBe('center');
  expect(await monday.evaluate((element) => getComputedStyle(element).textAlign)).toBe('center');
  await page.goto('/?preview=design');
  await expect(page.locator('[data-period-phase="overdue"]')).toHaveCount(0);
});

test('settings hides the brand and lets content continue under only the floating navigation pill', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  await expect(page.getByRole('link', { name: 'Todo 홈' })).toBeHidden();
  await expect(page.getByRole('combobox', { name: '색상 조합' })).toBeVisible();
  const frame = page.locator('[class*="AppShell_frame"]');
  const route = page.getByRole('main').first();
  await expect.poll(() => route.evaluate((element) => element.getAnimations().length)).toBe(0);
  const frameBox = await frame.boundingBox();
  const routeBox = await route.boundingBox();
  expect(Math.abs(((frameBox?.y ?? 0) + (frameBox?.height ?? 0)) - ((routeBox?.y ?? 0) + (routeBox?.height ?? 0)))).toBeLessThanOrEqual(6);
});

test('color palette applies immediately and survives a reload', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  const frame = page.locator('[data-app-state="design-preview"]');
  const palette = page.getByRole('combobox', { name: '색상 조합' });

  await expect(palette).toHaveAttribute('data-value', 'arctic');
  await expect(frame).toHaveAttribute('data-color-theme', 'arctic');
  await palette.click();
  await page.getByRole('option', { name: 'Rose Quartz' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'rose-quartz');
  await expect.poll(() => frame.evaluate((element) => getComputedStyle(element).getPropertyValue('--color-accent').trim())).toBe('#8F5A73');

  await page.reload();
  await expect(page.getByRole('combobox', { name: '색상 조합' })).toHaveAttribute('data-value', 'rose-quartz');
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'rose-quartz');
  await expect(page.locator('[data-app-state="design-preview"]')).toHaveAttribute('data-color-theme', 'rose-quartz');
});

test('bottom navigation retargets its indicator quickly and scrollbar only appears while scrolling', async ({ page }) => {
  const indicator = page.getByTestId('navigation-indicator');
  await expect(indicator).toHaveAttribute('data-active-route', '/');
  await expect(indicator).toHaveAttribute('data-moving', 'false');
  await indicator.evaluate((element) => { element.dataset.testNavigationHost = 'persistent'; });
  const before = await indicator.evaluate((element) => getComputedStyle(element).transform);
  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/calendar');
  await expect(indicator).toHaveAttribute('data-test-navigation-host', 'persistent');
  await expect.poll(() => indicator.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);
  await expect.poll(() => indicator.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0.24s');
  await expect.poll(() => page.locator('[data-route="calendar"]').evaluate((element) => getComputedStyle(element).animationName)).toContain('route-enter');
  await page.getByRole('link', { name: '사용자 설정' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/settings');
  await expect.poll(() => indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)).toBe(144);
  await expect(indicator).toHaveAttribute('data-moving', 'false', { timeout: 2000 });

  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/calendar');
  await expect(indicator).toHaveAttribute('data-moving', 'false', { timeout: 1000 });

  await page.setViewportSize({ width: 1000, height: 600 });
  const scroller = page.getByRole('region', { name: '시간표 스크롤 영역' });
  await expect(scroller).toHaveAttribute('data-scrolling', 'false');
  await scroller.focus();
  await page.keyboard.press('End');
  await expect(scroller).toHaveAttribute('data-scrolling', 'true');
  await expect.poll(() => scroller.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe('thin');
  await expect(scroller).toHaveAttribute('data-scrolling', 'false', { timeout: 2000 });
});

test('bottom navigation switches immediately when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const indicator = page.getByTestId('navigation-indicator');
  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/calendar');
  await expect(indicator).toHaveAttribute('data-moving', 'false');
  await expect.poll(() => indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)).toBe(72);
  await expect.poll(() => indicator.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await expect.poll(() => page.locator('[data-route="calendar"]').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
});

test('weekends and public holidays use the timeline accent palette and the week grid scrolls within the shell', async ({ page }) => {
  await page.goto('/calendar/?preview=design');
  const dates = page.getByLabel('주간 날짜');
  await expect(dates.locator('div').nth(1)).toHaveClass(/holiday/);
  await expect(dates.locator('div').nth(5)).toHaveClass(/holiday/);
  await expect(dates.locator('div').nth(6)).toHaveClass(/saturday/);
  expect(await dates.locator('div').nth(1).locator('strong').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(228, 5, 44)');
  expect(await dates.locator('div').nth(6).locator('strong').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(44, 105, 141)');
  const route = page.locator('[data-route="calendar"]');
  expect(await route.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  const scroller = page.getByRole('region', { name: '시간표 스크롤 영역' });
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.goto('/?preview=design');
  const month = page.getByRole('grid', { name: '2026년 10월 날짜' });
  await expect(month.getByRole('gridcell', { name: /10월 4일/ })).toHaveClass(/sunday/);
  await expect(month.getByRole('gridcell', { name: /10월 9일/ })).toHaveClass(/holiday/);
  await expect(month.getByRole('gridcell', { name: /10월 10일/ })).toHaveClass(/saturday/);
  expect(await month.getByRole('gridcell', { name: /10월 4일/ }).locator('[class*="dayNumber"]').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(228, 5, 44)');
  expect(await month.getByRole('gridcell', { name: /10월 10일/ }).locator('[class*="dayNumber"]').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(44, 105, 141)');
});

test('settings can scroll the last controls above the floating bottom navigation', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  const route = page.locator('main[class*="route"]');
  const navigation = page.getByRole('navigation', { name: '주요 메뉴' });
  await route.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const lastControl = page.getByRole('region', { name: '데이터 관리' }).getByRole('button', { name: '샘플로 초기화' });
  await lastControl.scrollIntoViewIfNeeded();
  const contentBottom = (await lastControl.boundingBox())?.y ?? 0;
  const lastControlHeight = (await lastControl.boundingBox())?.height ?? 0;
  const navigationTop = (await navigation.boundingBox())?.y ?? 0;
  expect(contentBottom + lastControlHeight).toBeLessThanOrEqual(navigationTop);
});
