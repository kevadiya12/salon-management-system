import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CancelQueueModal from '../components/CancelQueueModal';
import AccountActions from '../components/AccountActions';
import SalonBrand from '../components/SalonBrand';
import QueueStatusBanner from '../components/QueueStatusBanner';
import WaitEstimate from '../components/WaitEstimate';
import { salonConfig } from '../config/salon';
import {
  checkQueueStatusAvailability,
  requestQueueCancellation,
  type QueueStatusAvailability,
} from '../services/queueStatusApi';
import { socket } from '../services/socket';
import type { BookingStatus } from '../types/reception';
import type { QueueStatus } from '../types/queueStatus';

type StatusPageState = { kind: 'loading' } | QueueStatusAvailability;

function statusForDisplay(
  status: BookingStatus,
  position: number | null,
): QueueStatus {
  if (status === 'waiting' && position === 2) return 'second-in-line';
  if (status === 'in_service') return 'in-service';
  if (status === 'no_show') return 'no-show';
  return status;
}

function QueueStatusPage() {
  const { id } = useParams<{ id: string }>();
  const bookingId = id ?? '';
  const [lookup, setLookup] = useState<StatusPageState>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const seenSocketUpdates = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    setLookup((current) =>
      current.kind === 'loaded' ? current : { kind: 'loading' },
    );
    void checkQueueStatusAvailability(bookingId, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted && result.kind !== 'aborted') {
          setLookup(result);
        }
      },
    );
    return () => controller.abort();
  }, [bookingId, retryCount]);

  useEffect(() => {
    if (!bookingId.trim()) return;

    const handleConnect = () => {
      setSocketConnected(true);
      setSocketError(null);
      socket.emit('queue:booking:subscribe', bookingId);
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setSocketError(
        'Live updates disconnected. The connection will retry automatically.',
      );
    };
    const handleConnectError = () => {
      setSocketConnected(false);
      setSocketError(
        'Live updates are unavailable. Reconnection will be attempted.',
      );
    };
    const handleQueueUpdate = (event: unknown) => {
      if (typeof event !== 'object' || event === null) return;
      const payload = event as { eventId?: unknown; queueEntryId?: unknown };
      if (
        typeof payload.eventId !== 'string' ||
        payload.queueEntryId !== bookingId ||
        seenSocketUpdates.current.has(payload.eventId)
      ) {
        return;
      }
      seenSocketUpdates.current.add(payload.eventId);
      if (seenSocketUpdates.current.size > 64) {
        const [oldestEventId] = seenSocketUpdates.current;
        if (oldestEventId) seenSocketUpdates.current.delete(oldestEventId);
      }
      setRetryCount((count) => count + 1);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('queue:updated', handleQueueUpdate);
    socket.connect();
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('queue:updated', handleQueueUpdate);
      socket.disconnect();
    };
  }, [bookingId]);

  const handleCancelConfirm = async () => {
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      const data = await requestQueueCancellation(bookingId);
      setLookup({ kind: 'loaded', data });
      setCancelDialogOpen(false);
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? `Cancellation failed: ${error.message}`
          : 'Cancellation failed. Your queue entry has not been changed.',
      );
    } finally {
      setCancelSubmitting(false);
    }
  };

  const entry = lookup.kind === 'loaded' ? lookup.data : null;
  const displayStatus = entry
    ? statusForDisplay(entry.status, entry.position)
    : undefined;
  const lookupMessage =
    lookup.kind === 'loading'
      ? 'Loading your queue details from the salon.'
      : lookup.kind === 'aborted'
        ? 'Status lookup was interrupted. Retry to check again.'
        : lookup.kind === 'loaded'
          ? undefined
          : lookup.message;

  return (
    <main className="relative isolate min-h-screen bg-charcoal text-cream">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link
            aria-label={`${salonConfig.name} Queue home`}
            className="flex items-center gap-3"
            to="/"
          >
            <SalonBrand />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/60 hover:text-gold-light sm:text-sm"
            to="/"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>
          <AccountActions />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-9 sm:px-8 sm:pb-20 sm:pt-12 lg:px-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
              Personal queue
            </p>
            <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              My Queue Status
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
              Check your confirmed booking, queue position, and estimated wait.
            </p>
          </div>
          <button
            className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/50 hover:text-gold-light disabled:cursor-wait disabled:opacity-50"
            disabled={lookup.kind === 'loading'}
            onClick={() => setRetryCount((count) => count + 1)}
            type="button"
          >
            {lookup.kind === 'loading' ? 'Checking…' : 'Refresh status'}
          </button>
        </div>

        <QueueStatusBanner message={lookupMessage} status={displayStatus} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            <section
              aria-labelledby="token-title"
              className="overflow-hidden rounded-3xl border border-gold/20 bg-charcoal-raised p-6 sm:p-8"
            >
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                    Your token
                  </p>
                  <h2
                    className="mt-2 font-serif text-6xl tracking-tight text-cream sm:text-7xl"
                    id="token-title"
                  >
                    {entry?.token ?? '—'}
                  </h2>
                  <p className="mt-2 text-xs text-stone-500">
                    {entry
                      ? `Booking created ${new Date(entry.createdAt).toLocaleString('en-IN')}`
                      : 'Your token appears here after your booking is verified.'}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/10 px-3 py-2 text-xs capitalize text-stone-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {displayStatus?.replaceAll('-', ' ') ??
                    (lookup.kind === 'loading' ? 'Verifying' : 'Unavailable')}
                </span>
              </div>
            </section>

            <section
              aria-labelledby="booking-details-title"
              className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Booking details
              </p>
              <h2
                className="mt-2 font-serif text-2xl text-cream"
                id="booking-details-title"
              >
                Your visit
              </h2>
              <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {[
                  ['Customer name', entry?.customerName ?? 'Unavailable'],
                  ['Selected services', entry?.serviceNames.join(', ') ?? 'Unavailable'],
                  ['Assigned barber', entry?.assignedBarberName ?? 'Not assigned yet'],
                  [
                    'Service duration',
                    entry ? `${entry.serviceDurationMinutes} minutes` : 'Unavailable',
                  ],
                ].map(([label, value]) => (
                  <div className="border-t border-white/[0.08] pt-3" key={label}>
                    <dt className="text-xs text-stone-500">{label}</dt>
                    <dd className="mt-1.5 text-sm text-stone-300">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section
              aria-labelledby="position-title"
              className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-7"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Queue position
              </p>
              <h2
                className="mt-2 font-serif text-2xl text-cream"
                id="position-title"
              >
                Your place in line
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
                {[
                  ['Current position', entry?.position?.toString() ?? '—'],
                  ['Customers ahead', entry?.customersAhead.toString() ?? '—'],
                  [
                    'Estimated wait',
                    entry?.estimatedWaitMinutes === null ||
                    entry?.estimatedWaitMinutes === undefined
                      ? '—'
                      : `${entry.estimatedWaitMinutes} min`,
                  ],
                ].map(([label, value]) => (
                  <div
                    className="rounded-xl border border-white/[0.08] bg-charcoal-deep/60 p-4"
                    key={label}
                  >
                    <p className="text-xs leading-5 text-stone-500">{label}</p>
                    <p className="mt-2 font-serif text-2xl text-stone-300">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {entry?.status === 'waiting' && (
              <button
                className="rounded-full border border-rose-200/25 px-5 py-3 text-sm font-medium text-rose-100 transition hover:border-rose-200/50 hover:bg-rose-100/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                onClick={() => {
                  setCancelError(null);
                  setCancelDialogOpen(true);
                }}
                type="button"
              >
                Cancel My Spot
              </button>
            )}
          </div>

          <aside className="space-y-5">
            <WaitEstimate estimatedMinutes={entry?.estimatedWaitMinutes ?? null} />
            <section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                Live updates
              </p>
              <p className="mt-3 text-sm font-medium text-stone-200">
                {socketConnected ? 'Connected' : 'Not connected'}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {socketConnected
                  ? 'Your queue status updates automatically.'
                  : socketError ??
                    'Live updates are temporarily unavailable. Refresh to check your status.'}
              </p>
            </section>
            <p className="px-1 text-xs leading-5 text-stone-600">
              Your contact number is not displayed on this page.
            </p>
          </aside>
        </div>
      </div>

      <CancelQueueModal
        error={cancelError}
        isSubmitting={cancelSubmitting}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        open={cancelDialogOpen}
      />
    </main>
  );
}

export default QueueStatusPage;
