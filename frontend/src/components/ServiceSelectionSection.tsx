import type { SalonService } from '../types/queue';

interface ServiceSelectionSectionProps {
  services: SalonService[];
  selectedServiceIds: string[];
  error?: string;
  onToggle: (serviceId: string) => void;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function ServiceSelectionSection({
  services,
  selectedServiceIds,
  error,
  onToggle,
}: ServiceSelectionSectionProps) {
  return (
    <section
      aria-labelledby="service-selection-title"
      className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Choose what you need
          </p>
          <h2
            className="mt-2 font-serif text-2xl text-cream"
            id="service-selection-title"
          >
            Select services
          </h2>
        </div>
        <p className="text-xs text-stone-500">
          Choose up to 3 · {selectedServiceIds.length}/3 selected
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const isSelected = selectedServiceIds.includes(service.id);

          return (
            <button
              aria-pressed={isSelected}
              className={`group rounded-xl border p-4 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                isSelected
                  ? 'salon-selection-shadow border-gold/80 bg-gold/[0.09]'
                  : 'border-white/10 bg-charcoal-deep/70 hover:border-gold/45 hover:bg-white/[0.035]'
              }`}
              key={service.id}
              onClick={() => onToggle(service.id)}
              type="button"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-cream">
                  {service.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition ${
                    isSelected
                      ? 'border-gold bg-gold text-charcoal'
                      : 'border-white/20 text-transparent group-hover:border-gold/60'
                  }`}
                >
                  ✓
                </span>
              </span>
              <span className="mt-5 flex items-center justify-between gap-2 text-xs text-stone-400">
                <span>{service.durationMinutes} minutes</span>
                <span className="font-medium text-gold-light">
                  {currency.format(service.priceRupees)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default ServiceSelectionSection;
