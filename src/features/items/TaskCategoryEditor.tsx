'use client';

import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { getTaskCategoryColor, TASK_CATEGORY_EXTRA_COLORS, TASK_CATEGORY_PALETTE, type TaskCategory, type TaskCategoryColor } from '../../domain/task-categories';
import { DialogShell } from './DialogShell';
import styles from './TaskCategoryEditor.module.css';

type TaskCategoryEditorProps = {
  categories: readonly TaskCategory[];
  onClose: () => void;
  onSave: (category: TaskCategory) => boolean;
};

export function TaskCategoryEditor({ categories, onClose, onSave }: TaskCategoryEditorProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'settings' | 'add'>('settings');
  const [name, setName] = useState('');
  const [color, setColor] = useState<TaskCategoryColor>('teal');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [showExtraColors, setShowExtraColors] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      setError('카테고리 이름을 입력해 주세요.');
      return;
    }
    if (normalizedName.length > 64) {
      setError('카테고리 이름은 64자 이내로 입력해 주세요.');
      return;
    }
    if (categories.some((category) => category.name.toLocaleLowerCase('ko-KR') === normalizedName.toLocaleLowerCase('ko-KR'))) {
      setError('이미 있는 카테고리 이름입니다.');
      return;
    }
    if (onSave({ name: normalizedName, color })) {
      setName('');
      setDirty(false);
      setError('');
      setShowExtraColors(false);
      setView('settings');
    }
  }

  return (
    <DialogShell
      dirty={dirty}
      compact={view === 'settings'}
      footer={(requestClose) => view === 'settings' ? (
        <footer className={styles.footer}><button className={styles.cancel} onClick={requestClose} type="button">닫기</button></footer>
      ) : (
        <footer className={styles.footer}>
          <button className={styles.cancel} onClick={() => { setView('settings'); setName(''); setError(''); setDirty(false); }} type="button">목록</button>
          <button className={styles.save} type="submit">저장</button>
        </footer>
      )}
      initialFocusRef={nameRef}
      title={view === 'settings' ? '카테고리 설정' : '카테고리 추가'}
      titleLabel={view === 'settings' ? '카테고리 설정' : '카테고리 추가'}
      onChange={() => setDirty(true)}
      onClose={onClose}
      onSubmit={(event) => { if (view === 'add') save(event); else event.preventDefault(); }}
    >
      {view === 'settings' ? (
        <div aria-label="카테고리 목록" className={styles.categoryList}>
          {categories.map((category) => (
            <div className={styles.categoryRow} key={category.name}>
              <span aria-hidden="true" className={styles.categoryDot} style={{ '--category-color': getTaskCategoryColor(category.color).color } as CSSProperties} />
              <span>{category.name}</span>
            </div>
          ))}
          <button className={styles.addCategory} onClick={() => {
            setView('add');
            window.requestAnimationFrame(() => nameRef.current?.focus());
          }} type="button"><span aria-hidden="true">＋</span>카테고리 추가</button>
        </div>
      ) : (
        <>
          <label className={styles.field} htmlFor="task-category-name">
            <span>카테고리 이름</span>
            <input id="task-category-name" maxLength={64} onChange={(event) => { setName(event.currentTarget.value); setError(''); setDirty(true); }} ref={nameRef} value={name} />
          </label>
          <fieldset className={styles.palette}>
            <legend>색상</legend>
            {TASK_CATEGORY_PALETTE.slice(0, 4).map((entry) => (
              <button aria-label={`${entry.label} 색상`} aria-pressed={color === entry.id} className={styles.swatch} key={entry.id} onClick={() => { setColor(entry.id); setDirty(true); }} style={{ '--category-color': getTaskCategoryColor(entry.id).color } as CSSProperties} type="button"><span aria-hidden="true" /></button>
            ))}
            <button aria-controls="category-extra-colors" aria-expanded={showExtraColors} aria-label="직접 색상 선택" className={styles.customColor} onClick={() => setShowExtraColors((current) => !current)} type="button"><span aria-hidden="true" /></button>
          </fieldset>
          {showExtraColors && (
            <fieldset className={styles.extraPalette} id="category-extra-colors">
              <legend>추가 색상</legend>
              <div className={styles.extraColorGrid}>
                {TASK_CATEGORY_EXTRA_COLORS.map((entry) => (
                  <button aria-label={`${entry} 사용자 색상`} aria-pressed={color === entry} className={styles.extraSwatch} key={entry} onClick={() => { setColor(entry); setDirty(true); }} style={{ '--category-color': entry } as CSSProperties} type="button"><span aria-hidden="true" /></button>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </DialogShell>
  );
}
