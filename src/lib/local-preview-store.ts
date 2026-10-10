'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { ItemView, ProposedCalendarItem } from '../domain/items';
import { validateProposedItem } from '../domain/validation';

const STORAGE_KEY = 'todolist:desktop-preview:v2';
const LEGACY_STORAGE_KEY = 'todolist:desktop-preview:v1';
const CHANGE_EVENT = 'todolist:desktop-preview-change';
const LEGACY_DEFAULT_DATE = '2026-10-03';

export type ReminderOffset = 0 | 10 | 30 | 60 | 1440;
export type LocalTaskOrder = { pending: string[]; completed: string[] };
export type LocalPreviewState = {
  items: ItemView[];
  taskOrders: Record<string, LocalTaskOrder>;
  reminderOffsets: Record<string, ReminderOffset>;
  remindersEnabled: boolean;
};

type StoredPreview = {
  version: 2;
  items: ProposedCalendarItem[];
  taskOrders: Record<string, LocalTaskOrder>;
  reminderOffsets: Record<string, ReminderOffset>;
  remindersEnabled: boolean;
};

export function useLocalPreviewState(fallback: readonly ItemView[]): LocalPreviewState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => readLocalPreviewState(fallback, snapshot), [fallback, snapshot]);
}

export function readLocalPreviewState(fallback: readonly ItemView[], snapshot = getSnapshot()): LocalPreviewState {
  const stored = parseStored(snapshot);
  if (stored) return toState(stored);
  const legacy = parseLegacy(getLegacySnapshot(), fallback);
  if (legacy) return toState(legacy);
  return toState({
    version: 2,
    items: fallback.map((item) => item.display),
    taskOrders: {},
    reminderOffsets: {},
    remindersEnabled: false,
  });
}

export function updateLocalPreviewState(
  fallback: readonly ItemView[],
  update: (current: LocalPreviewState) => LocalPreviewState,
): void {
  const next = update(readLocalPreviewState(fallback));
  const record: StoredPreview = {
    version: 2,
    items: next.items.map((item) => item.display),
    taskOrders: next.taskOrders,
    reminderOffsets: next.reminderOffsets,
    remindersEnabled: next.remindersEnabled,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function resetLocalPreviewState(fallback: readonly ItemView[]): void {
  updateLocalPreviewState(fallback, () => ({
    items: fallback.map((item) => toLocalView(item.display)),
    taskOrders: {},
    reminderOffsets: {},
    remindersEnabled: false,
  }));
}

export function toLocalView(display: ProposedCalendarItem): ItemView {
  return {
    display,
    canonical: null,
    localDraft: null,
    syncState: 'offline-draft',
    snapshotSource: 'none',
    localSequence: null,
  };
}

function toState(record: StoredPreview): LocalPreviewState {
  return {
    items: record.items.map(toLocalView),
    taskOrders: record.taskOrders,
    reminderOffsets: record.reminderOffsets,
    remindersEnabled: record.remindersEnabled,
  };
}

function parseStored(raw: string | null): StoredPreview | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.items)) return null;
    const items: ProposedCalendarItem[] = [];
    const seen = new Set<string>();
    for (const candidate of value.items) {
      if (!isRecord(candidate)) continue;
      const result = validateProposedItem(candidate);
      if (!result.valid || seen.has(result.value.id)) continue;
      seen.add(result.value.id);
      items.push(result.value);
    }
    const taskOrders = parseTaskOrders(value.taskOrders);
    const reminderOffsets = parseReminderOffsets(value.reminderOffsets, seen);
    return {
      version: 2,
      items,
      taskOrders,
      reminderOffsets,
      remindersEnabled: value.remindersEnabled === true,
    };
  } catch {
    return null;
  }
}

function parseLegacy(raw: string | null, fallback: readonly ItemView[]): StoredPreview | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const taskIds = new Set(fallback.filter((item) => item.display.kind === 'task').map((item) => item.display.id));
    const completedIds = Array.isArray(value.completedIds)
      ? value.completedIds.filter((id): id is string => typeof id === 'string' && taskIds.has(id))
      : [];
    const completed = new Set(completedIds);
    const items = fallback.map((item) => {
      if (item.display.kind !== 'task') return item.display;
      return { ...item.display, completion: completed.has(item.display.id) ? 'completed' as const : item.display.completion };
    });
    const pending = normalizeIds(value.pending, taskIds);
    const orderedCompleted = normalizeIds(value.completed, taskIds);
    const firstDatedTask = fallback.find((item) => item.display.kind === 'task' && item.display.timing.type === 'date');
    const orderDate = firstDatedTask?.display.kind === 'task' && firstDatedTask.display.timing.type === 'date'
      ? firstDatedTask.display.timing.endDate
      : LEGACY_DEFAULT_DATE;
    return {
      version: 2,
      items,
      taskOrders: pending || orderedCompleted ? {
        [orderDate]: { pending: pending ?? [], completed: orderedCompleted ?? [] },
      } : {},
      reminderOffsets: {},
      remindersEnabled: false,
    };
  } catch {
    return null;
  }
}

function parseTaskOrders(value: unknown): Record<string, LocalTaskOrder> {
  if (!isRecord(value)) return {};
  const result: Record<string, LocalTaskOrder> = {};
  for (const [date, entry] of Object.entries(value)) {
    if ((date !== 'undated' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) || !isRecord(entry)) continue;
    result[date] = {
      pending: normalizeStringArray(entry.pending),
      completed: normalizeStringArray(entry.completed),
    };
  }
  return result;
}

function parseReminderOffsets(value: unknown, validIds: ReadonlySet<string>): Record<string, ReminderOffset> {
  if (!isRecord(value)) return {};
  const result: Record<string, ReminderOffset> = {};
  for (const [id, offset] of Object.entries(value)) {
    if (validIds.has(id) && isReminderOffset(offset)) result[id] = offset;
  }
  return result;
}

function isReminderOffset(value: unknown): value is ReminderOffset {
  return value === 0 || value === 10 || value === 30 || value === 60 || value === 1440;
}

function normalizeIds(value: unknown, allowed: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return null;
  return [...new Set(value.filter((entry): entry is string => allowed.has(entry)))];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))];
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

function getLegacySnapshot(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null {
  return null;
}
