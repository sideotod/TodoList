'use client';

import { useEffect, useState } from 'react';

export function useForegroundClock(initialNowMs: number): number {
  const [nowMs, setNowMs] = useState(initialNowMs);

  useEffect(() => {
    let timer: number | null = null;

    function refresh() {
      setNowMs(Date.now());
    }

    function syncVisibility() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      refresh();
      if (document.visibilityState === 'visible') {
        timer = window.setInterval(refresh, 1_000);
      }
    }

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', syncVisibility);
    syncVisibility();

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', syncVisibility);
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  return nowMs;
}
