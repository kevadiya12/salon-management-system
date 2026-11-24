import type { ReceptionBarber, ReceptionBooking } from '../types/reception';

interface ReceptionQueueTableProps {
  bookings: ReceptionBooking[];
  barbers: ReceptionBarber[];
  now: Date;
  search: string;
  statusFilter: string;
  barberFilter: string;
  busyBookingId: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onBarberFilterChange: (value: string) => void;
  onAction: (booking: ReceptionBooking, action: 'cancel' | 'no_show') => void;
}

const statusLabels: Record<ReceptionBooking['status'], string> = {
  waiting: 'Waiting',
  called: 'Called',
  in_service: 'In Service',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

function ReceptionQueueTable({
  bookings,
  barbers,
  now,
  search,
  statusFilter,
  barberFilter,
  busyBookingId,
  onSearchChange,
  onStatusFilterChange,
  onBarberFilterChange,
  onAction,
}: ReceptionQueueTableProps) {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      !normalizedSearch ||
      booking.customerName.toLocaleLowerCase().includes(normalizedSearch) ||
      booking.token.toLocaleLowerCase().includes(normalizedSearch);
    const matchesStatus = !statusFilter || booking.status === statusFilter;
    const matchesBarber =
      !barberFilter ||
      (barberFilter === 'unassigned'
        ? booking.assignedBarberId === null
        : booking.assignedBarberId === barberFilter);

    return matchesSearch && matchesStatus && matchesBarber;
  });

  return (
    <section
      aria-labelledby="waiting-queue-title"
      className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]"
    >
      <div className="flex flex-col gap-5 border-b border-white/[0.08] p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.19em] text-gold">
            Live list
          </p>
          <h2
            className="mt-2 font-serif text-2xl text-cream"
            id="waiting-queue-title"
          >
            Waiting queue
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            In arrival order · {filteredBookings.length} shown
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="sr-only" htmlFor="queue-search">
            Search by customer or token
          </label>
          <input
            className="min-w-0 rounded-xl border border-white/10 bg-charcoal-deep px-3.5 py-2.5 text-xs text-cream outline-none transition placeholder:text-stone-600 focus:border-gold/60 sm:min-w-48"
            id="queue-search"
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search name or token"
            value={search}
          />
          <label className="sr-only" htmlFor="queue-status-filter">
            Filter by queue status
          </label>
          <select
            className="rounded-xl border border-white/10 bg-charcoal-deep px-3.5 py-2.5 text-xs text-stone-300 outline-none focus:border-gold/60"
            id="queue-status-filter"
            onChange={(event) => onStatusFilterChange(event.currentTarget.value)}
            value={statusFilter}
          >
            <option value="">All statuses</option>
            <option value="waiting">Waiting</option>
            <option value="called">Called</option>
            <option value="in_service">In service</option>
          </select>
          <label className="sr-only" htmlFor="queue-barber-filter">
            Filter by barber
          </label>
          <select
            className="rounded-xl border border-white/10 bg-charcoal-deep px-3.5 py-2.5 text-xs text-stone-300 outline-none focus:border-gold/60"
            id="queue-barber-filter"
            onChange={(event) => onBarberFilterChange(event.currentTarget.value)}
            value={barberFilter}
          >
            <option value="">All barbers</option>
            <option value="unassigned">Unassigned</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.13em] text-stone-500">
              <th className="px-5 py-4 font-medium">Token</th>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Services</th>
              <th className="px-5 py-4 font-medium">Preferred barber</th>
              <th className="px-5 py-4 font-medium">Wait</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filteredBookings.map((booking) => {
              const waitingMinutes = Math.max(
                0,
                booking.status === 'waiting'
                  ? Math.floor((now.getTime() - Date.parse(booking.createdAt)) / 60_000)
                  : booking.waitingMinutes,
              );
              const isLongWait =
                booking.status === 'waiting' && waitingMinutes > 60;
              const isWaiting = booking.status === 'waiting';

              return (
                <tr
                  className={`transition hover:bg-white/[0.025] ${
                    isLongWait ? 'bg-amber-400/[0.045]' : ''
                  }`}
                  key={booking.id}
                >
                  <td className="whitespace-nowrap px-5 py-4 font-serif text-lg text-gold-light">
                    {booking.token}
                  </td>
                  <td className="px-5 py-4">
                    <p className="whitespace-nowrap text-sm text-cream">
                      {booking.customerName}
                    </p>
                  </td>
                  <td className="max-w-56 px-5 py-4 text-xs leading-5 text-stone-300">
                    {booking.serviceNames.join(' · ')}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-stone-400">
                    {booking.preferredBarberName}
                  </td>
                  <td
                    className={`whitespace-nowrap px-5 py-4 text-xs ${
                      isLongWait ? 'font-semibold text-amber-200' : 'text-stone-400'
                    }`}
                  >
                    {waitingMinutes} min
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                        booking.status === 'waiting'
                          ? 'border-gold/25 bg-gold/[0.07] text-gold-light'
                          : booking.status === 'in_service'
                            ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
                            : 'border-sky-300/15 bg-sky-300/[0.05] text-sky-200'
                      }`}
                    >
                      {statusLabels[booking.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {isWaiting ? (
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-amber-200/20 px-3 py-2 text-[10px] font-medium text-amber-100 transition hover:border-amber-200/50 disabled:opacity-50"
                          disabled={busyBookingId === booking.id}
                          onClick={() => onAction(booking, 'no_show')}
                          type="button"
                        >
                          No-show
                        </button>
                        <button
                          className="rounded-full border border-rose-200/20 px-3 py-2 text-[10px] font-medium text-rose-100 transition hover:border-rose-200/50 disabled:opacity-50"
                          disabled={busyBookingId === booking.id}
                          onClick={() => onAction(booking, 'cancel')}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-stone-600">
                        Actions only available while waiting
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredBookings.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="font-serif text-xl text-cream">
            {bookings.length === 0 ? 'The queue is clear' : 'No matching customers'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">
            {bookings.length === 0
              ? 'New walk-ins will appear here in the order they join.'
              : 'Try a different search term or adjust your filters.'}
          </p>
        </div>
      )}
    </section>
  );
}

export default ReceptionQueueTable;
