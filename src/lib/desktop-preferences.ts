'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { isValidTimeZone } from '../domain/time';
import { normalizeTaskCategories } from '../domain/task-categories';
import type { TaskCategory } from '../domain/task-categories';
import { parseColorTheme, type ColorThemeId } from '../domain/color-themes';

export type DesktopPreferences = {
  weekStartsOn: 0 | 1;
  timeFormat: '24h' | '12h';
  timeZone: string;
  colorTheme: ColorThemeId;
  taskCategories: TaskCategory[];
};

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  weekStartsOn: 0,
  timeFormat: '24h',
  timeZone: 'Asia/Seoul',
  colorTheme: 'apple-blue',
  taskCategories: [],
};

const STORAGE_KEY = 'todolist:desktop-preferences:v1';
const CHANGE_EVENT = 'todolist:desktop-preferences-change';

export function useDesktopPreferences(): DesktopPreferences {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => readDesktopPreferences(snapshot), [snapshot]);
}

export function readDesktopPreferences(snapshot = getSnapshot()): DesktopPreferences {
  if (!snapshot) return DEFAULT_DESKTOP_PREFERENCES;
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.preferences)) return DEFAULT_DESKTOP_PREFERENCES;
    const preferences = value.preferences;
    const weekStartsOn = preferences.weekStartsOn === 1 ? 1 : preferences.weekStartsOn === 0 ? 0 : DEFAULT_DESKTOP_PREFERENCES.weekStartsOn;
    const timeFormat = preferences.timeFormat === '12h' ? '12h' : preferences.timeFormat === '24h' ? '24h' : DEFAULT_DESKTOP_PREFERENCES.timeFormat;
    const timeZone = typeof preferences.timeZone === 'string' && isValidTimeZone(preferences.timeZone)
      ? preferences.timeZone
      : DEFAULT_DESKTOP_PREFERENCES.timeZone;
    const colorTheme = parseColorTheme(preferences.colorTheme) ?? DEFAULT_DESKTOP_PREFERENCES.colorTheme;
    return {
      weekStartsOn,
      timeFormat,
      timeZone,
      colorTheme,
      taskCategories: normalizeTaskCategories(preferences.taskCategories),
    };
  } catch {
    return DEFAULT_DESKTOP_PREFERENCES;
  }
}

export function saveDesktopPreferences(preferences: DesktopPreferences): void {
  if (preferences.weekStartsOn !== 0 && preferences.weekStartsOn !== 1) throw new RangeError('주 시작일은 일요일 또는 월요일이어야 합니다.');
  if (preferences.timeFormat !== '12h' && preferences.timeFormat !== '24h') throw new RangeError('시간 표시는 12시간제 또는 24시간제여야 합니다.');
  if (!isValidTimeZone(preferences.timeZone)) throw new RangeError('유효한 IANA 시간대가 필요합니다.');
  if (parseColorTheme(preferences.colorTheme) !== preferences.colorTheme) {
    throw new RangeError('지원하는 색상 조합을 선택해 주세요.');
  }
  if (!Array.isArray(preferences.taskCategories) || normalizeTaskCategories(preferences.taskCategories).length !== preferences.taskCategories.length) {
    throw new RangeError('카테고리 이름과 색상을 확인해 주세요.');
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, preferences }));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null {
  return null;
}
