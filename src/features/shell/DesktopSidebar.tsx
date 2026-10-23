'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ItemView } from '../../domain/items';
import { selectDailyTasks } from '../../domain/projections';
import { TodoLogo } from './TodoLogo';
import { Icon } from '../ui/Icon';
import styles from './DesktopSidebar.module.css';

type DesktopSidebarProps = {
  pathname: string;
  items: readonly ItemView[];
  preview: boolean;
  timeZone: string;
  todayDate: string;
};

const routes = [
  { href: '/', label: '오늘', icon: 'sun', key: 'today' },
  { href: '/progress', label: 'Progress', icon: 'progress', key: 'progress' },
  { href: '/calendar', label: '캘린더', icon: 'calendar', key: 'calendar' },
] as const;

export function DesktopSidebar({ pathname, items, preview, timeZone, todayDate }: DesktopSidebarProps) {
  const searchParams = useSearchParams();
  const selectedArea = searchParams.get('area');
  const selectedDate = searchParams.get('date');
  const taskDate = selectedDate ?? todayDate;
  const todayTaskCount = selectDailyTasks(items, taskDate, timeZone).filter((item) => item.display.kind === 'task' && item.display.completion === 'pending').length;
  const categories = [...new Set(items.map((item) => item.display.category?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const currentRoute = pathname === '/' ? 'today' : pathname.startsWith('/progress') ? 'progress' : pathname.startsWith('/calendar') ? 'calendar' : '';

  function hrefFor(route: string, area?: string | null) {
    const params = new URLSearchParams();
    if (preview) params.set('preview', 'design');
    if (area) params.set('area', area);
    if (selectedDate) params.set('date', selectedDate);
    const query = params.toString();
    return query ? `${route}?${query}` : route;
  }

  return (
    <aside aria-label="주요 탐색" className={styles.sidebar}>
      <Link aria-label="Todo 홈" className={styles.brand} href={hrefFor('/')}><TodoLogo /></Link>
      <div className={styles.sectionLabel}>WORKSPACE</div>
      <nav aria-label="화면" className={styles.navigation}>
        {routes.map((route) => {
          const active = currentRoute === route.key;
          const count = route.key === 'today'
            ? todayTaskCount
            : route.key === 'progress'
              ? items.filter((item) => item.display.kind === 'deadline' || item.display.kind === 'window').length
              : null;
          return (
            <Link aria-current={active ? 'page' : undefined} className={`${styles.navLink} ${active ? styles.active : ''}`} href={hrefFor(route.href, selectedArea)} key={route.key}>
              <Icon className={styles.navIcon} name={route.icon} size={17} />
              <span>{route.label}</span>
              {count !== null && <small>{count}</small>}
            </Link>
          );
        })}
      </nav>
      <div className={styles.divider} />
      <div className={styles.sectionLabel}>MY AREAS</div>
      <nav aria-label="카테고리 필터" className={styles.areas}>
        {categories.map((category) => (
          <Link aria-current={selectedArea === category ? 'true' : undefined} className={styles.areaLink} href={hrefFor(currentRoute === 'progress' ? '/progress' : currentRoute === 'calendar' ? '/calendar' : '/', selectedArea === category ? null : category)} key={category}>
            <span aria-hidden="true" className={styles.areaDot} />{category}
          </Link>
        ))}
        {categories.length === 0 && <span className={styles.areaEmpty}>카테고리가 없습니다</span>}
      </nav>
      <Link aria-current={pathname.startsWith('/settings') ? 'page' : undefined} className={`${styles.settings} ${pathname.startsWith('/settings') ? styles.active : ''}`} href={hrefFor('/settings')}>
        <span className={styles.avatar}>{preview ? 'L' : 'S'}</span><span>설정 · 내 공간</span><Icon name="settings" size={15} />
      </Link>
    </aside>
  );
}
