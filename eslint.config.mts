import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/supabase-js', '@supabase/**'],
              message: 'Use the repository/auth boundary instead of importing Supabase directly.',
            },
            {
              group: [
                '@/lib/storage',
                '@/lib/storage/**',
                '**/lib/storage',
                '**/lib/storage/**',
              ],
              message: 'Use src/lib/repository.ts instead of internal storage modules.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),
]);
