import { createPortal } from 'react-dom';

interface CompleteBarberServiceModalProps {
  customerName: string | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function CompleteBarberServiceModal({
  customerName,
  open,
  busy,
  onClose,
  onConfirm,
}: CompleteBarberServiceModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="complete-service-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-charcoal-raised p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Finish service
        </p>
        <h2
          className="mt-3 font-serif text-2xl text-cream"
          id="complete-service-title"
        >
          Mark this service as done?
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          {customerName
            ? `Complete ${customerName}'s service? This will clear the active assignment and make you available.`
            : 'Complete this service? This will clear the active assignment and make you available.'}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-white/15 px-5 py-3 text-xs font-medium text-stone-300 transition hover:border-white/30 disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Keep working
          </button>
          <button
            className="rounded-full bg-gold px-5 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'Saving…' : 'Confirm done'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default CompleteBarberServiceModal;
