import { describe, expect, it } from 'vitest';
import { getTaskCategoryColor } from '../../src/domain/task-categories';
import { COLOR_THEMES } from '../../src/domain/color-themes';
import { DEFAULT_DESKTOP_PREFERENCES, readDesktopPreferences } from '../../src/lib/desktop-preferences';

describe('desktop color theme preference', () => {
  it('defaults older settings to the v4 Sage accent', () => {
    const legacy = { ...DEFAULT_DESKTOP_PREFERENCES };
    delete (legacy as Partial<typeof legacy>).colorTheme;
    const snapshot = JSON.stringify({ version: 1, preferences: legacy });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe('sage');
  });

  it.each([
    ['arctic', 'arctic'],
    ['sea-glass', 'sage'],
    ['sage-studio', 'sage'],
    ['mint-condition', 'sage'],
    ['deep-sea', 'arctic'],
    ['matcha', 'sage'],
    ['ink-gold', 'amber'],
    ['nordic', 'arctic'],
    ['rose-quartz', 'rose'],
    ['terracotta-field', 'rose'],
  ] as const)('maps the saved %s palette to the closest v4 accent', (colorTheme, expected) => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe(expected);
  });

  it('migrates only the interface accent and preserves other saved preferences and category colors', () => {
    const snapshot = JSON.stringify({ version: 1, preferences: {
      ...DEFAULT_DESKTOP_PREFERENCES,
      weekStartsOn: 1,
      timeFormat: '12h',
      timeZone: 'America/Los_Angeles',
      colorTheme: 'rose-quartz',
      taskCategories: [{ name: '연구', color: 'violet' }],
    } });
    const preferences = readDesktopPreferences(snapshot);

    expect(preferences).toMatchObject({
      weekStartsOn: 1,
      timeFormat: '12h',
      timeZone: 'America/Los_Angeles',
      colorTheme: 'rose',
      taskCategories: [{ name: '연구', color: 'violet' }],
    });
  });

  it.each([
    ['timeline', 'sage'],
    ['amber', 'amber'],
    ['sage', 'sage'],
  ] as const)('migrates the legacy %s palette to %s', (legacyTheme, theme) => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme: legacyTheme } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe(theme);
  });

  it('falls back to Sage when the saved palette value is invalid', () => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme: 'violet' } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe('sage');
  });

  it('exposes the v4 accent palette while keeping category colors independent', () => {
    expect(COLOR_THEMES.map(({ id, accent }) => [id, accent])).toEqual([
      ['sage', '#346753'],
      ['arctic', '#2C698D'],
      ['rose', '#8F5A73'],
      ['amber', '#9D6700'],
      ['apple-blue', '#0066CC'],
    ]);
    expect(getTaskCategoryColor('teal').color).toBe('#0B756B');
    expect(getTaskCategoryColor('amber').color).toBe('#8A5200');
  });

  it('defaults older preference records to an empty custom category list', () => {
    const { taskCategories: _categories, calendarVisibility: _visibility, ...legacyPreferences } = DEFAULT_DESKTOP_PREFERENCES;
    void _categories;
    void _visibility;
    const snapshot = JSON.stringify({ version: 1, preferences: legacyPreferences });

    expect(readDesktopPreferences(snapshot).taskCategories).toEqual([]);
  });

  it('defaults calendar visibility when restoring older saved preferences', () => {
    const { calendarVisibility: _visibility, ...legacyPreferences } = DEFAULT_DESKTOP_PREFERENCES;
    void _visibility;
    const snapshot = JSON.stringify({ version: 1, preferences: legacyPreferences });
    expect(readDesktopPreferences(snapshot).calendarVisibility).toEqual({ tasks: true, events: true, progress: true });
  });

  it('restores valid custom categories and filters malformed entries', () => {
    const snapshot = JSON.stringify({ version: 1, preferences: {
      ...DEFAULT_DESKTOP_PREFERENCES,
      taskCategories: [
        { name: '연구', color: 'violet' },
        { name: '연구', color: 'amber' },
        { name: ' ', color: 'teal' },
        { name: '수업', color: 'unknown' },
      ],
    } });

    expect(readDesktopPreferences(snapshot).taskCategories).toEqual([{ name: '연구', color: 'violet' }]);
  });
});

describe('fixed weekly calendar hours', () => {
  it('ignores saved hour ranges from older settings without exposing them as preferences', () => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, visibleStartHour: 6, visibleEndHour: 20 } });
    const preferences = readDesktopPreferences(snapshot);

    expect(preferences).not.toHaveProperty('visibleStartHour');
    expect(preferences).not.toHaveProperty('visibleEndHour');
  });
});
