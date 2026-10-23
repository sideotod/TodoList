import { test, expect, type Page } from '@playwright/test';
import type { ProposedCalendarItem } from '../../src/domain/items';
import { getTaskCategoryColor } from '../../src/domain/task-categories';
import { chooseHomeDate } from './preview-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-06T03:00:00.000Z'));
  await page.goto('/?preview=design');
  await expect(page.locator('[data-app-state]')).toBeVisible();
  await page.waitForLoadState('networkidle');
});

test('phase 3 editor keeps a fixed desktop width and focuses the empty title error', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  expect((await editor.boundingBox())?.width).toBe(520);
  const title = editor.getByLabel('일정 이름', { exact: true });
  await expect(title).toHaveValue('');
  await expect(editor.getByLabel('시작 날짜', { exact: true })).toBeVisible();
  await expect(editor.getByLabel(/^메모/)).toBeHidden();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(editor.getByText('제목을 입력해 주세요.', { exact: true })).toHaveCount(1);
  await title.fill('고정 폭 편집');
  await editor.getByRole('button', { name: /^반복 설정/ }).click();
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  expect((await editor.boundingBox())?.width).toBe(520);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const geometry = await editor.evaluate((element) => {
    const body = element.querySelector('form > div')!;
    const footer = element.querySelector('footer')!;
    return { scroll: body.scrollHeight > body.clientHeight, bodyBottom: body.getBoundingClientRect().bottom, footerTop: footer.getBoundingClientRect().top, footerBottom: footer.getBoundingClientRect().bottom, overflow: element.scrollWidth > element.clientWidth };
  });
  expect(geometry.scroll).toBe(true);
  expect(geometry.bodyBottom).toBeLessThanOrEqual(geometry.footerTop);
  expect(geometry.footerBottom).toBeLessThanOrEqual(580);
  expect(geometry.overflow).toBe(false);
});

test('phase 3 new period stores the displayed countdown and restores event-only draft settings', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByLabel('일정 이름', { exact: true }).fill('표시값 보존 기간');
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
  await editor.getByLabel('홈 카드 표시', { exact: true }).uncheck();
  await editor.getByLabel('남은 시간 표시', { exact: true }).check();
  await editor.getByLabel('카운트다운 기준', { exact: true }).selectOption('end');
  await editor.getByLabel('표시 시작 일수', { exact: true }).fill('3');
  await editor.getByLabel('종료 날짜', { exact: true }).fill('2026-10-08');
  await expect(editor.getByLabel('홈 카드 표시', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('카운트다운 기준', { exact: true })).toHaveCount(0);
  await expect(editor.getByText(/기간으로 저장/)).toBeVisible();
  await editor.getByLabel('시작일', { exact: true }).check();
  await expect(editor.getByLabel('표시 시작 일수', { exact: true })).toHaveValue('3');
  await editor.getByLabel('종료 날짜', { exact: true }).fill('2026-10-06');
  await expect(editor.getByLabel('홈 카드 표시', { exact: true })).not.toBeChecked();
  await expect(editor.getByLabel('카운트다운 기준', { exact: true })).toHaveValue('end');
  await editor.getByLabel('종료 날짜', { exact: true }).fill('2026-10-08');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  const saved = (await storedItem(page, '표시값 보존 기간')).item;
  expect(saved).toMatchObject({ kind: 'window', focus: 'start', startCountdown: { enabled: true, daysBefore: 3 } });
  expect(saved).not.toHaveProperty('showInProgressSummary');
  expect(saved).not.toHaveProperty('countdown');
});

test('home month navigation keeps the selected day in the viewed month', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '오늘', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '다음 달' }).click();

  await expect(page.getByRole('heading', { name: '11월 6일 금요일', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /11월 6일/ })).toHaveAttribute('aria-selected', 'true');
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

async function seedItems(page: Page, items: ProposedCalendarItem[]) {
  await page.evaluate((records) => localStorage.setItem('todolist:desktop-preview:v2', JSON.stringify({ version: 2, items: records, taskOrders: {}, reminderOffsets: {}, remindersEnabled: false })), items);
  await page.reload();
}

