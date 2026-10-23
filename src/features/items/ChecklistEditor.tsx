'use client';

import { useState, type KeyboardEvent } from 'react';
import type { PeriodChecklistItem } from '../../domain/items';
import type { ItemView } from '../../domain/items';
import { isItemDeleted } from '../../domain/projections';
import { MAX_CHECKLIST_ITEMS } from '../../domain/validation';
import styles from './ChecklistEditor.module.css';

export function ChecklistEditor({
  value,
  onChange,
  disabled = false,
  showHeading = true,
  availableTasks = [],
  onToggleLinkedTask,
}: {
  value: readonly PeriodChecklistItem[];
  onChange: (next: PeriodChecklistItem[]) => void;
  disabled?: boolean;
  showHeading?: boolean;
  availableTasks?: readonly ItemView[];
  onToggleLinkedTask?: (taskId: string, completed: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  function add() {
    const title = draft.trim();
    if (!title || disabled) return;
    if (value.length >= MAX_CHECKLIST_ITEMS) {
      setError(`기간 중 할 일은 최대 ${MAX_CHECKLIST_ITEMS}개까지 추가할 수 있습니다. 입력한 내용은 남아 있습니다.`);
      return;
    }
    setError('');
    onChange([...value, { id: createId(), title, completed: false }]);
    setDraft('');
  }

  function update(itemId: string, patch: Partial<PeriodChecklistItem>) {
    onChange(value.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  }

  function remove(itemId: string) {
    onChange(value.filter((item) => item.id !== itemId));
  }

  function chooseLinkedTask(item: PeriodChecklistItem, taskId: string) {
    const linkedTask = availableTasks.find((task) => task.display.id === taskId && task.display.kind === 'task');
    if (!taskId || !linkedTask || linkedTask.display.kind !== 'task') {
      const currentTask = item.linkedTaskId ? availableTasks.find((task) => task.display.id === item.linkedTaskId && task.display.kind === 'task') : null;
      const { linkedTaskId: removedId, ...unlinked } = item;
      void removedId;
      onChange(value.map((entry) => entry.id === item.id ? { ...unlinked, title: currentTask?.display.kind === 'task' ? currentTask.display.title : item.title, completed: currentTask?.display.kind === 'task' ? currentTask.display.completion === 'completed' : item.completed } : entry));
      return;
    }
    update(item.id, { linkedTaskId: taskId, title: linkedTask.display.title, completed: linkedTask.display.completion === 'completed' });
  }

  async function toggleChecklistItem(item: PeriodChecklistItem, completed: boolean) {
    if (item.linkedTaskId) {
      if (!onToggleLinkedTask) return;
      try { await onToggleLinkedTask(item.linkedTaskId, completed); setError(''); }
      catch (failure) { setError(failure instanceof Error ? failure.message : '연결된 할 일을 수정하지 못했습니다.'); }
      return;
    }
    update(item.id, { completed });
  }

  return (
    <section className={styles.section} aria-label="기간 중 할 일">
      {showHeading && <h3>기간 중 할 일</h3>}
      {value.length === 0 ? <p className={styles.empty}>아직 등록된 하위 할 일이 없습니다.</p> : (
        <ul className={styles.list}>
          {value.map((item) => {
            const linkedTask = item.linkedTaskId ? availableTasks.find((task) => task.display.id === item.linkedTaskId && task.display.kind === 'task') : null;
            const linkedDisplay = linkedTask?.display.kind === 'task' ? linkedTask.display : null;
            return <li className={styles.row} key={item.id}>
              <input
                aria-label={item.title + ' 완료'}
                checked={linkedDisplay ? linkedDisplay.completion === 'completed' : item.completed}
                className={styles.checkbox}
                disabled={disabled || Boolean(item.linkedTaskId && !onToggleLinkedTask)}
                onChange={(event) => { void toggleChecklistItem(item, event.currentTarget.checked); }}
                type="checkbox"
              />
              <input
                aria-label="하위 할 일 이름"
                className={styles.title + ' ' + (linkedDisplay?.completion === 'completed' || item.completed ? styles.done : '')}
                disabled={disabled || Boolean(linkedDisplay)}
                maxLength={200}
                onChange={(event) => update(item.id, { title: event.currentTarget.value })}
                value={linkedDisplay?.title ?? item.title}
              />
              <select aria-label={item.title + ' 연결된 할 일'} className={styles.linkPicker} disabled={disabled} onChange={(event) => chooseLinkedTask(item, event.currentTarget.value)} value={item.linkedTaskId ?? ''}>
                <option value="">독립 항목</option>
                {item.linkedTaskId && !linkedDisplay && <option value={item.linkedTaskId}>삭제된 할 일 · 연결 해제</option>}
                {availableTasks.filter((task) => task.display.kind === 'task' && !isItemDeleted(task)).map((task) => task.display.kind === 'task' ? <option key={task.display.id} value={task.display.id}>{task.display.title}</option> : null)}
              </select>
              <button
                aria-label={item.title + ' 삭제'}
                className={styles.remove}
                disabled={disabled}
                onClick={() => remove(item.id)}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>;
          })}
        </ul>
      )}
      <div className={styles.addForm}>
        <input
          aria-label="하위 할 일 추가"
          className={styles.addInput}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => { setDraft(event.currentTarget.value); setError(''); }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder="하위 할 일 추가"
          value={draft}
        />
        <button className={styles.addButton} disabled={disabled || !draft.trim()} onClick={add} type="button">추가</button>
      </div>
      <p className={styles.count}>{value.length}/{MAX_CHECKLIST_ITEMS}개</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}

function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
