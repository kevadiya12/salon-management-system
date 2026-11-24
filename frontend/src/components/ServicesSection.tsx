import type { HomepageCopy } from '../types/homepage';
import type { SalonService } from '../types/queue';
import SectionHeading from './SectionHeading';

interface ServicesSectionProps {
  copy: HomepageCopy['services'];
  services: SalonService[];
  loading: boolean;
  error: string | null;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function ServicesSection({ copy, services, loading, error }: ServicesSectionProps) {
  return (
    <section
      aria-labelledby="services-title"
      className="border-y border-white/[0.07] bg-charcoal-raised/50"
      id="services"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-24 lg:px-12">
        <SectionHeading
          centered
          description={copy.description}
          eyebrow={copy.eyebrow}
          id="services-title"
          title={copy.title}
        />

        {loading ? (
          <p className="mt-10 text-center text-sm text-stone-400">
            Loading current salon services…
          </p>
        ) : error ? (
          <p className="mx-auto mt-10 max-w-3xl rounded-2xl border border-amber-200/20 bg-amber-100/[0.05] px-6 py-8 text-center text-sm text-amber-100">
            Services are temporarily unavailable. Please try again later.
          </p>
        ) : services.length ? (
          <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                className="rounded-2xl border border-white/[0.09] bg-charcoal/60 p-5"
                key={service.id}
              >
                <h3 className="font-serif text-xl text-cream">{service.name}</h3>
                {service.description && (
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    {service.description}
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4 text-sm">
                  <span className="text-stone-400">
                    {service.durationMinutes} minutes
                  </span>
                  <span className="font-medium text-gold-light">
                    {currency.format(service.priceRupees)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-dashed border-gold/30 bg-charcoal/50 px-6 py-10 text-center sm:px-10 sm:py-12">
            <h3 className="text-base font-medium text-cream">{copy.emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-400">
              {copy.emptyDescription}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ServicesSection;
