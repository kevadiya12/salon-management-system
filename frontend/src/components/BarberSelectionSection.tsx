import type { ReceptionBarber } from '../types/reception';

interface BarberSelectionSectionProps {
  selectedBarberId: string | null;
  barbers: Array<Pick<ReceptionBarber, 'id' | 'name' | 'status'>>;
  loading: boolean;
  error?: string;
  onSelect: (barberId: string) => void;
}

function BarberSelectionSection({
  selectedBarberId,
  barbers,
  loading,
  error,
  onSelect,
}: BarberSelectionSectionProps) {
  const isAnyBarberSelected = selectedBarberId === 'any';
  const statusLabel = {
    available: 'Available',
    busy: 'Busy',
    on_break: 'On Break',
  } as const;

  return (
    <section
      aria-labelledby="barber-selection-title"
      className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Your preference
        </p>
        <h2
          className="mt-2 font-serif text-2xl text-cream"
          id="barber-selection-title"
        >
          Choose a barber
        </h2>
      </div>

      <button
        aria-pressed={isAnyBarberSelected}
        className={`mt-6 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
          isAnyBarberSelected
            ? 'border-gold/80 bg-gold/[0.09]'
            : 'border-white/10 bg-charcoal-deep/70 hover:border-gold/45'
        }`}
        onClick={() => onSelect('any')}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-charcoal-raised font-serif text-lg text-gold-light"
        >
          A
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-cream">
            Any barber
          </span>
          <span className="mt-1 block text-xs text-stone-400">
            Fastest available
          </span>
        </span>
        <span className="rounded-full border border-gold/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-gold-light">
          Fastest
        </span>
      </button>

      {loading ? (
        <p className="mt-4 text-xs text-stone-500">Loading barber roster…</p>
      ) : barbers.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {barbers.map((barber) => (
            <button
              aria-pressed={selectedBarberId === barber.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${
                selectedBarberId === barber.id
                  ? 'border-gold/70 bg-gold/[0.08]'
                  : 'border-white/10 bg-charcoal-deep/70 hover:border-gold/40'
              }`}
              key={barber.id}
              onClick={() => onSelect(barber.id)}
              type="button"
            >
              <span className="min-w-0 truncate text-sm text-cream">
                {barber.name}
              </span>
              <span className="shrink-0 text-[10px] capitalize text-stone-500">
                {statusLabel[barber.status].toLowerCase()}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-4 text-xs leading-5 text-stone-500">
          No individual barbers are listed yet. Any barber will be assigned
          according to the queue rules.
        </p>
      )}

      {error && (
        <p className="mt-4 text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default BarberSelectionSection;
