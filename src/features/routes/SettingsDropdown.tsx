'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Icon } from '../ui/Icon';
import { createPortal } from 'react-dom';
import styles from './SettingsControl.module.css';

export type SettingsDropdownOption = { value: string; label: string; color?: string; colors?: readonly string[] };

export function SettingsDropdown({ ariaLabel, value, options, onChange, className, portal = true }: {
  ariaLabel: string;
  value: string | number;
  options: readonly SettingsDropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  portal?: boolean;
}) {
  const generatedId = useId().replaceAll(':', '');
  const listboxId = `settings-dropdown-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opensAbove, setOpensAbove] = useState(false);
  const [portalPosition, setPortalPosition] = useState<CSSProperties>();
  const currentValue = String(value);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === currentValue));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function placeMenu() {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const menuHeight = Math.min(options.length * 34 + 12, 264, window.innerHeight - 24);
      const menuWidth = Math.min(Math.max(bounds.width, menuRef.current?.scrollWidth ?? 0), 280, window.innerWidth - 24);
      const shouldOpenAbove = window.innerHeight - bounds.bottom < menuHeight + 12;
      setOpensAbove(shouldOpenAbove);
      if (portal) {
        setPortalPosition({
          left: Math.max(12, Math.min(bounds.left, window.innerWidth - menuWidth - 12)),
          top: shouldOpenAbove
            ? Math.max(12, bounds.top - menuHeight - 6)
            : Math.min(bounds.bottom + 6, window.innerHeight - menuHeight - 12),
          width: menuWidth,
          maxHeight: Math.min(264, window.innerHeight - 24),
        });
      }
    }
    placeMenu();
    optionRefs.current[activeIndex]?.focus({ preventScroll: true });
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    if (portal) {
      window.addEventListener('resize', placeMenu);
      window.addEventListener('scroll', placeMenu, true);
      return () => {
        window.removeEventListener('resize', placeMenu);
        window.removeEventListener('scroll', placeMenu, true);
      };
    }
  }, [activeIndex, open, options.length, portal]);

  function openMenu(index = selectedIndex) {
    setActiveIndex(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
      const trigger = triggerRef.current;
      if (!trigger) return;
      // Portal options sit outside the form: continue from the trigger's logical position.
      const dialog = trigger.closest<HTMLElement>('[role="dialog"], dialog');
      const scope = dialog ?? document.body;
      const controls = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]')]
        .filter((control) => control.tabIndex >= 0 && !control.closest('[inert]')
          && !menuRef.current?.contains(control) && control.getClientRects().length > 0
          && getComputedStyle(control).visibility !== 'hidden');
      const index = controls.indexOf(trigger) + (event.shiftKey ? -1 : 1);
      const next = dialog ? controls[(index + controls.length) % controls.length] : controls[index];
      if (next) {
        event.preventDefault();
        event.stopPropagation();
        next.focus();
      } else {
        trigger.focus();
      }
    }
  }

  function choose(option: SettingsDropdownOption) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const menu = (
    <div aria-hidden={!open} aria-label={`${ariaLabel} 선택`} className={`${styles.dropdownMenu}${portal ? ` ${styles.dropdownMenuPortal}` : ''}`} data-open={open} id={listboxId} inert={!open} ref={menuRef} role="listbox" style={portal && open ? portalPosition : undefined}>
      {options.map((option, index) => {
        const isSelected = option.value === currentValue;
        return (
          <button
            aria-selected={isSelected}
            className={styles.dropdownOption}
            data-selected={isSelected}
            key={option.value}
            onClick={() => choose(option)}
            onKeyDown={(event) => onOptionKeyDown(event, index)}
            ref={(element) => { optionRefs.current[index] = element; }}
            role="option"
            tabIndex={open && index === activeIndex ? 0 : -1}
            type="button"
          >
            <span className={styles.dropdownOptionLabel}>
              {option.colors
                ? <span aria-hidden="true" className={styles.dropdownPalette}>{option.colors.map((color) => <span className={styles.dropdownPaletteColor} key={color} style={{ backgroundColor: color }} />)}</span>
                : option.color && <span aria-hidden="true" className={styles.dropdownSwatch} style={{ backgroundColor: option.color }} />}
              {option.label}
            </span>
            {isSelected && <Icon className={styles.dropdownCheck} name="check" size={16} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`${styles.dropdown}${className ? ` ${className}` : ''}`} data-menu-portal={portal} data-open={open} data-opens-above={opensAbove} ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.dropdownTrigger}
        data-value={currentValue}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={onTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className={styles.dropdownValue}>
          {selected?.colors
            ? <span aria-hidden="true" className={styles.dropdownPalette}>{selected.colors.map((color) => <span className={styles.dropdownPaletteColor} key={color} style={{ backgroundColor: color }} />)}</span>
            : selected?.color && <span aria-hidden="true" className={styles.dropdownSwatch} style={{ backgroundColor: selected.color }} />}
          {selected?.label ?? currentValue}
        </span>
        <Icon className={styles.dropdownChevron} name="chevron-down" size={16} />
      </button>
      {portal && open && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
