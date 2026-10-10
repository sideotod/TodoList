import { HomeRoute } from '../features/routes/HomeRoute';
import { getCurrentTimeMs } from '../lib/clock';

export default function HomePage() {
  return <HomeRoute initialNowMs={getCurrentTimeMs()} />;
}