test('phase 3 title edits keep exact instants, focus, imported metadata and optional fields', async ({ page }) => {
  const original: ProposedCalendarItem = {
    id: '12345678-1234-4234-8234-123456789012', kind: 'window', title: '가져온 신청', focus: 'start',
    timing: { type: 'time', startAt: '2026-10-07T00:00:42.123Z', endAt: null, timeZone: 'Asia/Seoul' },
    categoryColor: '#123456', checklist: [{ id: '12345678-1234-4234-8234-123456789013', title: '준비', completed: true }], completion: 'pending',
    startCountdown: { enabled: false, daysBefore: 0 }, notes: '',
    importSource: { uid: 'ical-original', occurrenceKey: 'occurrence', componentFingerprint: 'fingerprint' },
  };
  await seedItems(page, [original]);
  await page.getByRole('button', { name: original.title, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await editor.getByLabel('제목', { exact: true }).fill('원본 보존 수정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect((await storedItem(page, '원본 보존 수정')).item).toEqual({ ...original, title: '원본 보존 수정' });
  await page.reload();
  expect((await storedItem(page, '원본 보존 수정')).item).toEqual({ ...original, title: '원본 보존 수정' });
});

test('phase 3 existing events keep their kind and repeat until-date through edits', async ({ page }) => {
  const original: ProposedCalendarItem = {
    id: '12345678-1234-4234-8234-123456789014', kind: 'event', title: '기존 반복',
    timing: { type: 'date', startDate: '2026-10-06', endDate: '2026-10-06', timeZone: 'Asia/Seoul' },
    recurrence: { frequency: 'weekly', daysOfWeek: [2, 4], untilDate: '2026-12-31' },
    importSource: { uid: 'ical-repeat', occurrenceKey: 'series', componentFingerprint: 'fingerprint' },
  };
  await seedItems(page, [original]);
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  await page.getByRole('button', { name: original.title, exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await expect(editor.getByRole('button', { name: /^반복 설정/ })).toContainText('까지');
  await editor.getByLabel('일정 이름', { exact: true }).fill('기존 반복 수정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect((await storedItem(page, '기존 반복 수정')).item).toEqual({ ...original, title: '기존 반복 수정' });
  await page.getByRole('button', { name: '기존 반복 수정', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '수정', exact: true }).click();
  await editor.getByLabel('종료일', { exact: true }).fill('2026-10-08');
  await expect(editor.getByRole('alert')).toContainText('하루 안에');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel('시작일', { exact: true })).toHaveValue('2026. 10. 06.');
  await editor.getByRole('radio', { name: '한 번' }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  const saved = (await storedItem(page, '기존 반복 수정')).item;
  expect(saved).toMatchObject({ kind: 'event', timing: { startDate: '2026-10-06', endDate: '2026-10-08' }, importSource: original.importSource });
  expect(saved).not.toHaveProperty('recurrence');
  expect(saved).not.toHaveProperty('countdown');
  await expect(page.getByRole('button', { name: '기존 반복 수정', exact: true })).toHaveCount(3);
});

test('phase 3 home display and countdown remain independent and no-end uses start reference', async ({ page }) => {
  for (const home of [false, true]) {
    for (const countdown of [false, true]) {
      const title = `표시 조합 ${home}-${countdown}`;
      await page.getByRole('button', { name: '메뉴' }).click();
      await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
      const editor = page.getByRole('dialog', { name: '새 일정' });
      await editor.getByLabel('일정 이름', { exact: true }).fill(title);
      await editor.getByRole('button', { name: /^D-day 표시/ }).click();
      await editor.getByLabel('홈 카드 표시', { exact: true }).setChecked(home);
      await editor.getByLabel('남은 시간 표시', { exact: true }).check();
      await editor.getByLabel('카운트다운 기준', { exact: true }).selectOption('end');
      await editor.getByLabel('표시 시작 일수', { exact: true }).fill(countdown ? '30' : '0');
      await editor.getByLabel('종료 시각 설정', { exact: true }).uncheck();
      await expect(editor.getByLabel('카운트다운 기준', { exact: true })).toHaveValue('start');
      await editor.getByLabel('남은 시간 표시', { exact: true }).setChecked(countdown);
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      expect((await storedItem(page, title)).item).toMatchObject({ kind: 'event', timing: { endAt: null }, showInProgressSummary: home, countdown: { enabled: countdown, daysBefore: countdown ? 30 : 0, reference: 'start' } });
      await expect(page.getByRole('region', { name: '임박한 일정' }).getByRole('article', { name: title })).toHaveCount(home ? 1 : 0);
    }
  }
});

test('phase 3 storage failure preserves the draft and deletion keeps confirmation', async ({ page }) => {
  await page.getByRole('button', { name: '할 일 추가', exact: true }).click();
  const quickAdd = page.getByRole('textbox', { name: '새 할 일 제목' });
  await expect(quickAdd).toBeFocused();
  await quickAdd.fill('저장 실패 입력');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    const target = window as Window & { restorePreviewStorage?: () => void };
    target.restorePreviewStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'todolist:desktop-preview:v2') throw new Error('미리보기 저장 실패');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(page.getByText('미리보기 저장 실패', { exact: true })).toBeVisible();
  await expect(quickAdd).toHaveValue('저장 실패 입력');
  await page.evaluate(() => (window as Window & { restorePreviewStorage?: () => void }).restorePreviewStorage?.());
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await expect(quickAdd).toBeHidden();
  await page.getByRole('button', { name: '저장 실패 입력', exact: true }).click();
  const details = page.getByRole('dialog', { name: '저장 실패 입력' });
  await details.getByRole('button', { name: '수정', exact: true }).click();
  const editing = page.getByRole('dialog', { name: '일정 수정' });
  page.once('dialog', (dialog) => { void dialog.dismiss(); });
  await editing.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(editing).toBeVisible();
  expect((await storedItem(page, '저장 실패 입력')).item).toBeDefined();
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await editing.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(editing).toBeHidden();
  expect((await storedItem(page, '저장 실패 입력')).item).toBeUndefined();
});

test('compact period keeps the selected kind, visible footer and keyboard focus', async ({ page }) => {
  const editor = await openPeriod(page);
  const title = editor.getByRole('textbox', { name: /^제목/ });
  await expect(title).toBeFocused();
  await expect(editor.getByLabel('유형')).toHaveCount(0);
  await expect(editor.getByLabel('시간대')).toBeHidden();
  await expect(editor.getByLabel('하위 할 일 추가')).toBeHidden();
  const bounds = await editor.boundingBox();
  expect(bounds?.width).toBe(520);
  expect(bounds?.height).toBeLessThan(570);
  expect((await title.boundingBox())?.width).toBeGreaterThanOrEqual((bounds?.width ?? 0) - 64);
  expect(await editor.evaluate((element) => {
    const body = element.querySelector('form > div')!;
    return body.scrollHeight === body.clientHeight;
  })).toBe(true);
  const save = editor.getByRole('button', { name: '저장', exact: true });
  const cancel = editor.getByRole('button', { name: '취소', exact: true });
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  expect((await cancel.boundingBox())?.x).toBeLessThan((await save.boundingBox())?.x ?? 0);
  await cancel.focus();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
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
  const timeSettings = editor;
  await timeSettings.getByLabel('정확한 시각', { exact: true }).check();
  await timeSettings.getByLabel('종료 시각도 기록').check();
  await timeSettings.getByLabel('시작 날짜', { exact: true }).fill('2026-10-07');
  await timeSettings.getByLabel('시작 시각', { exact: true }).fill('09:15');
  await timeSettings.getByLabel('종료 날짜', { exact: true }).fill('2026-10-09');
  await timeSettings.getByLabel('종료 시각', { exact: true }).fill('17:30');
  await timeSettings.getByText('기기 알림', { exact: true }).click();
  await timeSettings.getByRole('button', { name: '1시간 전' }).click();
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
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
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  await editor.getByLabel('시간대', { exact: true }).fill('Asia/Seoul');
  await editor.getByLabel(/^메모/).fill('메모와 링크를 접어도 저장');
  await editor.getByLabel(/^관련 링크/).fill('https://example.com/application');
  await expect(editor.getByLabel(/^분류/)).toHaveCount(0);
  await expect(editor.getByLabel('완료', { exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  const first = await storedItem(page, '기간 기능 보존');
  expect(first.item).toMatchObject({ kind: 'window', completion: 'completed', startCountdown: { enabled: true, daysBefore: 3 }, notes: '메모와 링크를 접어도 저장', sourceUrl: 'https://example.com/application', timing: { type: 'time', startAt: '2026-10-07T00:15:00.000Z', endAt: '2026-10-09T08:30:00.000Z', timeZone: 'Asia/Seoul' } });
  expect(first.item).toHaveProperty('category', '학교');
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
  const timeSettings = editor;
  await timeSettings.getByLabel('정확한 시각', { exact: true }).check();
  await timeSettings.getByLabel('종료 시각도 기록').uncheck();
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  await editor.getByLabel('시간대', { exact: true }).fill('Invalid/Zone');
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor.getByLabel('시간대', { exact: true })).toBeVisible();
  await expect(editor.getByText('유효한 IANA 시간대를 입력해 주세요.', { exact: true })).toBeVisible();
  await editor.getByLabel('시간대', { exact: true }).fill('America/New_York');
  const resolvedTimeSettings = editor;
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
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeVisible();
  const foldSettings = editor;
  await foldSettings.getByLabel('시작 날짜', { exact: true }).fill('2026-11-01');
  await foldSettings.getByLabel('시작 시각', { exact: true }).fill('01:30');
  await expect(foldSettings.getByLabel('첫 번째 시각 (-04:00)')).toBeVisible();
  await expect(foldSettings.getByLabel('두 번째 시각 (-05:00)')).toBeVisible();
  await foldSettings.getByLabel('두 번째 시각 (-05:00)').check();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  expect((await storedItem(page, 'DST 신청')).item).toMatchObject({ timing: { type: 'time', startAt: '2026-11-01T06:30:00.000Z', endAt: null, timeZone: 'America/New_York' } });
});

test('deadline retains optional start, countdown and completion', async ({ page }) => {
  const editor = await openPeriod(page, 'deadline');
  await editor.getByRole('textbox', { name: /^제목/ }).fill('기간 내 마감');
  const timeSettings = editor;
  await timeSettings.getByLabel('날짜', { exact: true }).check();
  await timeSettings.getByLabel('기간 시작일도 기록').uncheck();
  await timeSettings.getByLabel('기간 시작일도 기록').check();
  await timeSettings.getByLabel('시작일', { exact: true }).fill('2026-10-06');
  await timeSettings.getByLabel('종료일', { exact: true }).fill('2026-10-12');
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
  await editor.getByLabel('남은 시간 표시', { exact: true }).check();
  await editor.getByRole('spinbutton').fill('2');
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByLabel('제출 완료', { exact: true }).check();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toBeHidden();
  expect((await storedItem(page, '기간 내 마감')).item).toMatchObject({ kind: 'deadline', timing: { type: 'date', startDate: '2026-10-06', endDate: '2026-10-12' }, startCountdown: { enabled: true, daysBefore: 2 }, completion: 'completed' });
});

test('long form has one body scroller and a reachable footer at four desktop window sizes', async ({ page }) => {
  const editor = await openPeriod(page);
  await editor.getByRole('button', { name: /^하위 할 일 · 완료/ }).click();
  await editor.getByRole('button', { name: /^부가 정보/ }).click();
  await editor.getByLabel(/^메모/).fill('긴 메모\n'.repeat(100));
  for (const viewport of [{ width: 800, height: 600 }, { width: 900, height: 700 }, { width: 1000, height: 780 }, { width: 1100, height: 800 }]) {
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
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  await page.setViewportSize({ width: 1000, height: 600 });
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('2026년 10월 5일 – 11일');
  await expect(page.getByRole('button', { name: '오늘로 이동', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이전 주' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('2026년 9월 28일 – 10월 4일');
  await page.getByRole('button', { name: '다음 주' }).click();
  const scroller = page.getByRole('region', { name: '시간표 스크롤 영역' });
  const scrollerBounds = await scroller.boundingBox();
  const firstTimeLabel = page.getByText('08:00', { exact: true });
  const firstTimeLabelBounds = await firstTimeLabel.boundingBox();
  expect(scrollerBounds).not.toBeNull();
  expect(firstTimeLabelBounds).not.toBeNull();
  // The current week opens near the current time; the earlier 08:00 row stays available by scrolling up.
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(firstTimeLabelBounds!.y).toBeLessThan(scrollerBounds!.y);
  const currentHourLabelBounds = await page.getByText('11:00', { exact: true }).boundingBox();
  expect(currentHourLabelBounds?.y).toBeGreaterThanOrEqual(scrollerBounds!.y);
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
  const emptySlot = page.getByRole('button', { name: '2026-10-09 08:00 일정 추가', exact: true });
  const emptySlotBounds = await emptySlot.boundingBox();
  expect(emptySlotBounds).not.toBeNull();
  await emptySlot.click({ position: { x: 50, y: emptySlotBounds!.height * (4.5 / 14) } });
  const editor = page.getByRole('dialog');
  const timeSettings = editor.getByRole('region', { name: '일정 시간 설정' });
  const timePanel = timeSettings;
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

test('weekly calendar adds an event from the keyboard-selected date and time', async ({ page }) => {
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  const slot = page.getByRole('button', { name: '2026-10-09 08:00 일정 추가', exact: true });
  await slot.focus();
  await page.keyboard.press('ArrowUp');
  await expect(slot).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const adjustedSlot = page.getByRole('button', { name: '2026-10-09 08:15 일정 추가', exact: true });
  await expect(adjustedSlot).toBeFocused();
  const timeMarker = page.locator('[data-keyboard-time-marker]');
  await expect(timeMarker).toBeVisible();
  await expect(timeMarker).toContainText('08:15');
  await expect(timeMarker).toContainText('↑↓ 이동 · Enter 추가');

  const nextDateSlot = page.getByRole('button', { name: '2026-10-10 08:00 일정 추가', exact: true });
  await nextDateSlot.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: '2026-10-10 08:15 일정 추가', exact: true })).toBeFocused();
  await expect(adjustedSlot).toHaveAccessibleName('2026-10-09 08:15 일정 추가');

  await adjustedSlot.focus();
  await page.keyboard.press('Enter');

  const editor = page.getByRole('dialog');
  const timing = editor.getByRole('region', { name: '일정 시간 설정' });
  await expect(timing.getByLabel('시작 날짜', { exact: true })).toHaveValue('2026. 10. 09.');
  await expect(timing.getByLabel('시작 시각', { exact: true })).toHaveValue('08:15');
});

test('weekly calendar clamps keyboard-added events to the final 15-minute slot', async ({ page }) => {
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  const slot = page.getByRole('button', { name: '2026-10-10 08:00 일정 추가', exact: true });
  await slot.focus();
  for (let step = 0; step < 55; step += 1) await page.keyboard.press('ArrowDown');

  const finalSlot = page.getByRole('button', { name: '2026-10-10 21:45 일정 추가', exact: true });
  await expect(finalSlot).toBeFocused();
  const timeMarker = page.locator('[data-keyboard-time-marker]');
  await expect(timeMarker).toBeVisible();
  await expect(timeMarker).toContainText('21:45');
  const timeViewportBounds = await page.getByRole('region', { name: '시간표 스크롤 영역' }).boundingBox();
  const markerBounds = await timeMarker.boundingBox();
  expect(timeViewportBounds).not.toBeNull();
  expect(markerBounds?.y).toBeGreaterThanOrEqual(timeViewportBounds!.y);
  expect((markerBounds?.y ?? 0) + (markerBounds?.height ?? 0)).toBeLessThanOrEqual(timeViewportBounds!.y + timeViewportBounds!.height);
  await page.keyboard.press('ArrowDown');
  await expect(finalSlot).toBeFocused();
  await page.keyboard.press('Space');

  const timing = page.getByRole('dialog').getByRole('region', { name: '일정 시간 설정' });
  await expect(timing.getByLabel('시작 날짜', { exact: true })).toHaveValue('2026. 10. 10.');
  await expect(timing.getByLabel('시작 시각', { exact: true })).toHaveValue('21:45');
});

test('weekly calendar keeps the home content width on desktop and mobile', async ({ page }) => {
  const homePage = page.locator('main[class*="HomeExperience_page"]');
  await expect(homePage).toBeVisible();
  const homeGeometry = await homePage.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    return { width: rect.width, parentWidth: parent.width, padding: [style.paddingTop, style.paddingBottom] };
  });
  expect(homeGeometry.width).toBeLessThanOrEqual(homeGeometry.parentWidth);
  expect(homeGeometry.padding).toEqual(['34px', '22px']);
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  const weekPage = page.locator('main[data-view="week"]');
  await expect(weekPage).toBeVisible();
  const weekGeometry = await weekPage.evaluate((element) => ({ width: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width }));
  expect(weekGeometry.width).toBeLessThanOrEqual(weekGeometry.parentWidth);
  await expect(weekPage).toHaveCSS('padding-top', '28px');
  await expect(weekPage).toHaveCSS('padding-bottom', '12px');
  const weekPadding = await weekPage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  });
  expect(weekPadding).toEqual(['28px', '12px']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?preview=design');
  const mobileHomePage = page.locator('main[class*="HomeExperience_page"]');
  await expect(mobileHomePage).toBeVisible();
  const mobileHomeGeometry = await mobileHomePage.evaluate((element) => ({ width: element.getBoundingClientRect().width, parentWidth: element.parentElement!.getBoundingClientRect().width, padding: [getComputedStyle(element).paddingTop, getComputedStyle(element).paddingBottom] }));
  expect(mobileHomeGeometry.width).toBeLessThanOrEqual(mobileHomeGeometry.parentWidth);
  expect(mobileHomeGeometry.padding).toEqual(['20px', '20px']);
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  const mobileWeekPage = page.locator('main[data-view="week"]');
  await expect(mobileWeekPage).toHaveCSS('width', '358px');
  await expect(mobileWeekPage).toHaveCSS('padding-top', '82px');
  await expect(mobileWeekPage).toHaveCSS('padding-bottom', '24px');
  expect(await mobileWeekPage.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingBottom];
  })).toEqual(['82px', '24px']);
});

test('calendar event edits preserve countdown and dates with display settings folded', async ({ page }) => {
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^연구실 세미나 / }).click();
  const details = page.getByRole('dialog', { name: '연구실 세미나' });
  await expect(details.getByRole('img', { name: '시작 예정' })).toBeVisible();
  await expect(details).toContainText('10.06 13:00');
  await details.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await expect(editor.getByLabel('시작 날짜', { exact: true })).toBeVisible();
  await expect(editor.getByLabel('기기 알림')).toHaveCount(0);
  const displayToggle = editor.getByRole('button', { name: /^D-day 표시/ });
  await displayToggle.click();
  await expect(editor.getByLabel('남은 시간 표시', { exact: true })).not.toBeChecked();
  await editor.getByLabel('남은 시간 표시', { exact: true }).check();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  const first = await storedItem(page, '연구실 세미나');
  expect(first.reminder).toBeUndefined();
  expect(first.item).toMatchObject({ countdown: { enabled: true, daysBefore: 1, reference: 'start' } });
  await page.getByRole('button', { name: /^연구실 세미나 / }).click();
  await page.getByRole('dialog', { name: '연구실 세미나' }).getByRole('button', { name: '수정', exact: true }).click();
  await displayToggle.click();
  await expect(editor.getByLabel('카운트다운 기준', { exact: true })).toHaveValue('start');
  await displayToggle.click();
  await editor.getByLabel('일정 이름', { exact: true }).fill('알림 유지 세미나');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect(await storedItem(page, '알림 유지 세미나')).toEqual({ ...first, item: { ...first.item, title: '알림 유지 세미나' } });
  await expect(page.getByRole('button', { name: /^알림 유지 세미나 / })).toBeFocused();
});

test('task time and reminder expand inline without a popup or task completion controls', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '새 할 일', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 할 일' });
  await expect(editor.getByRole('button', { name: '편집 닫기' })).toHaveCount(0);
  await editor.getByRole('textbox', { name: '할 일 이름' }).fill('시각과 알림 설정');
  await editor.getByLabel('날짜', { exact: true }).fill('2026-10-06');
  await expect(editor.getByLabel('완료', { exact: true })).toHaveCount(0);
  await expect(editor.getByRole('combobox', { name: '분류' })).toBeVisible();
  await expect(editor.getByText('추가 설정', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('시간대', { exact: true })).toBeHidden();
  await expect(editor.getByLabel(/^관련 링크/)).toBeHidden();
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
  expect((await cancelButton.boundingBox())?.x).toBeLessThan((await saveButton.boundingBox())?.x ?? 0);
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect(await storedItem(page, '시각과 알림 설정')).toMatchObject({
    item: { kind: 'task', timing: { type: 'time', endAt: '2026-10-06T00:00:00.000Z' } },
    reminder: 30,
  });
});

test('home menu aligns with the logo row and event time fields stay in one column', async ({ page }) => {
  const logo = page.getByTestId('todo-logo');
  const menu = page.getByRole('button', { name: '메뉴' });
  await expect(logo).toBeVisible();
  await expect(menu).toBeVisible();
  await expect.poll(async () => {
    const logoBounds = await logo.boundingBox();
    const menuBounds = await menu.boundingBox();
    if (!logoBounds || !menuBounds) return Number.POSITIVE_INFINITY;
    return Math.abs(logoBounds.y + logoBounds.height / 2 - (menuBounds.y + menuBounds.height / 2));
  }).toBeLessThanOrEqual(5);
  await menu.click(); await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  const eventTitle = editor.getByLabel('일정 이름', { exact: true });
  await expect(eventTitle).toHaveValue('');
  await eventTitle.hover();
  await expect(eventTitle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(eventTitle).toHaveCSS('border-bottom-width', '1px');
  await expect(eventTitle).toHaveCSS('border-radius', '0px');
  await expect(editor.getByLabel('제목', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('시간대', { exact: true })).toBeHidden();
  await editor.getByLabel('시작 날짜', { exact: true }).fill('2026-10-07');
  await editor.getByLabel('종료 날짜', { exact: true }).fill('2026-10-07');
  await editor.getByLabel('시작 시각', { exact: true }).fill('09:00');
  await editor.getByLabel('종료 시각', { exact: true }).fill('09:30');
  await editor.getByRole('button', { name: /^반복 설정/ }).click();
  const repeatSwitch = editor.getByRole('radio', { name: '매주 반복' });
  await repeatSwitch.click(); await expect(repeatSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(editor.getByRole('group', { name: '반복 요일' })).toBeVisible();
  await editor.getByRole('radio', { name: '한 번' }).click();
  await editor.getByRole('radio', { name: '종일' }).click();
  await expect(editor.getByRole('radio', { name: '종일' })).toHaveAttribute('aria-checked', 'true');
  await editor.getByRole('radio', { name: '정확한 시각' }).click();
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
  await editor.getByLabel('홈 카드 표시', { exact: true }).check();
  await editor.getByLabel('남은 시간 표시', { exact: true }).check();
  expect((await editor.boundingBox())?.width).toBe(520);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await eventTitle.fill('기준 시각이 있는 일정');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect((await storedItem(page, '기준 시각이 있는 일정')).item).toMatchObject({ kind: 'event', timing: { type: 'time', startAt: '2026-10-07T00:00:00.000Z', endAt: '2026-10-07T00:30:00.000Z' }, countdown: { enabled: true, daysBefore: 1, reference: 'start' } });
  await expect(page.getByRole('region', { name: '선택한 날짜의 일정과 할 일' }).getByText('기준 시각이 있는 일정', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '임박한 일정' }).getByRole('article', { name: '기준 시각이 있는 일정' })).toBeVisible();
  await menu.click(); await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  await expect(page.getByRole('dialog', { name: '디데이 정렬' }).getByRole('listitem', { name: /기준 시각이 있는 일정/ })).toBeVisible();
});

test('event editor aligns color, repeat and ordered date-time fields in a fixed column', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click(); await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  const palette = editor.getByRole('group', { name: '일정 색상' });
  const label = await palette.getByText('일정 색상', { exact: true }).last().boundingBox();
  const color = await palette.getByRole('button', { name: '일정 색상 1' }).boundingBox();
  expect(Math.abs((label!.y + label!.height / 2) - (color!.y + color!.height / 2))).toBeLessThan(8);
  const startDate = await editor.getByLabel('시작 날짜', { exact: true }).boundingBox();
  const startTime = await editor.getByLabel('시작 시각', { exact: true }).boundingBox();
  const endDate = await editor.getByLabel('종료 날짜', { exact: true }).boundingBox();
  const endTime = await editor.getByLabel('종료 시각', { exact: true }).boundingBox();
  expect(Math.abs(startDate!.y - startTime!.y)).toBeLessThan(2);
  expect(startDate!.x).toBeLessThan(startTime!.x); expect(startTime!.y).toBeLessThan(endDate!.y);
  expect(Math.abs(endDate!.y - endTime!.y)).toBeLessThan(2);
  await expect(editor.getByRole('group', { name: '시작', exact: true })).toHaveCSS('border-style', 'none');
  const repeat = editor.getByRole('button', { name: /^반복 설정/ });
  await expect(repeat).toContainText('한 번'); await repeat.click();
  await expect(repeat).not.toContainText('한 번');
  await editor.getByRole('radio', { name: '매주 반복' }).click();
  const tops = await editor.getByRole('group', { name: '반복 요일' }).getByRole('button').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  expect((await editor.boundingBox())?.width).toBe(520);
});

test('calendar event details, category settings and D-day sort use the same compact width', async ({ page }) => {
  await page.goto('/calendar/?preview=design&date=2026-10-06&view=day');
  const seminar = page.getByRole('button', { name: /^연구실 세미나 / });
  await expect(seminar).toBeVisible();
  await seminar.click();
  const details = page.getByRole('dialog', { name: '연구실 세미나' });
  const detailsWidth = (await details.boundingBox())?.width;
  await page.keyboard.press('Escape');

  await page.goto('/?preview=design');
  const menuTrigger = page.getByRole('button', { name: '메뉴' });
  await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
  await menuTrigger.click();
  await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('menuitem', { name: '디데이 정렬' }).click();
  const sortDialog = page.getByRole('dialog', { name: '디데이 정렬' });
  const sortWidth = (await sortDialog.boundingBox())?.width;
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '카테고리 설정' }).click();
  const categoryDialog = page.getByRole('dialog', { name: '카테고리 설정' });
  expect(detailsWidth).toBeLessThanOrEqual(400);
  expect(sortWidth).toBeLessThanOrEqual(400);
  expect((await categoryDialog.boundingBox())?.width).toBe(sortWidth);
});

test('new schedule can be a progress card and sortable item, separate from daily tasks', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['새 할 일', '새 일정', '디데이 정렬', '카테고리 설정']);
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByLabel('일정 이름', { exact: true }).fill('오늘의 새 일정');
  await expect(editor.getByLabel('시작 시각', { exact: true })).toHaveValue('12:30');
  await expect(editor.getByLabel('시작 날짜 달력 선택 열기')).toBeVisible();
  await expect(editor.getByLabel('시작 시각 시각 선택 열기')).toBeVisible();
  const display = editor.getByRole('button', { name: /^D-day 표시/ });
  await expect(display).toHaveAttribute('aria-expanded', 'false'); await display.click();
  await expect(editor.getByLabel('홈 카드 표시', { exact: true })).not.toBeChecked();
  await editor.getByLabel('홈 카드 표시', { exact: true }).check();
  await display.click(); await expect(editor.getByLabel('홈 카드 표시', { exact: true })).toBeHidden();
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  expect((await storedItem(page, '오늘의 새 일정')).item).toMatchObject({ kind: 'event', showInProgressSummary: true });
  await expect(page.getByRole('region', { name: '임박한 일정' }).getByRole('article', { name: '오늘의 새 일정' })).toBeVisible();
  const selected = page.getByRole('region', { name: '선택한 날짜의 일정과 할 일' });
  await expect(selected.getByRole('region', { name: '일정' }).getByText('오늘의 새 일정', { exact: true })).toBeVisible();
  await expect(selected.getByRole('region', { name: '할 일' }).getByText('오늘의 새 일정', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '메뉴' }).click(); await page.getByRole('menuitem', { name: '디데이 정렬', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '디데이 정렬' }).getByRole('listitem', { name: /오늘의 새 일정/ })).toBeVisible();
});

