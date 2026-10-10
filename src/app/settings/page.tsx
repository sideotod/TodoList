import { ProfileRoute } from '../../features/routes/ProfileRoute';
import { getCurrentTimeMs } from '../../lib/clock';

export default function ProfilePage() {
  return <ProfileRoute initialNowMs={getCurrentTimeMs()} />;
}
