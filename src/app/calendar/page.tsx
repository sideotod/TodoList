import { CalendarRoute } from '../../features/routes/CalendarRoute';
import { getCurrentTimeMs } from '../../lib/clock';

export default function CalendarPage() {
  return <CalendarRoute initialNowMs={getCurrentTimeMs()} />;
}