test('schedule repeat honors weekday order and expands below basic dates without widening', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click(); await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  const initialWidth = (await editor.boundingBox())!.width;
  const dates = editor.getByRole('region', { name: '일정 시간 설정' });
  await expect(dates.getByLabel('시작 날짜', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: /^반복 설정/ }).click();
  const options = editor.getByRole('radiogroup', { name: '반복' });
  await expect(options.getByRole('radio', { name: '한 번' })).toHaveAttribute('aria-checked', 'true');
  await options.getByRole('radio', { name: '매주 반복' }).click();
  await expect(options.getByRole('radio', { name: '매주 반복' })).toHaveAttribute('aria-checked', 'true');
  const weekdays = editor.getByRole('group', { name: '반복 요일' });
  await expect(weekdays.getByRole('button')).toHaveText(['월', '화', '수', '목', '금', '토', '일']);
  const row = await options.boundingBox(); const days = await weekdays.boundingBox();
  expect(days!.y).toBeGreaterThan(row!.y);
  await editor.getByRole('radio', { name: '종일' }).click();
  await expect(editor.getByLabel('시작일', { exact: true })).toBeVisible();
  expect((await editor.boundingBox())!.width).toBe(initialWidth);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('button', { name: '저장하지 않고 닫기' }).click();
});

