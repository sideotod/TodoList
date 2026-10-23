'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import type { CSSProperties, KeyboardEvent } from 'react';
import { isKoreanPublicHoliday } from '../calendar/korean-holidays';
import { formatDateDisplay, parseDateDraft, parseTimeDraft } from './date-time-picker';
import styles from './DateTimePickerInput.module.css';

type DateTimePickerInputProps = {
  kind: 'date' | 'time';
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

type Position = { top: number; left: number; maxHeight: number };

export function DateTimePickerInput({ kind, label, value, onChange, invalid = false }: DateTimePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef(false);
  const [draft, setDraft] = useState(() => getDisplay(kind, value));
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialMonth(value));
  const hasPosition = position !== null;

  useEffect(() => {
    if (!editingRef.current) setDraft(getDisplay(kind, value));
  }, [kind, value]);

  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const place = () => {
      const control = controlRef.current;
      const anchorElement = kind === 'date' ? triggerRef.current : control;
      const anchor = anchorElement?.getBoundingClientRect();
      const panel = popoverRef.current?.getBoundingClientRect();
      if (!control || !anchorElement || !anchor || !panel) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const panelContentHeight = Math.max(panel.height, popoverRef.current?.scrollHeight ?? 0);
      const desiredHeight = Math.min(panelContentHeight, Math.max(220, viewportBottom - viewportTop - 24));
      const availableBelow = Math.max(0, viewportBottom - anchor.bottom - 20);
      if (availableBelow < desiredHeight && scrollControlUp(control, desiredHeight - availableBelow, viewportTop)) {
        if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; place(); });
        return;
      }
      const availableAbove = Math.max(0, anchor.top - viewportTop - 20);
      const placeAbove = availableBelow < desiredHeight && availableAbove >= desiredHeight;
      const desiredLeft = anchor.left + (anchor.width - panel.width) / 2;
      const left = Math.max(viewportLeft + 12, Math.min(desiredLeft, viewportRight - panel.width - 12));
      const top = placeAbove ? anchor.top - desiredHeight - 8 : anchor.bottom + 8;
      const maxHeight = placeAbove ? desiredHeight : Math.max(0, viewportBottom - top - 12);
      setPosition((current) => current && Math.abs(current.top - top) < 0.5 && Math.abs(current.left - left) < 0.5 && Math.abs(current.maxHeight - maxHeight) < 0.5
        ? current
        : { top, left, maxHeight });
    };
    const schedulePlace = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; place(); });
    };
    place();
    window.addEventListener('resize', schedulePlace);
    window.addEventListener('scroll', schedulePlace, true);
    window.visualViewport?.addEventListener('resize', schedulePlace);
    window.visualViewport?.addEventListener('scroll', schedulePlace);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePlace);
      window.removeEventListener('scroll', schedulePlace, true);
      window.visualViewport?.removeEventListener('resize', schedulePlace);
      window.visualViewport?.removeEventListener('scroll', schedulePlace);
    };
  }, [kind, open, visibleMonth]);

  useLayoutEffect(() => {
    if (!open) return;
    const selected = popoverRef.current?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"]');
    const first = popoverRef.current?.querySelector<HTMLElement>('button:not(:disabled)');
    (selected ?? first)?.focus({ preventScroll: true });
  }, [open, hasPosition]);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popoverRef.current?.contains(target) || inputRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function showPicker() {
    setVisibleMonth(getInitialMonth(value));
    setOpen(!open);
  }

  function changeDraft(next: string) {
    setDraft(next);
    const parsed = kind === 'date' ? parseDateDraft(next) : parseTimeDraft(next);
    if (parsed) onChange(parsed);
  }

  function finishEditing() {
    editingRef.current = false;
    setDraft(getDisplay(kind, value));
  }

  function pickDate(date: string) {
    onChange(date);
    setDraft(formatDateDisplay(date));
    setOpen(false);
    inputRef.current?.focus();
  }

  function pickTime(hour: number, minute: number) {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange(time);
    setDraft(time);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      showPicker();
    }
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(popoverRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    event.stopPropagation();
  }

  const activePicker = open && typeof document !== 'undefined' ? createPortal(
    <div
      aria-label={kind === 'date' ? `${label} 달력` : `${label} 시각 선택`}
      className={`${styles.popover} ${kind === 'time' ? styles.timePopover : ''}`}
      onKeyDown={handlePickerKeyDown}
      ref={popoverRef}
      role="group"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight ?? '100vh',
        '--picker-max-height': `${position?.maxHeight ?? 0}px`,
        visibility: position ? 'visible' : 'hidden',
      } as CSSProperties}
    >
      {kind === 'date' ? (
        <DatePicker value={value} visibleMonth={visibleMonth} onMonthChange={setVisibleMonth} onPick={pickDate} />
      ) : (
        <TimePicker value={value} onDone={() => { setOpen(false); inputRef.current?.focus(); }} onPick={pickTime} />
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={styles.control} ref={controlRef}>
      <input
        aria-invalid={invalid || undefined}
        aria-label={label}
        autoComplete="off"
        className={styles.input}
        inputMode="numeric"
        onBlur={finishEditing}
        onChange={(event) => changeDraft(event.currentTarget.value)}
        onFocus={() => { editingRef.current = true; }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        type="text"
        value={draft}
      />
      <button
        aria-expanded={open}
        aria-label={`${label} ${kind === 'date' ? '달력' : '시각'} 선택 열기`}
        className={styles.trigger}
        onClick={showPicker}
        ref={triggerRef}
        type="button"
      >
        <Icon name={kind === 'date' ? 'calendar' : 'clock'} />
      </button>
      {activePicker}
    </div>
  );
}

function DatePicker({ value, visibleMonth, onMonthChange, onPick }: {
  value: string;
  visibleMonth: string;
  onMonthChange: (month: string) => void;
  onPick: (date: string) => void;
}) {
  const [year, month] = visibleMonth.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
  });

  function moveMonth(amount: number) {
    const next = new Date(Date.UTC(year, month - 1 + amount, 1));
    onMonthChange(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <>
      <header className={styles.calendarHeader}>
        <button aria-label="이전 달" className={styles.monthButton} onClick={() => moveMonth(-1)} type="button"><Icon name="chevron-left" /></button>
        <strong>{year}년 {month}월</strong>
        <button aria-label="다음 달" className={styles.monthButton} onClick={() => moveMonth(1)} type="button"><Icon name="chevron-right" /></button>
      </header>
      <div aria-hidden="true" className={styles.weekdays}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.days}>
        {days.map((date, index) => {
          if (!date) return <span aria-hidden="true" className={styles.blankDay} key={`blank-${index}`} />;
          const weekday = index % 7;
          const dayNumber = Number(date.slice(-2));
          const holiday = isKoreanPublicHoliday(date);
          const today = date === getLocalToday();
          const className = [styles.day, weekday === 0 || holiday ? styles.holiday : '', weekday === 6 && !holiday ? styles.saturday : '', today ? styles.today : '', value === date ? styles.selected : ''].filter(Boolean).join(' ');
          return <button aria-current={today ? 'date' : undefined} aria-label={`${date} 선택`} aria-pressed={value === date} className={className} key={date} onClick={() => onPick(date)} type="button">{dayNumber}</button>;
        })}
      </div>
    </>
  );
}

