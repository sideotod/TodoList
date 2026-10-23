'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ItemView } from '../../domain/items';
import { Icon } from '../ui/Icon';
import styles from './GlobalSearch.module.css';

type GlobalSearchProps = {
  items: readonly ItemView[];
  onClose: () => void;
  onOpen: (item: ItemView) => void;
};

export function GlobalSearch({ items, onClose, onOpen }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ko-KR');
    return items
      .filter((item) => !item.canonical || item.canonical.deletedAt === null)
      .filter((item) => !normalized || [item.display.title, item.display.category, item.display.notes].some((value) => value?.toLocaleLowerCase('ko-KR').includes(normalized)))
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((current) => Math.min(matches.length - 1, current + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
    if (event.key === 'Enter' && matches[activeIndex]) { event.preventDefault(); onOpen(matches[activeIndex]); }
  }

  return (
    <div className={styles.scrim} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-label="일정 검색" aria-modal="true" className={styles.panel} role="dialog">
        <div className={styles.searchBox}><Icon name="search" size={19} /><input aria-label="일정 검색" onChange={(event) => { setQuery(event.currentTarget.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="할 일, 일정, 기간 검색" ref={inputRef} value={query} /><kbd>ESC</kbd></div>
        <div className={styles.results}>
          {matches.length > 0 ? matches.map((item, index) => (
            <button aria-current={index === activeIndex ? 'true' : undefined} className={styles.result} key={item.display.id} onClick={() => onOpen(item)} onMouseEnter={() => setActiveIndex(index)} type="button">
              <span aria-hidden="true" className={`${styles.kind} ${styles[`kind_${item.display.kind}`]}`} />
              <span className={styles.resultCopy}><strong>{item.display.title}</strong><small>{item.display.category || kindLabel(item)}{item.display.notes ? ` · ${item.display.notes}` : ''}</small></span>
              {item.display.kind === 'task' && <small className={styles.state}>{item.display.completion === 'completed' ? '완료' : '할 일'}</small>}
            </button>
          )) : <p className={styles.empty}>{query.trim() ? '검색 결과가 없습니다.' : '검색할 제목이나 카테고리를 입력하세요.'}</p>}
        </div>
      </section>
    </div>
  );
}

function kindLabel(item: ItemView): string {
  switch (item.display.kind) {
    case 'task': return '할 일';
    case 'event': return '일정';
    case 'deadline': return '마감';
    case 'window': return '진행 기간';
  }
}