test('event countdown options can be edited from the schedule editor', async ({ page }) => {
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });
  await editor.getByLabel('일정 이름').fill('카운트다운 편집');
  await editor.getByRole('button', { name: '일정 색상 4' }).click();
  await editor.getByRole('button', { name: /^D-day 표시/ }).click();
  await editor.getByLabel('남은 시간 표시', { exact: true }).check();
  await editor.getByLabel('카운트다운 기준', { exact: true }).selectOption('end');
  await editor.getByLabel('표시 시작 일수', { exact: true }).fill('3');
  await editor.getByRole('button', { name: '저장', exact: true }).click();

  expect((await storedItem(page, '카운트다운 편집')).item).toMatchObject({
    kind: 'event',
    categoryColor: getTaskCategoryColor('violet').color,
    countdown: { enabled: true, daysBefore: 3, reference: 'end' },
  });
});

test('opening a progress card shows information, a quick countdown toggle and an edit path', async ({ page }) => {
  await page.getByRole('region', { name: '임박한 일정' }).getByRole('button', { name: '수강신청', exact: true }).click();
  const details = page.getByRole('dialog', { name: '수강신청' });
  expect((await details.boundingBox())?.width).toBeLessThanOrEqual(522);
  const card = details.getByRole('article', { name: '수강신청' });
  await expect(card).toHaveAttribute('data-expanded', 'true');
  const progress = card.getByRole('progressbar');
  await expect(progress).toBeVisible();
  expect((await card.boundingBox())?.height).toBeGreaterThanOrEqual(88);
  await expect(progress).toHaveCSS('height', '5px');
  await expect(details.locator('footer')).toHaveCSS('border-top-width', '0px');
  await expect(details.getByRole('button', { name: '닫기', exact: true })).toHaveCSS('min-height', '44px');
  await expect(details.getByRole('button', { name: '수정' })).toHaveCSS('min-height', '44px');
  const countdown = details.getByRole('switch', { name: '카운트다운' });
  await expect(countdown).toBeChecked();
  await countdown.click();
  await expect(countdown).not.toBeChecked();
  await expect(details.getByRole('status')).toContainText('설정을 저장했습니다.');

  await details.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '일정 수정' });
  await expect(editor.getByRole('textbox', { name: /^제목/ })).toHaveValue('수강신청');
  await expect(editor.getByRole('button', { name: '저장', exact: true })).toBeVisible();
});

