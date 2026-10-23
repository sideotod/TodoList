import type { ReactNode } from 'react';

type IconName = 'plus' | 'menu' | 'check' | 'close' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'calendar' | 'clock';

const paths: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  'chevron-left': <path d="m14 5-7 7 7 7" />,
  'chevron-right': <path d="m10 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

/** Decorative icons inherit the control's color; the control supplies its accessible name. */
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" focusable="false" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} viewBox="0 0 24 24" width={size}>{paths[name]}</svg>;
}
