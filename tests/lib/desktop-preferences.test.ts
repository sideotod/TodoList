import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP_PREFERENCES, readDesktopPreferences } from '../../src/lib/desktop-preferences';

describe('desktop color theme preference', () => {
  it('defaults older settings to the Arctic palette', () => {
    const legacy = { ...DEFAULT_DESKTOP_PREFERENCES };
    delete (legacy as Partial<typeof legacy>).colorTheme;
    const snapshot = JSON.stringify({ version: 1, preferences: legacy });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe('arctic');
  });

  it.each(['arctic', 'sea-glass', 'sage-studio', 'mint-condition', 'deep-sea', 'matcha', 'ink-gold', 'nordic', 'rose-quartz', 'terracotta-field'] as const)('restores the %s palette', (colorTheme) => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe(colorTheme);
  });

  it.each([
    ['timeline', 'deep-sea'],
    ['amber', 'matcha'],
    ['sage', 'sage-studio'],
  ] as const)('migrates the legacy %s palette to %s', (legacyTheme, theme) => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme: legacyTheme } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe(theme);
  });

  it('falls back to Arctic when the saved palette value is invalid', () => {
    const snapshot = JSON.stringify({ version: 1, preferences: { ...DEFAULT_DESKTOP_PREFERENCES, colorTheme: 'violet' } });

    expect(readDesktopPreferences(snapshot).colorTheme).toBe('arctic');
  });

  it('defaults older preference records to an empty custom category list', () => {
    const { taskCategories: _categories, ...legacyPreferences } = DEFAULT_DESKTOP_PREFERENCES;
    void _categories;
    const snapshot = JSON.stringify({ version: 1, preferences: legacyPreferences });

    expect(readDesktopPreferences(snapshot).taskCategories).toEqual([]);
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
