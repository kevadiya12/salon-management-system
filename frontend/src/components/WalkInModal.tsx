import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReceptionBarber, ReceptionDashboard, WalkInRequest } from '../types/reception';

interface WalkInModalProps {
  open: boolean;
  dashboard: ReceptionDashboard;
  onClose: () => void;
  onSubmit: (request: WalkInRequest) => Promise<void>;
}

const inputClassName =
  'mt-2 w-full rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-cream outline-none transition placeholder:text-stone-600 focus:border-gold/70 focus:ring-2 focus:ring-gold/15';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function WalkInModal({
  open,
  dashboard,
  onClose,
  onSubmit,
}: WalkInModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [preferredBarberId, setPreferredBarberId] = useState('any');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerName('');
      setPhoneNumber('');
      setServiceIds([]);
      setPreferredBarberId('any');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const toggleService = (serviceId: string) => {
    setServiceIds((selected) => {
      if (selected.includes(serviceId)) {
        return selected.filter((id) => id !== serviceId);
      }
      if (selected.length >= 3) {
        setError('You can select up to three services.');
        return selected;
      }
      setError(null);
      return [...selected, serviceId];
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
      setError('Phone number must contain exactly 10 digits.');
      return;
    }
    if (serviceIds.length === 0) {
      setError('Select at least one service.');
      return;
    }
    if (serviceIds.length > 3) {
      setError('You can select up to three services.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        phoneNumber,
        serviceIds,
        preferredBarberId:
          preferredBarberId === 'any' ? null : preferredBarberId,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Walk-in could not be added. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        aria-labelledby="walk-in-title"
        aria-modal="true"
        className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-charcoal-raised p-5 shadow-2xl sm:rounded-3xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              New customer
            </p>
            <h2 className="mt-2 font-serif text-2xl text-cream" id="walk-in-title">
              Add walk-in
            </h2>
          </div>
          <button
            aria-label="Close walk-in form"
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-stone-400 hover:border-white/25 hover:text-cream"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-stone-300" htmlFor="walk-in-name">
                Customer name
              </label>
              <input
                autoComplete="name"
                className={inputClassName}
                id="walk-in-name"
                maxLength={100}
                onChange={(event) => setCustomerName(event.currentTarget.value)}
                placeholder="Enter customer name"
                required
                value={customerName}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-300" htmlFor="walk-in-phone">
                Phone number
              </label>
              <input
                autoComplete="tel"
                className={inputClassName}
                id="walk-in-phone"
                inputMode="numeric"
                onChange={(event) =>
                  setPhoneNumber(event.currentTarget.value.replace(/\D/g, ''))
                }
                placeholder="10-digit number"
                required
                type="tel"
                value={phoneNumber}
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-stone-300">
              Services <span className="text-stone-500">· choose up to 3</span>
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {dashboard.services.map((service) => {
                const selected = serviceIds.includes(service.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-gold/75 bg-gold/[0.08]'
                        : 'border-white/10 bg-charcoal-deep hover:border-gold/40'
                    }`}
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    type="button"
                  >
                    <span className="block text-xs font-medium text-cream">
                      {service.name}
                    </span>
                    <span className="mt-2 block text-[10px] text-stone-500">
                      {service.durationMinutes} min · {currency.format(service.priceRupees)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className="text-xs font-medium text-stone-300" htmlFor="walk-in-barber">
              Barber preference
            </label>
            <select
              className={inputClassName}
              id="walk-in-barber"
              onChange={(event) => setPreferredBarberId(event.currentTarget.value)}
              value={preferredBarberId}
            >
              <option value="any">Any barber</option>
              {dashboard.barbers.map((barber: ReceptionBarber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name} · {barber.status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200/15 bg-rose-200/[0.05] px-4 py-3 text-xs text-rose-100" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-white/15 px-5 py-3 text-xs font-medium text-stone-300 transition hover:border-white/30 disabled:opacity-50"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-gold px-6 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
              disabled={submitting || !dashboard.queueOpen}
              type="submit"
            >
              {submitting ? 'Adding walk-in…' : 'Confirm walk-in'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

export default WalkInModal;
