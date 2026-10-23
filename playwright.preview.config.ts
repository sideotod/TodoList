import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

const useInstalledChrome = !existsSync(chromium.executablePath())
  && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 3010);
const validPreviewPort = Number.isInteger(previewPort) && previewPort > 0 && previewPort <= 65535 ? previewPort : 3010;
const previewUrl = `http://127.0.0.1:${validPreviewPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['item-editor-preview.spec.ts', 'week-all-day-lane.spec.ts', 'phase4-calendar-navigation.spec.ts', 'macos-v4-visual.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: previewUrl,
    viewport: { width: 1000, height: 780 },
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    serviceWorkers: 'block',
    ...(useInstalledChrome ? { channel: 'chrome' } : {}),
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec next dev --webpack --hostname 127.0.0.1 --port ${validPreviewPort}`,
    url: `${previewUrl}/?preview=design`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
