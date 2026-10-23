'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEventHandler, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import styles from './ItemEditor.module.css';

type DialogShellProps = {
  title: ReactNode;
  titleLabel?: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode | ((requestClose: () => void) => ReactNode);
  dirty: boolean;
  compact?: boolean;
  wide?: boolean;
  busy?: boolean;
  initialFocusRef: RefObject<HTMLInputElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange: () => void;
};

export function DialogShell({ title, titleLabel, subtitle, children, footer, dirty, compact = false, wide = false, busy = false, initialFocusRef, returnFocusRef, onClose, onSubmit, onChange }: DialogShellProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const confirmRef = useRef<HTMLElement>(null);
  const [confirmationReturnFocus, setConfirmationReturnFocus] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocus = returnFocusRef?.current ?? activeElement;
    initialFocusRef.current?.focus();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [initialFocusRef, returnFocusRef]);

  useEffect(() => {
    if (!confirmDiscard) return;
    const firstButton = confirmRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    firstButton?.focus();
  }, [confirmDiscard]);

  function requestClose() {
    if (busy || confirmDiscard) return;
    if (dirty) {
      setConfirmationReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function closeConfirmation() {
    setConfirmDiscard(false);
    requestAnimationFrame(() => {
      if (confirmationReturnFocus?.isConnected) confirmationReturnFocus.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (confirmDiscard) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeConfirmation();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...(confirmRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = event.currentTarget.querySelector<HTMLElement>('[role="dialog"]');
    const controls = [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])]
      .filter((control) => control.tabIndex >= 0
        && !control.closest('[inert]')
        && getComputedStyle(control).visibility !== 'hidden'
        && control.getClientRects().length > 0);
    const activePortalDropdown = document.querySelector<HTMLElement>('[data-menu-portal="true"][data-open="true"]');
    if (activePortalDropdown?.contains(document.activeElement)) {
      event.preventDefault();
      const trigger = activePortalDropdown.querySelector<HTMLElement>('[role="combobox"]');
      const triggerIndex = trigger ? controls.indexOf(trigger) : -1;
      const nextIndex = triggerIndex + (event.shiftKey ? -1 : 1);
      controls[(nextIndex + controls.length) % controls.length]?.focus();
      return;
    }
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section aria-busy={busy} aria-labelledby="item-editor-title" aria-modal="true" className={`${styles.dialog} ${compact ? styles.dialogCompact : ''} ${wide ? styles.dialogWide : ''}`} data-dirty={dirty} inert={confirmDiscard} onChange={onChange} role="dialog">
        <form noValidate onSubmit={onSubmit}>
          <header className={styles.header}>
            <div>
              <h2 aria-label={titleLabel} id="item-editor-title">{title}</h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </header>
          <div className={styles.body}>{children}</div>
          {typeof footer === 'function' ? footer(requestClose) : footer}
        </form>
      </section>
      {confirmDiscard && (
        <div className={styles.discardOverlay}>
          <section aria-describedby="discard-copy" aria-labelledby="discard-title" aria-modal="true" className={styles.discardDialog} ref={confirmRef} role="alertdialog">
            <div className={styles.discardCopy}>
              <h2 id="discard-title">저장하지 않고 닫을까요?</h2>
              <p id="discard-copy">지금 닫으면 변경한 내용이 사라집니다.</p>
            </div>
            <footer className={styles.discardActions}>
              <button className={styles.cancel} onClick={closeConfirmation} type="button">계속 편집</button>
              <button className={styles.discardConfirm} onClick={onClose} type="button">저장하지 않고 닫기</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
