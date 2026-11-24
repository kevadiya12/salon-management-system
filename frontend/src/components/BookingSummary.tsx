import type { SalonService } from '../types/queue';

interface BookingSummaryProps {
  selectedServices: SalonService[];
  selectedBarberId: string | null;
  totalDuration: number;
  totalPrice: number;
  submissionMessage: string | null;
  isSubmitting: boolean;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function BookingSummary({
  selectedServices,
  selectedBarberId,
  totalDuration,
  totalPrice,
  submissionMessage,
  isSubmitting,
}: BookingSummaryProps) {
  return (
    <aside
      aria-labelledby="booking-summary-title"
      className="rounded-2xl border border-gold/20 bg-charcoal-raised p-5 shadow-xl shadow-black/20 sm:p-7 lg:sticky lg:top-28"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Your visit
      </p>
      <h2
        className="mt-2 font-serif text-2xl text-cream"
        id="booking-summary-title"
      >
        Booking summary
      </h2>

      <div className="mt-6 border-y border-white/10 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
          Selected services
        </p>
        {selectedServices.length ? (
          <ul className="mt-3 space-y-3">
            {selectedServices.map((service) => (
              <li
                className="flex items-start justify-between gap-3 text-sm"
                key={service.id}
              >
                <span className="text-stone-200">{service.name}</span>
                <span className="shrink-0 text-stone-400">
                  {currency.format(service.priceRupees)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            No services selected yet.
          </p>
        )}
      </div>

      <dl className="space-y-4 py-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-stone-400">Total duration</dt>
          <dd className="font-medium text-stone-100">
            {totalDuration ? `${totalDuration} minutes` : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-stone-400">Total price</dt>
          <dd className="font-medium text-gold-light">
            {currency.format(totalPrice)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <dt className="text-stone-400">Expected wait</dt>
          <dd className="text-right font-medium text-stone-300">
            Estimate unavailable
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-4 text-sm">
          <dt className="text-stone-400">Barber</dt>
          <dd className="text-right font-medium text-stone-200">
            {selectedBarberId === 'any' ? 'Any barber' : 'Not selected'}
          </dd>
        </div>
      </dl>

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-charcoal transition duration-200 hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-70"
        disabled={isSubmitting}
        form="join-queue-form"
        type="submit"
      >
        {isSubmitting ? 'Checking availability…' : 'Confirm & Join Queue'}
        {!isSubmitting && <span aria-hidden="true">→</span>}
      </button>

      {submissionMessage && (
        <p
          aria-live="polite"
          className="mt-4 rounded-xl border border-amber-200/20 bg-amber-100/[0.06] p-3 text-xs leading-5 text-amber-100"
          role="alert"
        >
          {submissionMessage}
        </p>
      )}

      <p className="mt-4 text-center text-[11px] leading-5 text-stone-500">
        Your queue request will only be confirmed when booking is available.
      </p>
    </aside>
  );
}

export default BookingSummary;
