import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BarberServiceTimer from '../components/BarberServiceTimer';
import CompleteBarberServiceModal from '../components/CompleteBarberServiceModal';
import SalonBrand from '../components/SalonBrand';
import AccountActions from '../components/AccountActions';
import { salonConfig } from '../config/salon';
import {
  completeCustomerService,
  fetchBarberDashboard,
  startCustomerService,
  updateBarberAvailability,
} from '../services/receptionApi';
import { socket } from '../services/socket';
import type { BarberDashboard } from '../types/reception';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed. Please try again.';
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function BarberViewPage() {
  const { barberId = '' } = useParams<{ barberId: string }>();
  const validBarberId = uuidPattern.test(barberId);
  const [dashboard, setDashboard] = useState<BarberDashboard | null>(null);
  const [loading, setLoading] = useState(validBarberId);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshPending = useRef(false);
  const seenSocketUpdates = useRef(new Set<string>());

  const refresh = useCallback((signal?: AbortSignal) => {
    if (!validBarberId) return Promise.resolve();
    if (refreshInFlight.current) {
      refreshPending.current = true;
      return refreshInFlight.current;
    }

    const request = (async () => {
      setLoading(true);
      setPageError(null);
      try {
        const result = await fetchBarberDashboard(barberId, signal);
        if (!signal?.aborted) setDashboard(result);
      } catch (error) {
        if (!signal?.aborted) setPageError(getErrorMessage(error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    })();
    refreshInFlight.current = request;

    return request.finally(() => {
      if (refreshInFlight.current === request) {
        refreshInFlight.current = null;
        if (refreshPending.current) {
          refreshPending.current = false;
          if (!signal?.aborted) void refresh();
        }
      }
    });
  }, [barberId, validBarberId]);

  useEffect(() => {
    if (!validBarberId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void refresh(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refresh, validBarberId]);

  useEffect(() => {
    if (!validBarberId) return;

    const handleConnect = () => {
      setSocketConnected(true);
      setSocketError(null);
      socket.emit('barber:subscribe', barberId);
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
        'Live updates are unavailable. The connection will retry automatically.',
      );
    };
    const handleBarberUpdate = (event: unknown) => {
      if (typeof event !== 'object' || event === null) return;
      const updateId = (event as { eventId?: unknown }).eventId;
      if (typeof updateId !== 'string' || seenSocketUpdates.current.has(updateId)) {
        return;
      }
      seenSocketUpdates.current.add(updateId);
      if (seenSocketUpdates.current.size > 64) {
        const [oldestUpdate] = seenSocketUpdates.current;
        if (oldestUpdate) seenSocketUpdates.current.delete(oldestUpdate);
      }
      void refresh();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('barber:updated', handleBarberUpdate);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('barber:updated', handleBarberUpdate);
      socket.disconnect();
    };
  }, [barberId, refresh, validBarberId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentCustomer = dashboard?.currentCustomer ?? null;
  const formattedDateTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(clockNow),
    [clockNow],
  );

  const handleStartService = async () => {
    if (
      !dashboard ||
      !currentCustomer ||
      currentCustomer.status !== 'called' ||
      dashboard.barber.status !== 'busy'
    ) {
      setPageError('There is no eligible assigned customer to start.');
      return;
    }

    setBusyAction('start');
    setPageError(null);
    try {
      const result = await startCustomerService(currentCustomer.id, barberId);
      if (result.barberDashboard) {
        setDashboard(result.barberDashboard);
      } else {
        await refresh();
      }
      setToast(`${currentCustomer.token} service started`);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAvailabilityChange = async (
    status: 'available' | 'on_break',
  ) => {
    if (!dashboard) return;
    setBusyAction('availability');
    setPageError(null);
    try {
      const result = await updateBarberAvailability(barberId, status);
      if (result.barberDashboard) {
        setDashboard(result.barberDashboard);
      } else {
        await refresh();
      }
      setToast(
        status === 'on_break' ? 'You are now On Break' : 'You are now Available',
      );
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCompleteService = async () => {
    if (!currentCustomer || currentCustomer.status !== 'in_service') {
      setPageError('There is no active service to complete.');
      return;
    }

    setBusyAction('complete');
    setPageError(null);
    try {
      const result = await completeCustomerService(currentCustomer.id, barberId);
      if (result.barberDashboard) {
        setDashboard(result.barberDashboard);
      } else {
        await refresh();
      }
      setCompleteDialogOpen(false);
      setToast(`${currentCustomer.token} service completed`);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  if (!validBarberId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-charcoal px-5 text-cream">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Barber workspace
          </p>
          <h1 className="mt-3 font-serif text-3xl">Invalid barber link</h1>
          <p className="mt-3 text-sm leading-6 text-stone-400">
            This link does not contain a valid barber ID. Ask reception for your
            personal Barber View link.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full border border-gold/40 px-5 py-3 text-xs font-medium text-gold-light transition hover:bg-gold/[0.07]"
            to="/reception"
          >
            Back to reception
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-charcoal text-cream">
      <header className="border-b border-white/[0.08] bg-charcoal-deep/75">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-7">
          <Link aria-label={`${salonConfig.name} Queue home`} className="flex items-center gap-3" to="/">
            <SalonBrand />
          </Link>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-gold">
              Barber View
            </p>
            <time className="mt-1 block text-[10px] text-stone-500">
              {formattedDateTime}
            </time>
          </div>
          <AccountActions />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-7 sm:pt-9">
        {!dashboard && loading && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-12 text-center text-sm text-stone-400">
            Loading your barber workspace…
          </div>
        )}

        {pageError && (
          <div
            className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200/20 bg-rose-200/[0.05] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <div>
              <p className="text-sm font-medium text-rose-100">
                {pageError === 'Barber not found.'
                  ? 'Barber not found'
                  : 'Could not update your workspace'}
              </p>
              <p className="mt-1 text-xs leading-5 text-rose-100/70">
                {pageError}
              </p>
            </div>
            <button
              className="self-start rounded-full border border-rose-100/20 px-4 py-2 text-xs text-rose-100 hover:border-rose-100/40 sm:self-auto"
              onClick={() => void refresh()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {dashboard && (
          <>
            <section className="flex flex-col gap-4 rounded-3xl border border-white/[0.09] bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                {dashboard.barber.photoUrl ? (
                  <img
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                    src={dashboard.barber.photoUrl}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-charcoal-raised font-serif text-lg text-gold-light"
                  >
                    {getInitials(dashboard.barber.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
                    Your station
                  </p>
                  <h1 className="mt-1 truncate font-serif text-2xl text-cream sm:text-3xl">
                    {dashboard.barber.name}
                  </h1>
                  <span
                    className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] ${
                      dashboard.barber.status === 'available'
                        ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
                        : dashboard.barber.status === 'on_break'
                          ? 'border-white/10 bg-white/[0.04] text-stone-400'
                          : 'border-gold/25 bg-gold/[0.07] text-gold-light'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {dashboard.barber.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {dashboard.barber.status === 'available' ? (
                <button
                  className="min-h-12 rounded-full border border-white/15 px-5 py-3 text-xs font-medium text-stone-200 transition hover:border-gold/50 hover:text-gold-light disabled:cursor-wait disabled:opacity-50"
                  disabled={
                    busyAction === 'availability' || Boolean(currentCustomer)
                  }
                  onClick={() => void handleAvailabilityChange('on_break')}
                  type="button"
                >
                  {busyAction === 'availability' ? 'Updating…' : 'Take a Break'}
                </button>
              ) : dashboard.barber.status === 'on_break' ? (
                <button
                  className="min-h-12 rounded-full bg-gold px-5 py-3 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
                  disabled={busyAction === 'availability'}
                  onClick={() => void handleAvailabilityChange('available')}
                  type="button"
                >
                  {busyAction === 'availability' ? 'Updating…' : 'Return to Available'}
                </button>
              ) : (
                <button
                  className="min-h-12 cursor-not-allowed rounded-full border border-white/10 px-5 py-3 text-xs font-medium text-stone-500"
                  disabled
                  title="Finish the current customer before changing availability."
                  type="button"
                >
                  Busy · Availability locked
                </button>
              )}
            </section>

            {currentCustomer ? (
              <section
                aria-labelledby="current-customer-title"
                className="mt-5 overflow-hidden rounded-3xl border border-gold/25 bg-charcoal-raised shadow-xl shadow-black/20"
              >
                <div className="border-b border-white/[0.08] px-5 py-4 sm:px-7">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                    Current customer
                  </p>
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-serif text-5xl tracking-tight text-gold-light sm:text-6xl">
                        {currentCustomer.token}
                      </p>
                      <h2
                        className="mt-3 break-words font-serif text-2xl text-cream sm:text-3xl"
                        id="current-customer-title"
                      >
                        {currentCustomer.customerName}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        currentCustomer.status === 'in_service'
                          ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
                          : 'border-sky-300/20 bg-sky-300/[0.06] text-sky-200'
                      }`}
                    >
                      {currentCustomer.status === 'in_service'
                        ? 'In Service'
                        : 'Called'}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-charcoal-deep/60 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Selected services
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-200">
                        {currentCustomer.serviceNames.join(' · ')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-charcoal-deep/60 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Assigned duration
                      </p>
                      <p className="mt-2 text-sm text-stone-200">
                        {currentCustomer.serviceDurationMinutes} minutes
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-charcoal-deep/60 p-4 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                        Service start time
                      </p>
                      <p className="mt-2 text-sm text-stone-200">
                        {currentCustomer.serviceStartedAt
                          ? new Date(currentCustomer.serviceStartedAt).toLocaleTimeString(
                              'en-IN',
                              { hour: 'numeric', minute: '2-digit' },
                            )
                          : 'Not started yet'}
                      </p>
                    </div>
                  </div>

                  {currentCustomer.status === 'in_service' &&
                    currentCustomer.serviceStartedAt && (
                      <BarberServiceTimer
                        generatedAt={dashboard.generatedAt}
                        serviceStartedAt={currentCustomer.serviceStartedAt}
                      />
                    )}

                  {currentCustomer.status === 'called' ? (
                    <button
                      className="mt-6 min-h-14 w-full rounded-full bg-gold px-6 py-4 text-sm font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
                      disabled={busyAction === 'start'}
                      onClick={() => void handleStartService()}
                      type="button"
                    >
                      {busyAction === 'start' ? 'Starting…' : 'Start Service'}
                    </button>
                  ) : (
                    <button
                      className="mt-6 min-h-14 w-full rounded-full bg-gold px-6 py-4 text-sm font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
                      disabled={busyAction === 'complete'}
                      onClick={() => setCompleteDialogOpen(true)}
                      type="button"
                    >
                      Mark as Done
                    </button>
                  )}
                </div>
              </section>
            ) : (
              <section
                aria-label="Current customer"
                className="mt-5 rounded-3xl border border-white/[0.09] bg-white/[0.025] px-5 py-10 text-center sm:px-7 sm:py-14"
              >
                <span
                  aria-hidden="true"
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/25 font-serif text-xl text-gold"
                >
                  —
                </span>
                <h2 className="mt-4 font-serif text-2xl text-cream">
                  No active customer
                </h2>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">
                  Reception will assign your next customer when you are
                  available. The assignment will appear here automatically.
                </p>
              </section>
            )}

            <section
              aria-labelledby="next-customer-title"
              className="mt-5 rounded-3xl border border-white/[0.09] bg-white/[0.025] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                    Up next
                  </p>
                  <h2
                    className="mt-2 font-serif text-xl text-cream"
                    id="next-customer-title"
                  >
                    Next for you
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-stone-500">
                  FIFO
                </span>
              </div>

              {dashboard.nextCustomer ? (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-charcoal-deep/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="shrink-0 font-serif text-2xl text-gold-light">
                      {dashboard.nextCustomer.token}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-cream">
                        {dashboard.nextCustomer.customerName}
                      </p>
                      <p className="mt-1 truncate text-xs text-stone-500">
                        {dashboard.nextCustomer.serviceNames.join(' · ')}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-stone-400">
                    {dashboard.nextCustomer.serviceDurationMinutes} min
                  </p>
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-stone-500">
                  No customers waiting for you.
                </p>
              )}
            </section>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] px-4 py-3">
              <p
                className={`text-[10px] ${
                  socketConnected ? 'text-emerald-200' : 'text-amber-100/80'
                }`}
              >
                {socketConnected ? 'Live updates connected' : 'Live updates disconnected'}
              </p>
              <Link
                className="text-[10px] font-medium text-stone-400 transition hover:text-gold-light"
                to="/reception"
              >
                Reception dashboard
              </Link>
            </div>
            {socketError && (
              <p className="mt-3 text-xs text-amber-100/70" role="status">
                {socketError}
              </p>
            )}
          </>
        )}
      </div>

      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-gold/25 bg-charcoal-raised px-5 py-3 text-xs font-medium text-gold-light shadow-2xl"
          role="status"
        >
          {toast}
        </div>
      )}

      <CompleteBarberServiceModal
        busy={busyAction === 'complete'}
        customerName={currentCustomer?.customerName ?? null}
        onClose={() => setCompleteDialogOpen(false)}
        onConfirm={() => void handleCompleteService()}
        open={completeDialogOpen}
      />
    </main>
  );
}

export default BarberViewPage;
