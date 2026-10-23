import { TASK_CATEGORY_PALETTE } from './task-categories';

export const COLOR_THEMES = [
  {
    id: 'sage',
    name: '세이지',
    accent: '#346753',
    colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color),
  },
  { id: 'arctic', name: '아크틱', accent: '#2C698D', colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color) },
  { id: 'rose', name: '로즈', accent: '#8F5A73', colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color) },
  { id: 'amber', name: '앰버', accent: '#9D6700', colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color) },
  {
    id: 'apple-blue',
    name: 'Apple Blue',
    accent: '#0066CC',
    colors: TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => entry.color),
  },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

const LEGACY_THEME_IDS: Readonly<Record<string, ColorThemeId>> = {
  'sea-glass': 'sage',
  'sage-studio': 'sage',
  'mint-condition': 'sage',
  'deep-sea': 'arctic',
  matcha: 'sage',
  'ink-gold': 'amber',
  nordic: 'arctic',
  'rose-quartz': 'rose',
  'terracotta-field': 'rose',
  timeline: 'sage',
};

export function parseColorTheme(value: unknown): ColorThemeId | null {
  if (typeof value !== 'string') return null;
  if (value === 'apple-blue' || value === 'sage' || value === 'arctic' || value === 'rose' || value === 'amber') return value;
  const legacy = LEGACY_THEME_IDS[value];
  if (legacy) return legacy;
  return COLOR_THEMES.find((theme) => theme.id === value)?.id ?? null;
}

export function getColorTheme(themeId: ColorThemeId) {
  return COLOR_THEMES.find((theme) => theme.id === themeId) ?? COLOR_THEMES[0];
}
