import { ProgressRoute } from '../../features/routes/ProgressRoute';
import { getCurrentTimeMs } from '../../lib/clock';

export default function ProgressPage() {
  return <ProgressRoute initialNowMs={getCurrentTimeMs()} />;
}
