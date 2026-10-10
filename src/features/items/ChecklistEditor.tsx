'use client';

import { useState, type KeyboardEvent } from 'react';
import type { PeriodChecklistItem } from '../../domain/items';
import { MAX_CHECKLIST_ITEMS } from '../../domain/validation';
import styles from './ChecklistEditor.module.css';

export function ChecklistEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly PeriodChecklistItem[];
  onChange: (next: PeriodChecklistItem[]) => void;
  disabled?: boolean;
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

  return (
    <section className={styles.section} aria-labelledby="checklist-title">
      <h3 id="checklist-title">기간 중 할 일</h3>
      {value.length === 0 ? <p className={styles.empty}>아직 등록된 하위 할 일이 없습니다.</p> : (
        <ul className={styles.list}>
          {value.map((item) => (
            <li className={styles.row} key={item.id}>
              <input
                aria-label={`${item.title} 완료`}
                checked={item.completed}
                className={styles.checkbox}
                disabled={disabled}
                onChange={(event) => update(item.id, { completed: event.currentTarget.checked })}
                type="checkbox"
              />
              <input
                aria-label="하위 할 일 이름"
                className={`${styles.title} ${item.completed ? styles.done : ''}`}
                disabled={disabled}
                maxLength={200}
                onChange={(event) => update(item.id, { title: event.currentTarget.value })}
                value={item.title}
              />
              <button
                aria-label={`${item.title} 삭제`}
                className={styles.remove}
                disabled={disabled}
                onClick={() => remove(item.id)}
                type="button"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
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