function TimePicker({ value, onPick, onDone }: { value: string; onPick: (hour: number, minute: number) => void; onDone: () => void }) {
  const parsed = parseTimeDraft(value);
  const fallback = new Date();
  const hour = parsed ? Number(parsed.slice(0, 2)) : fallback.getHours();
  const minute = parsed ? Number(parsed.slice(3, 5)) : fallback.getMinutes();
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const hourButton = hourList.current?.querySelector<HTMLElement>(`[data-value="${hour}"]`);
    const minuteButton = minuteList.current?.querySelector<HTMLElement>(`[data-value="${minute}"]`);
    centerTimeOption(hourList.current, hourButton);
    centerTimeOption(minuteList.current, minuteButton);
  }, [hour, minute]);

  return (
    <>
      <div className={styles.timePrompt}>시각을 선택하세요</div>
      <div className={styles.timeColumns}>
        <div aria-label="시" className={styles.timeList} ref={hourList} role="listbox">
          {Array.from({ length: 24 }, (_, valueIndex) => <button aria-selected={hour === valueIndex} className={hour === valueIndex ? styles.selectedTime : ''} data-value={valueIndex} key={valueIndex} onClick={() => onPick(valueIndex, minute)} role="option" type="button">{String(valueIndex).padStart(2, '0')}</button>)}
        </div>
        <span className={styles.timeSeparator}>:</span>
        <div aria-label="분" className={styles.timeList} ref={minuteList} role="listbox">
          {Array.from({ length: 60 }, (_, valueIndex) => <button aria-selected={minute === valueIndex} className={minute === valueIndex ? styles.selectedTime : ''} data-value={valueIndex} key={valueIndex} onClick={() => onPick(hour, valueIndex)} role="option" type="button">{String(valueIndex).padStart(2, '0')}</button>)}
        </div>
      </div>
      <div aria-live="polite" className={styles.timeHeading}><strong>{String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}</strong></div>
      <footer className={styles.pickerFooter}><button onClick={onDone} type="button">완료</button></footer>
    </>
  );
}

function centerTimeOption(list: HTMLDivElement | null, option: HTMLElement | null | undefined) {
  if (!list || !option) return;
  list.scrollTop = option.offsetTop - list.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
}

function scrollControlUp(control: HTMLElement, amount: number, viewportTop: number): boolean {
  let ancestor = control.parentElement;
  while (ancestor && ancestor !== document.body) {
    const overflowY = getComputedStyle(ancestor).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && ancestor.scrollHeight > ancestor.clientHeight + 1) {
      const available = ancestor.scrollHeight - ancestor.clientHeight - ancestor.scrollTop;
      if (available > 1) {
        const initialScrollTop = ancestor.scrollTop;
        ancestor.scrollTop += Math.min(amount, available);
        return Math.abs(ancestor.scrollTop - initialScrollTop) > 1;
      }
    }
    ancestor = ancestor.parentElement;
  }
  const maximum = control.getBoundingClientRect().top - viewportTop - 12;
  if (maximum <= 1) return false;
  const initialScrollY = window.scrollY;
  window.scrollBy(0, Math.min(amount, maximum));
  return Math.abs(window.scrollY - initialScrollY) > 1;
}

function getLocalToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getDisplay(kind: 'date' | 'time', value: string) {
  return kind === 'date' ? formatDateDisplay(value) : value;
}

function getInitialMonth(value: string) {
  const parsed = parseDateDraft(value);
  if (parsed) return parsed.slice(0, 7);
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
