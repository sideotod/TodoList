import { TASK_CATEGORY_PALETTE } from './task-categories';

export const COLOR_THEMES = [
  {
    id: 'apple-blue',
    name: 'Apple Blue',
    accent: '#0066CC',
    colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color),
  },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

const LEGACY_THEME_IDS: Readonly<Record<string, ColorThemeId>> = {
  arctic: 'apple-blue',
  'sea-glass': 'apple-blue',
  'sage-studio': 'apple-blue',
  'mint-condition': 'apple-blue',
  'deep-sea': 'apple-blue',
  matcha: 'apple-blue',
  'ink-gold': 'apple-blue',
  nordic: 'apple-blue',
  'rose-quartz': 'apple-blue',
  'terracotta-field': 'apple-blue',
  timeline: 'apple-blue',
  amber: 'apple-blue',
  sage: 'apple-blue',
};

export function parseColorTheme(value: unknown): ColorThemeId | null {
  if (typeof value !== 'string') return null;
  if (value === 'apple-blue') return 'apple-blue';
  const legacy = LEGACY_THEME_IDS[value];
  if (legacy) return legacy;
  return COLOR_THEMES.find((theme) => theme.id === value)?.id ?? null;
}

export function getColorTheme(themeId: ColorThemeId) {
  return COLOR_THEMES.find((theme) => theme.id === themeId) ?? COLOR_THEMES[0];
}