test('category settings use a compact dialog and readable category dots', async ({ page }) => {
  await chooseHomeDate(page, '2026-10-10');
  const selectedTasks = page.getByTestId('home-workspace').locator('[class*="primaryColumn"]').getByRole('region', { name: '선택한 날짜의 일정과 할 일' });
  const categoryHeading = selectedTasks.locator('[data-task-category] h3').first();
  await expect(categoryHeading).toBeVisible();
  const selectedTasksBounds = await selectedTasks.boundingBox();
  const categoryHeadingBounds = await categoryHeading.boundingBox();
  expect(selectedTasksBounds).not.toBeNull();
  expect(categoryHeadingBounds).not.toBeNull();
  expect(Math.abs(categoryHeadingBounds!.x - selectedTasksBounds!.x)).toBeLessThanOrEqual(1);
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
  await sortDialog.getByRole('button', { name: '전체 D-day 보기' }).click();
  const allPeriodsDialog = page.getByRole('dialog', { name: '전체 D-day' });
  await expect(allPeriodsDialog).toHaveAttribute('data-view', 'all');
  await expect(allPeriodsDialog.getByTestId('all-periods-list')).toContainText('장학금 신청');
  const activeHeading = allPeriodsDialog.getByRole('heading', { name: '예정 및 진행 중' });
  const completedHeading = allPeriodsDialog.getByRole('heading', { name: '완료 및 종료' });
  const activeFirstCard = allPeriodsDialog.getByRole('list').first().locator('li > article').first();
  const completedFirstCard = allPeriodsDialog.getByTestId('all-periods-list').locator('li > article').first();
  for (const [heading, card] of [[activeHeading, activeFirstCard], [completedHeading, completedFirstCard]] as const) {
    const headingBounds = await heading.boundingBox();
    const cardBounds = await card.boundingBox();
    expect(Math.abs((headingBounds?.x ?? 0) - (cardBounds?.x ?? 0))).toBeLessThanOrEqual(2);
  }
  await expect.poll(async () => {
    const activeBounds = await activeFirstCard.boundingBox();
    const completedBounds = await completedFirstCard.boundingBox();
    return Math.abs((activeBounds?.width ?? 0) - (completedBounds?.width ?? 0));
  }).toBeLessThanOrEqual(2);
  const dialogBounds = await allPeriodsDialog.boundingBox();
  const activeBounds = await activeFirstCard.boundingBox();
  expect(activeBounds?.x).toBeGreaterThan((dialogBounds?.x ?? 0) + 8);
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
  await expect.poll(() => restoredCards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).toEqual(reorderedIds);
});

