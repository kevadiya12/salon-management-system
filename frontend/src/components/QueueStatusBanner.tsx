import type { QueueStatus } from '../types/queueStatus';
import { queueStatusMessages } from '../types/queueStatus';

interface QueueStatusBannerProps {
  status?: QueueStatus;
  message?: string;
}

const statusStyles: Record<QueueStatus | 'unavailable', string> = {
  waiting: 'border-gold/25 bg-gold/[0.07] text-gold-light',
  'second-in-line': 'border-amber-200/25 bg-amber-100/[0.06] text-amber-100',
  called: 'border-emerald-200/25 bg-emerald-100/[0.06] text-emerald-100',
  'in-service': 'border-sky-200/25 bg-sky-100/[0.06] text-sky-100',
  completed: 'border-emerald-200/25 bg-emerald-100/[0.06] text-emerald-100',
  cancelled: 'border-rose-200/25 bg-rose-100/[0.06] text-rose-100',
  'no-show': 'border-stone-300/20 bg-white/[0.04] text-stone-300',
  unavailable: 'border-amber-200/20 bg-amber-100/[0.05] text-amber-100',
};

function QueueStatusBanner({ status, message }: QueueStatusBannerProps) {
  const content = status
    ? queueStatusMessages[status]
    : message ?? 'Queue status is currently unavailable.';
  const style = statusStyles[status ?? 'unavailable'];

  return (
    <div
      aria-live="polite"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm leading-6 sm:px-5 ${style}`}
      role="status"
    >
      <span
        aria-hidden="true"
        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-current"
      />
      <p>{content}</p>
    </div>
  );
}

export default QueueStatusBanner;
