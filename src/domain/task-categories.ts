import type { ItemView } from './items';

export const TASK_CATEGORY_PALETTE = [
  { id: 'teal', label: '청록', color: '#0B756B', soft: '#DCEFED' },
  { id: 'amber', label: '앰버', color: '#8A5200', soft: '#F6E9D2' },
  { id: 'blue', label: '블루', color: '#435CA8', soft: '#E4E9F8' },
  { id: 'violet', label: '바이올렛', color: '#7054A6', soft: '#EEE8F8' },
  { id: 'coral', label: '코랄', color: '#A94643', soft: '#F7E6E4' },
  { id: 'sage', label: '세이지', color: '#4F6F52', soft: '#E6EDE5' },
] as const;

export const TASK_CATEGORY_EXTRA_COLORS = ['#2C698D', '#272643', '#5C6B73', '#52796F', '#457B9D', '#588157', '#8F5A73', '#3D405B', '#E4052C', '#9D6700', '#A9927D', '#68B2A0'] as const;

export type TaskCategoryColor = (typeof TASK_CATEGORY_PALETTE)[number]['id'] | `#${string}`;
export type TaskCategory = { name: string; color: TaskCategoryColor };
export const DEFAULT_TASK_CATEGORY: TaskCategory = { name: '기본', color: 'teal' };

export function normalizeTaskCategories(value: unknown): TaskCategory[] {
  if (!Array.isArray(value)) return [];
  const categories = new Map<string, TaskCategory>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    if (!('name' in entry) || !('color' in entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (name.length === 0 || name.length > 64 || !isTaskCategoryColor(entry.color)) continue;
    const key = name.toLocaleLowerCase('ko-KR');
    if (!categories.has(key)) categories.set(key, { name, color: normalizeColor(entry.color) });
  }
  return [...categories.values()];
}

export function isTaskCategoryColor(value: unknown): value is TaskCategoryColor {
  return TASK_CATEGORY_PALETTE.some((entry) => entry.id === value)
    || typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function getTaskCategoryColor(color: TaskCategoryColor | undefined) {
  const paletteColor = TASK_CATEGORY_PALETTE.find((entry) => entry.id === color);
  if (paletteColor) return paletteColor;
  if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) {
    const normalizedColor = color.toUpperCase();
    return { id: normalizedColor, label: '사용자 지정', color: normalizedColor, soft: mixWithWhite(normalizedColor, .14) };
  }
  return TASK_CATEGORY_PALETTE[0];
}

export function getTaskCategoryColorIndex(color: TaskCategoryColor | undefined): number {
  if (color === 'teal') return 0;
  if (color === 'amber') return 1;
  if (color === 'blue' || color === 'coral') return 2;
  if (color === 'violet' || color === 'sage') return 3;
  return 0;
}

export function getStableItemColor(id: string) {
  const paletteIndex = getStableItemColorIndex(id);
  const paletteColor = TASK_CATEGORY_PALETTE[paletteIndex];
  return {
    id: `category-${paletteIndex + 1}`,
    label: paletteColor.label,
    color: paletteColor.color,
    soft: paletteColor.soft,
  };
}

export function getStableItemCategoryColor(id: string): TaskCategoryColor {
  const index = getStableItemColorIndex(id);
  return TASK_CATEGORY_PALETTE[index]?.id ?? DEFAULT_TASK_CATEGORY.color;
}

function getStableItemColorIndex(id: string): number {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return Math.abs(hash >>> 0) % 4;
}

export function getTaskCategories(items: readonly ItemView[]): TaskCategory[] {
  const categories = new Map<string, TaskCategory>();
  for (const item of items) {
    if (item.display.kind !== 'task' || item.canonical?.deletedAt || item.localDraft?.mutationKind === 'delete') continue;
    const name = item.display.category?.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('ko-KR');
    if (!categories.has(key)) {
      categories.set(key, { name, color: isTaskCategoryColor(item.display.categoryColor) ? item.display.categoryColor : 'teal' });
    }
  }
  return [...categories.values()].sort((first, second) => first.name.localeCompare(second.name, 'ko'));
}

export function mergeTaskCategories(items: readonly ItemView[], configured: readonly TaskCategory[] = []): TaskCategory[] {
  const categories = new Map<string, TaskCategory>([[categoryKey(DEFAULT_TASK_CATEGORY.name), DEFAULT_TASK_CATEGORY]]);
  for (const category of normalizeTaskCategories(configured)) {
    const key = categoryKey(category.name);
    if (!categories.has(key)) categories.set(key, category);
  }
  for (const category of getTaskCategories(items)) {
    const key = categoryKey(category.name);
    if (!categories.has(key)) categories.set(key, category);
  }
  return [...categories.values()];
}

export function getCategoryColor(name: string | undefined, color: TaskCategoryColor | undefined, categories: readonly TaskCategory[] = []): TaskCategoryColor {
  if (isTaskCategoryColor(color)) return color;
  if (!name) return 'teal';
  const match = categories.find((category) => category.name.toLocaleLowerCase('ko-KR') === name.trim().toLocaleLowerCase('ko-KR'));
  return match?.color ?? 'teal';
}

function categoryKey(name: string): string {
  return name.trim().toLocaleLowerCase('ko-KR');
}

function normalizeColor(color: TaskCategoryColor): TaskCategoryColor {
  return color.startsWith('#') ? color.toUpperCase() as `#${string}` : color;
}

function mixWithWhite(color: string, weight: number): string {
  const channel = (start: number) => Math.round(start + (255 - start) * (1 - weight)).toString(16).padStart(2, '0');
  return `#${channel(Number.parseInt(color.slice(1, 3), 16))}${channel(Number.parseInt(color.slice(3, 5), 16))}${channel(Number.parseInt(color.slice(5, 7), 16))}`.toUpperCase();
}