test('home progress cards can be moved by holding and dragging to another card', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 780 });
  await page.goto('/?preview=design');
  await expect(page.locator('[data-app-state="local-only"]')).toBeVisible();
  const grid = page.getByTestId('period-card-grid');
  await expect(grid).toBeVisible();
  const cards = grid.locator('[data-period-card-id]');
  const initialIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
  expect(initialIds.length).toBeGreaterThan(1);
  const source = cards.nth(0);
  const target = cards.nth(1);
  await expect.poll(async () => Number(Boolean(await source.boundingBox()) && Boolean(await target.boundingBox()))).toBe(1);
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  expect(sourceBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();

  await page.mouse.move(sourceBounds!.x + sourceBounds!.width / 2, sourceBounds!.y + sourceBounds!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await expect(source).toHaveAttribute('data-dragging', 'true');
  await expect.poll(async () => Number(Boolean(await target.boundingBox()))).toBe(1);
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
    await expect(page.locator('[data-app-state="local-only"]')).toBeVisible();
    const grid = page.getByTestId('period-card-grid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('[data-period-card-id]');
    const initialIds = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')));
    expect(initialIds.length).toBeGreaterThan(1);
    await expect(cards.first()).toHaveCSS('touch-action', 'none');
    await expect.poll(async () => Number(Boolean(await cards.nth(0).boundingBox()) && Boolean(await cards.nth(1).boundingBox()))).toBe(1);
    const sourceBounds = await cards.nth(0).boundingBox();
    const targetBounds = await cards.nth(1).boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();

    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: sourceBounds!.x + sourceBounds!.width / 2, y: sourceBounds!.y + sourceBounds!.height / 2 }] });
    await page.waitForTimeout(350);
    await expect(cards.nth(0)).toHaveAttribute('data-dragging', 'true');
    await expect.poll(async () => Number(Boolean(await cards.nth(1).boundingBox()))).toBe(1);
    const currentTargetBounds = await cards.nth(1).boundingBox();
    expect(currentTargetBounds).not.toBeNull();
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: currentTargetBounds!.x + currentTargetBounds!.width / 2, y: currentTargetBounds!.y + currentTargetBounds!.height * 0.75 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-period-card-id')))).not.toEqual(initialIds);
    await session.detach();
  });
});

