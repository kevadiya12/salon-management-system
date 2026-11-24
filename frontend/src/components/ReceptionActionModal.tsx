import { createPortal } from 'react-dom';
import type { ReceptionBooking } from '../types/reception';

interface ReceptionActionModalProps {
  booking: ReceptionBooking | null;
  action: 'cancel' | 'no_show' | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function ReceptionActionModal({
  booking,
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: ReceptionActionModalProps) {
  if (!booking || !action) return null;

  const isCancel = action === 'cancel';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="queue-action-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-charcoal-raised p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          {booking.token} · {booking.customerName}
        </p>
        <h2 className="mt-3 font-serif text-2xl text-cream" id="queue-action-title">
          {isCancel ? 'Cancel this queue spot?' : 'Mark as no-show?'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          {isCancel
            ? 'This customer will be removed from the waiting queue. This action cannot be undone.'
            : 'This customer will be marked No-show and removed from the waiting queue.'}
        </p>
        {error && (
          <p className="mt-4 text-xs leading-5 text-rose-200" role="alert">
            {error}
          </p>
        )}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-white/15 px-5 py-3 text-xs font-medium text-stone-300 hover:border-white/30 disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Go back
          </button>
          <button
            className={`rounded-full px-5 py-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50 ${
              isCancel
                ? 'border border-rose-200/25 text-rose-100 hover:bg-rose-100/[0.05]'
                : 'bg-amber-200 text-charcoal hover:bg-amber-100'
            }`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy
              ? 'Updating…'
              : isCancel
                ? 'Confirm cancellation'
                : 'Confirm No-show'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default ReceptionActionModal;
