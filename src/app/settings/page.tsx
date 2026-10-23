import { Suspense } from 'react';
import { ProfileRoute } from '../../features/routes/ProfileRoute';
import { getCurrentTimeMs } from '../../lib/clock';

export default function ProfilePage() {
  return (
    <Suspense fallback={<main aria-busy="true" role="status">설정을 불러오는 중입니다.</main>}>
      <ProfileRoute initialNowMs={getCurrentTimeMs()} />
    </Suspense>
  );
}
