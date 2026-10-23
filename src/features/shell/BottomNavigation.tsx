'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import styles from './BottomNavigation.module.css';
import { parseRouteDate } from '../../lib/route-date';

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  route: string;
};

const navigation: NavigationItem[] = [
  { label: '홈', href: '/', icon: '/design/figma-home.svg', route: '/' },
  { label: '캘린더', href: '/calendar', icon: '/design/figma-calendar.svg', route: '/calendar' },
  { label: '사용자 설정', href: '/settings', icon: '/design/user.svg', route: '/settings' },
];

export function BottomNavigation({ preview = false }: { preview?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeDate = parseRouteDate(searchParams.get('date'));
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previousRouteIndex = useRef<number | null>(null);
  const currentRoute = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const activeIndex = Math.max(0, navigation.findIndex((item) => currentRoute === item.route));

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;
    const previousIndex = previousRouteIndex.current;
    previousRouteIndex.current = activeIndex;
    if (previousIndex === null) return;
    if (previousIndex === activeIndex) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      indicator.dataset.moving = 'false';
      indicator.dataset.stretched = 'false';
      delete indicator.dataset.direction;
      return;
    }

    indicator.dataset.direction = activeIndex > previousIndex ? 'forward' : 'backward';
    indicator.dataset.moving = 'true';
    indicator.dataset.stretched = 'true';
  }, [activeIndex]);

  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      <span
        aria-hidden="true"
        className={styles.indicator}
        data-active-route={currentRoute}
        data-moving="false"
        data-stretched="false"
        data-testid="navigation-indicator"
        ref={indicatorRef}
        style={{ '--active-offset': `${activeIndex * 72}px` } as CSSProperties}
        onTransitionEnd={(event) => {
          if (event.propertyName !== 'transform') return;
          event.currentTarget.dataset.moving = 'false';
          event.currentTarget.dataset.stretched = 'false';
          delete event.currentTarget.dataset.direction;
        }}
      />
      {navigation.map((item) => {
        const active = currentRoute === item.route;
        const params = new URLSearchParams();
        if (preview) params.set('preview', 'design');
        if (routeDate) params.set('date', routeDate);
        const query = params.toString();
        const href = query ? `${item.href}?${query}` : item.href;
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={`${styles.link} ${active ? styles.active : ''}`}
            href={href}
            key={item.route}
            title={item.label}
          >
            <span aria-hidden="true" className={styles.icon} style={{ '--icon-source': `url("${item.icon}")` } as CSSProperties} />
          </Link>
        );
      })}
    </nav>
  );
}
