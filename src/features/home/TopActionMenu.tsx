'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import styles from './TopActionMenu.module.css';

type TopActionMenuProps = {
  onAddTask?: () => void;
  onAddEvent?: () => void;
  onManageCategories?: () => void;
  onSort?: () => void;
  placement?: 'home' | 'header';
};

export function TopActionMenu({ onAddTask, onAddEvent, onManageCategories, onSort, placement = 'home' }: TopActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  function chooseAction(action: () => void) {
    triggerRef.current?.focus();
    setOpen(false);
    action();
  }

  function moveMenuFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    if (buttons.length === 0) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div className={`${styles.root} ${placement === 'header' ? styles.headerRoot : ''}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={placement === 'header' ? '항목 추가' : '메뉴'}
        aria-haspopup="menu"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {placement === 'header'
          ? <span aria-hidden="true" className={styles.addIcon} />
          : <Image alt="" height={20} src="/design/figma-hamburger.svg" unoptimized width={20} />}
      </button>
      {open && (
        <div aria-label="항목 추가 및 정렬" className={styles.menu} onKeyDown={moveMenuFocus} ref={menuRef} role="menu">
          {onAddTask && (
            <button className={styles.item} onClick={() => chooseAction(onAddTask)} role="menuitem" type="button">
              <strong>새 할 일</strong>
            </button>
          )}
          {onAddEvent && (
            <button className={styles.item} onClick={() => chooseAction(onAddEvent)} role="menuitem" type="button">
              <strong>새 일정</strong>
            </button>
          )}
          {onSort && (
            <button className={styles.item} onClick={() => chooseAction(onSort)} role="menuitem" type="button">
              <strong>디데이 정렬</strong>
            </button>
          )}
          {onManageCategories && (
            <button className={styles.item} onClick={() => chooseAction(onManageCategories)} role="menuitem" type="button">
              <strong>카테고리 설정</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
