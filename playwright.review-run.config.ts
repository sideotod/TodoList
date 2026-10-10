import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'item-editor-preview.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3010',
    viewport: { width: 1000, height: 780 },
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    serviceWorkers: 'block',
    channel: 'chrome',
    screenshot: 'only-on-failure',
  },
});
