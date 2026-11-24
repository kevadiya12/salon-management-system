import { createPortal } from 'react-dom';

interface CancelQueueModalProps {
  open: boolean;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function CancelQueueModal({
  open,
  isSubmitting,
  error,
  onConfirm,
  onClose,
}: CancelQueueModalProps) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-5 py-8 backdrop-blur-sm">
      <section
        aria-describedby="cancel-queue-description"
        aria-labelledby="cancel-queue-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-charcoal-raised p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Queue cancellation
        </p>
        <h2
          className="mt-3 font-serif text-2xl text-cream"
          id="cancel-queue-title"
        >
          Cancel your spot?
        </h2>
        <p
          className="mt-3 text-sm leading-6 text-stone-400"
          id="cancel-queue-description"
        >
          Cancellation cannot be undone. Your spot will be removed only after
          the backend confirms the request.
        </p>

        {error && (
          <p
            className="mt-5 rounded-xl border border-rose-200/20 bg-rose-100/[0.06] p-3 text-xs leading-5 text-rose-100"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-stone-300 transition hover:border-white/30 hover:text-cream"
            onClick={onClose}
            type="button"
          >
            Go Back
          </button>
          <button
            className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? 'Checking…' : 'Confirm Cancellation'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default CancelQueueModal;
