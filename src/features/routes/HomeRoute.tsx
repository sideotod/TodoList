'use client';

import { useMemo } from 'react';
import { getLocalDate } from '../../domain/time';
import { useItems } from '../../lib/repository-context';
import { AppShell } from '../shell/AppShell';
import { useForegroundClock } from '../shell/useForegroundClock';
import { HomeExperience } from '../home/HomeExperience';
import { createLocalPreviewFixture } from '../home/preview-data';

export function HomeRoute({ initialNowMs }: { initialNowMs: number }) {
  const items = useItems();
  const nowMs = useForegroundClock(initialNowMs);
  const localDate = getLocalDate(nowMs, 'Asia/Seoul');
  const localFixture = useMemo(() => createLocalPreviewFixture(localDate), [localDate]);

  return (
    <AppShell
      previewItems={localFixture.items}
      previewContent={(
        <HomeExperience
          key={localFixture.date}
          items={localFixture.items}
          nowMs={nowMs}
          initialDate={localFixture.date}
          preview
        />
      )}
    >
      <HomeExperience items={items} nowMs={nowMs} />
    </AppShell>
  );
}
