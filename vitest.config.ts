import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/domain/**/*.test.ts', 'tests/lib/**/*.test.ts', 'tests/storage/**/*.test.ts', 'tests/pwa/**/*.test.ts', 'tests/features/**/*.test.ts'],
    environment: 'node',
  },
});
