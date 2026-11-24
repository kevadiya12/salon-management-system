import type { ReceptionBarber } from '../types/reception';

interface ReceptionBarberCardProps {
  barber: ReceptionBarber;
  now: Date;
  busyAction: boolean;
  onCallNext: () => void;
  onStartService: () => void;
  onCompleteService: () => void;
  onAvailabilityChange: (status: 'available' | 'on_break') => void;
}

const statusLabel = {
  available: 'Available',
  busy: 'Busy',
  on_break: 'On Break',
} as const;

const statusStyle = {
  available: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200',
  busy: 'border-gold/25 bg-gold/[0.08] text-gold-light',
  on_break: 'border-white/10 bg-white/[0.04] text-stone-400',
} as const;

function ReceptionBarberCard({
  barber,
  now,
  busyAction,
  onCallNext,
  onStartService,
  onCompleteService,
  onAvailabilityChange,
}: ReceptionBarberCardProps) {
  const initials = barber.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const estimatedRemainingMinutes =
    barber.currentBookingStatus === 'in_service' &&
    barber.serviceStartedAt &&
    barber.currentServiceDurationMinutes !== null
      ? Math.max(
          0,
          barber.currentServiceDurationMinutes -
            Math.floor((now.getTime() - Date.parse(barber.serviceStartedAt)) / 60_000),
        )
      : barber.estimatedRemainingMinutes;

  return (
    <article className="flex min-h-full flex-col rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 transition hover:border-gold/25">
      <div className="flex items-start gap-3">
        {barber.photoUrl ? (
          <img
            alt=""
            className="h-12 w-12 rounded-full object-cover"
            src={barber.photoUrl}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-charcoal-raised font-serif text-sm text-gold-light"
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-cream">{barber.name}</h3>
          <span
            className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${statusStyle[barber.status]}`}
          >
            {statusLabel[barber.status]}
          </span>
        </div>
      </div>

      <div className="my-5 flex-1 border-y border-white/[0.08] py-4">
        {barber.currentCustomerName ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
              Current customer
            </p>
            <p className="mt-1.5 truncate text-sm text-stone-200">
              {barber.currentCustomerName}
            </p>
            <p className="mt-1 truncate text-xs text-stone-500">
              {barber.currentServiceNames.join(' · ')}
            </p>
            <p className="mt-3 text-xs text-stone-400">
              {barber.currentBookingStatus === 'called'
                ? 'Called · waiting to begin'
                : `${estimatedRemainingMinutes ?? 0} min estimated remaining`}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500">
              Current customer
            </p>
            <p className="mt-2 text-sm text-stone-400">No customer assigned</p>
          </>
        )}
      </div>

      {barber.currentBookingStatus === 'called' && barber.currentBookingId ? (
        <button
          className="w-full rounded-full bg-gold px-4 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
          disabled={busyAction}
          onClick={onStartService}
          type="button"
        >
          Start Service
        </button>
      ) : barber.currentBookingStatus === 'in_service' && barber.currentBookingId ? (
        <button
          className="w-full rounded-full bg-gold px-4 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
          disabled={busyAction}
          onClick={onCompleteService}
          type="button"
        >
          Complete Service
        </button>
      ) : barber.status === 'available' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-full bg-gold px-3 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
            disabled={busyAction}
            onClick={onCallNext}
            type="button"
          >
            Call Next
          </button>
          <button
            className="rounded-full border border-white/10 px-3 py-3 text-xs font-medium text-stone-300 transition hover:border-gold/40 hover:text-gold-light disabled:opacity-50"
            disabled={busyAction}
            onClick={() => onAvailabilityChange('on_break')}
            type="button"
          >
            Take Break
          </button>
        </div>
      ) : barber.status === 'on_break' ? (
        <button
          className="w-full rounded-full border border-white/10 px-4 py-3 text-xs font-medium text-stone-300 transition hover:border-gold/40 hover:text-gold-light disabled:opacity-50"
          disabled={busyAction}
          onClick={() => onAvailabilityChange('available')}
          type="button"
        >
          Mark Available
        </button>
      ) : (
        <button
          className="w-full cursor-not-allowed rounded-full border border-white/10 px-4 py-3 text-xs font-medium text-stone-500"
          disabled
          type="button"
        >
          Currently Busy
        </button>
      )}
    </article>
  );
}

export default ReceptionBarberCard;