test('date and time pickers stay anchored and keep the time action visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 할 일' }).click();
  const editor = page.getByRole('dialog', { name: '새 할 일' });
  const dateTrigger = editor.getByRole('button', { name: '날짜 달력 선택 열기' });
  await dateTrigger.click();

  const datePicker = page.getByRole('group', { name: '날짜 달력' });
  await expect(datePicker).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity));
  const dateGeometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="group"][aria-label="날짜 달력"]');
    const trigger = document.querySelector<HTMLElement>('[aria-label="날짜 달력 선택 열기"]');
    const control = trigger?.parentElement;
    if (!panel || !(control instanceof HTMLElement)) throw new Error('날짜 달력 위치를 확인할 요소가 없습니다.');
    return { panelTop: panel.getBoundingClientRect().top, panelBottom: panel.getBoundingClientRect().bottom, anchorTop: trigger.getBoundingClientRect().top, anchorBottom: trigger.getBoundingClientRect().bottom, viewportBottom: window.innerHeight };
  });
  expect(dateGeometry.panelTop >= dateGeometry.anchorBottom + 7 || dateGeometry.panelBottom <= dateGeometry.anchorTop - 7).toBe(true);
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
    return { panelTop: panelRect.top, panelBottom: panelRect.bottom, anchorTop: anchorRect.top, anchorBottom: anchorRect.bottom, doneTop: doneRect.top, doneBottom: doneRect.bottom, viewportBottom: window.innerHeight };
  });
  expect(timeGeometry.panelTop >= timeGeometry.anchorBottom + 7 || timeGeometry.panelBottom <= timeGeometry.anchorTop - 7).toBe(true);
  expect(timeGeometry.panelBottom).toBeLessThanOrEqual(timeGeometry.viewportBottom);
  expect(timeGeometry.doneTop).toBeGreaterThanOrEqual(timeGeometry.panelTop);
  expect(timeGeometry.doneBottom).toBeLessThanOrEqual(timeGeometry.panelBottom);
});

test('event time picker stays fully visible when its inline fields expand on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '메뉴' }).click();
  await page.getByRole('menuitem', { name: '새 일정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 일정' });

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
  await expect(page.getByRole('link', { name: 'Todo 홈' })).toHaveAttribute('href', expect.stringContaining('/'));
  await expect(page.getByRole('link', { name: '캘린더' })).toHaveAttribute('aria-current', 'page');
  const title = page.getByRole('heading', { level: 2 });
  const previousArrow = page.getByRole('button', { name: '이전 주' });
  await expect(title).toBeVisible();
  await expect(previousArrow).toBeVisible();
  const titleBox = await title.boundingBox();
  const previousArrowBox = await previousArrow.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(previousArrowBox).not.toBeNull();
  expect(Math.abs((titleBox?.y ?? 0) + (titleBox?.height ?? 0) / 2 - ((previousArrowBox?.y ?? 0) + (previousArrowBox?.height ?? 0) / 2))).toBeLessThanOrEqual(4);
  const monday = page.locator('[aria-label="요일"] > div').nth(2);
  expect(await monday.evaluate((element) => getComputedStyle(element).justifyItems)).toBe('center');
  expect(await monday.evaluate((element) => getComputedStyle(element).textAlign)).toBe('center');
  await page.goto('/?preview=design');
  await expect(page.locator('[data-period-phase="overdue"]')).toHaveCount(0);
});

