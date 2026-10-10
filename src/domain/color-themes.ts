export const COLOR_THEMES = [
  { id: 'arctic', name: 'Arctic', accent: '#2C698D', colors: ['#E3F6F5', '#BAE8E8', '#2C698D', '#272643'] },
  { id: 'sea-glass', name: 'Sea Glass', accent: '#5C6B73', colors: ['#E0FBFC', '#C2DFE3', '#9DB4C0', '#5C6B73'] },
  { id: 'sage-studio', name: 'Sage Studio', accent: '#52796F', colors: ['#CAD2C5', '#84A98C', '#52796F', '#354F52'] },
  { id: 'mint-condition', name: 'Mint Condition', accent: '#457B9D', colors: ['#F1FAEE', '#A8DADC', '#457B9D', '#1D3557'] },
  { id: 'deep-sea', name: 'Deep Sea', accent: '#2C6975', colors: ['#06202A', '#1B3B4B', '#2C6975', '#68B2A0'] },
  { id: 'matcha', name: 'Matcha', accent: '#588157', colors: ['#DAD7CD', '#A3B18A', '#588157', '#3A5A40'] },
  { id: 'ink-gold', name: 'Ink & Gold', accent: '#373F51', colors: ['#1B1B1E', '#373F51', '#A9927D', '#F2D398'] },
  { id: 'nordic', name: 'Nordic', accent: '#4C566A', colors: ['#2E3440', '#4C566A', '#D8DEE9', '#ECEFF4'] },
  { id: 'rose-quartz', name: 'Rose Quartz', accent: '#8F5A73', colors: ['#F7EDF0', '#E4B5C4', '#C98CA7', '#8F5A73'] },
  { id: 'terracotta-field', name: 'Terracotta Field', accent: '#3D405B', colors: ['#E07A5F', '#F2CC8F', '#81B29A', '#3D405B'] },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

const LEGACY_THEME_IDS: Readonly<Record<string, ColorThemeId>> = {
  timeline: 'deep-sea',
  amber: 'matcha',
  sage: 'sage-studio',
};

export function parseColorTheme(value: unknown): ColorThemeId | null {
  if (typeof value !== 'string') return null;
  const legacy = LEGACY_THEME_IDS[value];
  if (legacy) return legacy;
  return COLOR_THEMES.find((theme) => theme.id === value)?.id ?? null;
}

export function getColorTheme(themeId: ColorThemeId) {
  return COLOR_THEMES.find((theme) => theme.id === themeId) ?? COLOR_THEMES[0];
}
