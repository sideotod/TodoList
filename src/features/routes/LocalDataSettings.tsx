'use client';

import { useState } from 'react';
import type { ItemView, ProposedCalendarItem } from '../../domain/items';
import { isValidTimeZone } from '../../domain/time';
import { normalizeTaskCategories } from '../../domain/task-categories';
import { parseColorTheme } from '../../domain/color-themes';
import { validateProposedItem } from '../../domain/validation';
import type { DesktopPreferences } from '../../lib/desktop-preferences';
import { DEFAULT_DESKTOP_PREFERENCES, saveDesktopPreferences } from '../../lib/desktop-preferences';
import type { LocalPreviewState } from '../../lib/local-preview-store';
import { resetLocalPreviewState, toLocalView, updateLocalPreviewState } from '../../lib/local-preview-store';
import styles from './LocalDataSettings.module.css';

type BackupDraft = {
  items: ProposedCalendarItem[];
  taskOrders: LocalPreviewState['taskOrders'];
  reminderOffsets: LocalPreviewState['reminderOffsets'];
  remindersEnabled: boolean;
  preferences: DesktopPreferences;
};

export function LocalDataSettings({ fallback, state, preferences }: { fallback: readonly ItemView[]; state: LocalPreviewState; preferences: DesktopPreferences }) {
  const [candidate, setCandidate] = useState<BackupDraft | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function exportBackup() {
    setError('');
    try {
      const data = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        items: state.items.map((item) => item.display),
        taskOrders: state.taskOrders,
        reminderOffsets: state.reminderOffsets,
        remindersEnabled: state.remindersEnabled,
        preferences,
      };
      downloadJson(data, 'haru-local-backup.json');
      setMessage('이 브라우저의 일정과 설정을 JSON 파일로 내보냈습니다.');
    } catch {
      setError('백업 파일을 만들지 못했습니다.');
    }
  }

  async function readBackup(file: File | undefined) {
    setError('');
    setMessage('');
    setCandidate(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('백업 파일은 최대 5 MiB까지 사용할 수 있습니다.');
      return;
    }
    try {
      setCandidate(parseBackup(JSON.parse(await file.text())));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '올바른 백업 파일이 아닙니다.');
    }
  }

  function restore() {
    if (!candidate) return;
    const confirmed = window.confirm(`현재 브라우저의 항목을 백업의 ${candidate.items.length}개 항목으로 바꿀까요? 이 작업은 되돌릴 수 없으니 먼저 현재 데이터를 내보내는 것을 권장합니다.`);
    if (!confirmed) return;
    try {
      updateLocalPreviewState(fallback, () => ({
        items: candidate.items.map(toLocalView),
        taskOrders: candidate.taskOrders,
        reminderOffsets: candidate.reminderOffsets,
        remindersEnabled: candidate.remindersEnabled,
      }));
      saveDesktopPreferences(candidate.preferences);
      setCandidate(null);
      setMessage('백업의 일정과 설정을 이 브라우저에 복원했습니다.');
    } catch {
      setError('기기 저장을 완료하지 못했습니다. 현재 자료를 다시 확인해 주세요.');
    }
  }

  function resetPreview() {
    if (!window.confirm('샘플 일정과 기본 설정으로 되돌릴까요?')) return;
    try {
      resetLocalPreviewState(fallback);
      saveDesktopPreferences(DEFAULT_DESKTOP_PREFERENCES);
      setCandidate(null);
      setMessage('샘플 일정과 기본 설정으로 되돌렸습니다.');
    } catch {
      setError('기본 상태로 되돌리지 못했습니다.');
    }
  }

  return (
    <section className={styles.section} aria-label="로컬 데이터 관리">
      <p>백업 파일은 이 기기의 데이터를 포함합니다. 복원은 현재 브라우저 항목을 대체하며 자동 동기화하지 않습니다.</p>
      <div className={styles.actions}>
        <button onClick={exportBackup} type="button">JSON 백업 내보내기</button>
        <label className={styles.fileButton}>백업 복원 파일 선택<input accept="application/json,.json" onChange={(event) => { void readBackup(event.currentTarget.files?.[0]); }} type="file" /></label>
        <button className={styles.subtle} onClick={resetPreview} type="button">샘플로 초기화</button>
      </div>
      {candidate && (
        <div className={styles.restoreSummary}>
          <strong>복원 미리보기</strong>
          <span>{candidate.items.length}개 항목 · 알림 {candidate.remindersEnabled ? '켜짐' : '꺼짐'} · 시간대 {candidate.preferences.timeZone}</span>
          <button onClick={restore} type="button">이 백업으로 복원</button>
        </div>
      )}
      {message && <p className={styles.status} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

function parseBackup(input: unknown): BackupDraft {
  if (!isRecord(input) || input.schemaVersion !== 1 || !Array.isArray(input.items)) throw new Error('지원하지 않는 백업 형식입니다.');
  const items: ProposedCalendarItem[] = [];
  const ids = new Set<string>();
  for (const raw of input.items) {
    const result = validateProposedItem(raw);
    if (!result.valid || ids.has(result.value.id)) throw new Error('백업에 잘못되었거나 중복된 일정이 있습니다.');
    ids.add(result.value.id);
    items.push(result.value);
  }
  const preferences = parsePreferences(input.preferences);
  const taskOrders = parseTaskOrders(input.taskOrders, ids);
  const reminderOffsets = parseReminderOffsets(input.reminderOffsets, ids);
  return {
    items,
    taskOrders,
    reminderOffsets,
    remindersEnabled: input.remindersEnabled === true,
    preferences,
  };
}

function parsePreferences(value: unknown): DesktopPreferences {
  if (!isRecord(value) || (value.weekStartsOn !== 0 && value.weekStartsOn !== 1) || (value.timeFormat !== '12h' && value.timeFormat !== '24h') ||
      typeof value.timeZone !== 'string' || !isValidTimeZone(value.timeZone)) {
    throw new Error('백업의 캘린더 설정을 확인할 수 없습니다.');
  }
  return {
    weekStartsOn: value.weekStartsOn,
    timeFormat: value.timeFormat,
    timeZone: value.timeZone,
    colorTheme: parseColorTheme(value.colorTheme) ?? DEFAULT_DESKTOP_PREFERENCES.colorTheme,
    taskCategories: normalizeTaskCategories(value.taskCategories),
    calendarVisibility: isRecord(value.calendarVisibility) ? {
      tasks: typeof value.calendarVisibility.tasks === 'boolean' ? value.calendarVisibility.tasks : true,
      events: typeof value.calendarVisibility.events === 'boolean' ? value.calendarVisibility.events : true,
      progress: typeof value.calendarVisibility.progress === 'boolean' ? value.calendarVisibility.progress : true,
    } : DEFAULT_DESKTOP_PREFERENCES.calendarVisibility,
  };
}

function parseTaskOrders(value: unknown, itemIds: ReadonlySet<string>): LocalPreviewState['taskOrders'] {
  if (!isRecord(value)) return {};
  const result: LocalPreviewState['taskOrders'] = {};
  for (const [date, entry] of Object.entries(value)) {
    if ((date !== 'undated' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) || !isRecord(entry)) continue;
    const pending = normalizeIds(entry.pending, itemIds);
    const completed = normalizeIds(entry.completed, itemIds);
    if (pending && completed) result[date] = { pending, completed };
  }
  return result;
}

function parseReminderOffsets(value: unknown, itemIds: ReadonlySet<string>): LocalPreviewState['reminderOffsets'] {
  if (!isRecord(value)) return {};
  const result: LocalPreviewState['reminderOffsets'] = {};
  for (const [id, offset] of Object.entries(value)) {
    if (itemIds.has(id) && (offset === 0 || offset === 10 || offset === 60 || offset === 1440)) result[id] = offset;
  }
  return result;
}

function normalizeIds(value: unknown, itemIds: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) return null;
  return [...new Set(value.filter((id): id is string => itemIds.has(id)))];
}

function downloadJson(value: unknown, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
