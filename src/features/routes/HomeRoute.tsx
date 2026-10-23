'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLocalDate } from '../../domain/time';
import { useItems } from '../../lib/repository-context';
import { parseRouteDate } from '../../lib/route-date';
import { AppShell } from '../shell/AppShell';
import { useForegroundClock } from '../shell/useForegroundClock';
import { HomeExperience } from '../home/HomeExperience';
import { createLocalPreviewFixture } from '../home/preview-data';

export function HomeRoute({ initialNowMs }: { initialNowMs: number }) {
  return (
    <Suspense fallback={<main aria-busy="true">홈을 불러오고 있습니다.</main>}>
      <HomeRouteContent initialNowMs={initialNowMs} />
    </Suspense>
  );
}

function HomeRouteContent({ initialNowMs }: { initialNowMs: number }) {
  const searchParams = useSearchParams();
  const items = useItems();
  const nowMs = useForegroundClock(initialNowMs);
  const localDate = getLocalDate(nowMs, 'Asia/Seoul');
  const routeDate = parseRouteDate(searchParams.get('date'));
  const localFixture = useMemo(() => createLocalPreviewFixture(localDate), [localDate]);

  return (
    <AppShell
      previewItems={localFixture.items}
      previewContent={(
        <HomeExperience
          key={localFixture.date}
          items={localFixture.items}
          nowMs={nowMs}
          initialDate={routeDate ?? localFixture.date}
          preview
        />
      )}
    >
      <HomeExperience initialDate={routeDate ?? localDate} items={items} nowMs={nowMs} />
    </AppShell>
  );
}
