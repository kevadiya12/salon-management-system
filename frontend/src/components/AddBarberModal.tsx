import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface AddBarberModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

function AddBarberModal({ open, onClose, onSubmit }: AddBarberModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Barber name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Barber could not be added. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="add-barber-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-charcoal-raised p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Salon roster
        </p>
        <h2 className="mt-3 font-serif text-2xl text-cream" id="add-barber-title">
          Add a barber
        </h2>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          Add the real salon roster. No sample barbers are preloaded.
        </p>
        <form className="mt-5" onSubmit={handleSubmit}>
          <label className="text-xs font-medium text-stone-300" htmlFor="barber-name">
            Barber name
          </label>
          <input
            autoFocus
            className="mt-2 w-full rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-cream outline-none focus:border-gold/60"
            id="barber-name"
            maxLength={100}
            onChange={(event) => setName(event.currentTarget.value)}
            required
            value={name}
          />
          {error && (
            <p className="mt-3 text-xs text-rose-200" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-white/15 px-5 py-3 text-xs text-stone-300 hover:border-white/30 disabled:opacity-50"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-gold px-5 py-3 text-xs font-semibold text-charcoal hover:bg-gold-light disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Adding…' : 'Add barber'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export default AddBarberModal;