test('settings opens an accessible right inspector over the home screen', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  await expect(page.getByRole('dialog', { name: '설정' })).toBeVisible();
  await expect(page.getByRole('link', { name: '설정 · 내 공간' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '화면' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Apple Blue', { exact: true })).toBeVisible();
  const frame = page.locator('[class*="AppShell_frame"]');
  const inspector = page.locator('[class*="AppShell_settingsInspector"]');
  const frameBox = await frame.boundingBox();
  const inspectorBox = await inspector.boundingBox();
  expect(inspectorBox?.width).toBe(420);
  expect(Math.abs(((frameBox?.x ?? 0) + (frameBox?.width ?? 0)) - ((inspectorBox?.x ?? 0) + (inspectorBox?.width ?? 0)))).toBeLessThanOrEqual(1);
});

test('accent family selection changes the interface and survives a reload', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  const frame = page.locator('[data-app-state="design-preview"]');
  await expect(page.getByText('Apple Blue', { exact: true })).toBeVisible();
  await expect(page.getByText('#0066CC', { exact: true })).toHaveCount(0);
  await expect(frame).toHaveAttribute('data-color-theme', 'sage');
  await page.getByRole('radio', { name: 'Apple Blue' }).click();
  await expect(frame).toHaveAttribute('data-color-theme', 'apple-blue');
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'apple-blue');
  await expect.poll(() => frame.evaluate((element) => getComputedStyle(element).getPropertyValue('--color-accent').trim())).toBe('#0066cc');

  await page.reload();
  await expect(page.getByText('Apple Blue', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-color-theme', 'apple-blue');
  await expect(page.locator('[data-app-state="design-preview"]')).toHaveAttribute('data-color-theme', 'apple-blue');
});

test('bottom navigation retargets its indicator quickly and scrollbar only appears while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?preview=design');
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
  await expect.poll(() => page.locator('[data-route="calendar"]').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('link', { name: '사용자 설정' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/settings');
  await expect.poll(() => indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)).toBe(144);
  await expect(indicator).toHaveAttribute('data-moving', 'false', { timeout: 2000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '설정' })).toBeHidden();
  await expect(indicator).toHaveAttribute('data-active-route', '/');
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?preview=design');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const indicator = page.getByTestId('navigation-indicator');
  await page.getByRole('link', { name: '캘린더' }).click();
  await expect(indicator).toHaveAttribute('data-active-route', '/calendar');
  await expect(indicator).toHaveAttribute('data-moving', 'false');
  await expect.poll(() => indicator.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)).toBe(72);
  await expect.poll(() => indicator.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await expect.poll(() => page.locator('[data-route="calendar"]').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
});

test('weekends and public holidays use semantic colors and the week grid scrolls within the shell', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/calendar/?preview=design&date=2026-10-06');
  const dates = page.getByLabel('주간 날짜');
  await expect(dates.locator('div').nth(4)).toHaveClass(/holiday/);
  await expect(dates.locator('div').nth(5)).toHaveClass(/saturday/);
  expect(await dates.locator('div').nth(4).locator('strong').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(179, 38, 30)');
  const saturdayColor = await page.locator('[class*="AppShell_frame"]').evaluate((frame) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-saturday)';
    frame.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect(await dates.locator('div').nth(5).locator('strong').evaluate((element) => getComputedStyle(element).color)).toBe(saturdayColor);
  const route = page.locator('[data-route="calendar"]');
  expect(await route.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  const scroller = page.getByRole('region', { name: '시간표 스크롤 영역' });
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.goto('/?preview=design');
  const month = page.getByRole('grid', { name: '2026년 10월 날짜' });
  await expect(month.getByRole('gridcell', { name: /10월 4일/ })).toHaveClass(/sunday/);
  await expect(month.getByRole('gridcell', { name: /10월 9일/ })).toHaveClass(/holiday/);
  await expect(month.getByRole('gridcell', { name: /10월 10일/ })).toHaveClass(/saturday/);
});

test('settings data tab keeps local backup, restore, and reset controls available', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  await page.getByRole('tab', { name: '데이터' }).click();
  await expect(page.getByRole('button', { name: 'JSON 백업 내보내기' })).toBeVisible();
  await expect(page.getByLabel('백업 복원 파일 선택')).toBeVisible();
  await expect(page.getByRole('button', { name: '샘플로 초기화' })).toBeVisible();
});

test('compact home keeps the menu above compact D-day rows and keeps task controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const cards = page.getByTestId('period-card-grid');
  const menu = page.getByRole('button', { name: '메뉴', exact: true });
  await expect(menu).toBeVisible();
  await expect(cards).toBeVisible();
  await expect.poll(async () => {
    const menuBounds = await menu.boundingBox();
    const cardBounds = await cards.boundingBox();
    return Boolean(menuBounds && cardBounds && menuBounds.y + menuBounds.height <= cardBounds.y);
  }).toBe(true);
  await expect(cards.locator('article').first()).toHaveCSS('height', '39px');
  const month = page.getByRole('region', { name: '월간 할 일', exact: true });
  await expect(month.getByLabel('달력 표시 범례')).toHaveCount(0);
  await expect(month.locator('[aria-label*="일정 "]')).toHaveCount(0);
  const selected = page.getByRole('region', { name: '선택한 날짜의 일정과 할 일' });
  await expect(selected.getByRole('button', { name: /학회 논문 제출/ })).toHaveCount(0);
  await expect(selected.getByRole('button', { name: '할 일 추가', exact: true })).toBeVisible();
  await menu.click();
  await expect(page.getByRole('menuitem', { name: '새 일정', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
});

test('small desktop dropdown stays in the viewport and returns keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/settings/?preview=design');
  await page.getByRole('tab', { name: '캘린더' }).click();
  const trigger = page.getByRole('combobox', { name: '시간대', exact: true });
  await trigger.click();
  const list = page.getByRole('listbox', { name: '시간대 선택' });
  await expect(list).toBeVisible();
  const box = await list.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(12);
  expect(box!.x + box!.width).toBeLessThanOrEqual(788);
  expect(box!.y).toBeGreaterThanOrEqual(12);
  expect(box!.y + box!.height).toBeLessThanOrEqual(588);
  await page.keyboard.press('End');
  await expect(list.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS('min-height', '32px');
});

test('portal settings options continue Tab navigation from their trigger', async ({ page }) => {
  await page.goto('/settings/?preview=design');
  await page.getByRole('tab', { name: '캘린더' }).click();
  const start = page.getByRole('combobox', { name: '주 시작일', exact: true });
  const format = page.getByRole('combobox', { name: '시간 표시', exact: true });
  await start.click();
  await page.keyboard.press('Tab');
  await expect(format).toBeFocused();
  await format.click();
  await page.keyboard.press('Shift+Tab');
  await expect(start).toBeFocused();
});

test('home fits the desktop shell and keeps task-list scrolling inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?preview=design');
  const route = page.locator('[data-route="home"]');
  const taskSection = page.getByTestId('home-workspace').locator('[class*="primaryColumn"]').getByRole('region', { name: '할 일', exact: true });
  await expect.poll(() => route.evaluate((element) => element.getAnimations().length)).toBe(0);

  const routeMetrics = await route.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(routeMetrics.overflowY).toBe('hidden');
  expect(routeMetrics.scrollHeight).toBeLessThanOrEqual(routeMetrics.clientHeight);

  expect(await taskSection.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  await taskSection.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const lastTask = await taskSection.locator('[data-task-id]').last().boundingBox();
  const scrollerBounds = await taskSection.boundingBox();
  expect(lastTask?.y).toBeGreaterThanOrEqual((await route.boundingBox())!.y);
  expect((lastTask?.y ?? 0) + (lastTask?.height ?? 0)).toBeLessThanOrEqual(Math.min(routeMetrics.bottom, (scrollerBounds?.y ?? 0) + (scrollerBounds?.height ?? 0)));
});

test('compact home keeps a dense selected-day task list scrollable inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  const countdown: ProposedCalendarItem = {
    id: '10000000-0000-4000-8000-000000000001',
    kind: 'window',
    title: '수강신청',
    timing: { type: 'date', startDate: '2026-10-07', endDate: '2026-10-09', timeZone: 'Asia/Seoul' },
    completion: 'pending',
    checklist: [],
    startCountdown: { enabled: true, daysBefore: 1 },
  };
  const tasks: ProposedCalendarItem[] = Array.from({ length: 10 }, (_, index): ProposedCalendarItem => ({
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    kind: 'task',
    title: `10월 6일 할 일 ${index + 1}`,
    timing: { type: 'date', startDate: null, endDate: '2026-10-06', timeZone: 'Asia/Seoul' },
    completion: 'pending',
  }));
  await seedItems(page, [countdown, ...tasks]);

  const route = page.locator('[data-route="home"]');
  const taskSection = page.getByTestId('home-workspace').locator('[class*="primaryColumn"]').getByRole('region', { name: '할 일', exact: true });
  const rows = taskSection.locator('[data-task-id]');
  await expect(rows).toHaveCount(10);
  const routeMetrics = await route.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    bottom: element.getBoundingClientRect().bottom,
  }));
  expect(routeMetrics.scrollHeight).toBeLessThanOrEqual(routeMetrics.clientHeight);
  const taskMetrics = await taskSection.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(taskMetrics.scrollHeight).toBeGreaterThan(taskMetrics.clientHeight);
  await taskSection.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const taskBounds = await taskSection.boundingBox();
  const lastTask = await rows.last().boundingBox();
  expect(lastTask?.y).toBeGreaterThanOrEqual(taskBounds?.y ?? 0);
  expect((lastTask?.y ?? 0) + (lastTask?.height ?? 0)).toBeLessThanOrEqual((taskBounds?.y ?? 0) + (taskBounds?.height ?? 0));
});

test('opening quick add leaves the fixed route stationary and focuses its inline input', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const route = page.locator('[data-route="home"]');
  await expect.poll(() => route.evaluate((element) => element.getAnimations().length)).toBe(0);
  const before = await route.evaluate((element) => element.scrollTop);
  expect(before).toBe(0);
  await page.getByRole('button', { name: '할 일 추가', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '새 할 일 제목' })).toBeFocused();
  await expect.poll(() => route.evaluate((element) => element.scrollTop)).toBe(before);
});
