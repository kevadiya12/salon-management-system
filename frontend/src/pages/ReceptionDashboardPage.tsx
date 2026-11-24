import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddBarberModal from '../components/AddBarberModal';
import ReceptionActionModal from '../components/ReceptionActionModal';
import ReceptionBarberCard from '../components/ReceptionBarberCard';
import ReceptionMetricCard from '../components/ReceptionMetricCard';
import ReceptionQueueTable from '../components/ReceptionQueueTable';
import SalonBrand from '../components/SalonBrand';
import AccountActions from '../components/AccountActions';
import WalkInModal from '../components/WalkInModal';
import {
  callNextCustomer,
  cancelWaitingCustomer,
  completeCustomerService,
  createBarber,
  createWalkIn,
  fetchReceptionDashboard,
  markCustomerNoShow,
  startCustomerService,
  updateBarberAvailability,
  updateQueueState,
} from '../services/receptionApi';
import { socket } from '../services/socket';
import { salonConfig } from '../config/salon';
import type {
  DashboardUpdate,
  ReceptionBooking,
  ReceptionDashboard,
  WalkInRequest,
} from '../types/reception';

type QueueAction = 'cancel' | 'no_show';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function ReceptionDashboardPage() {
  const [dashboard, setDashboard] = useState<ReceptionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [barberFilter, setBarberFilter] = useState('');
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [addBarberOpen, setAddBarberOpen] = useState(false);
  const [queueAction, setQueueAction] = useState<{
    booking: ReceptionBooking;
    action: QueueAction;
  } | null>(null);
  const [queueActionError, setQueueActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true, signal?: AbortSignal) => {
    if (showLoading) setLoading(true);
    setPageError(null);
    try {
      const result = await fetchReceptionDashboard(signal);
      if (!signal?.aborted) setDashboard(result);
    } catch (error) {
      if (!signal?.aborted) setPageError(getErrorMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(
      () => void refresh(true, controller.signal),
      0,
    );

    const handleConnect = () => {
      setSocketConnected(true);
      setSocketError(null);
      socket.emit('reception:subscribe');
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setSocketError('Live updates disconnected. The dashboard will reconnect automatically.');
    };
    const handleConnectError = () => {
      setSocketConnected(false);
      setSocketError('Live updates are unavailable. Reconnection will be attempted.');
    };
    const handleDashboardUpdate = () => {
      void refresh(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('queue:updated', handleDashboardUpdate);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('queue:updated', handleDashboardUpdate);
      window.clearTimeout(loadTimer);
      controller.abort();
      socket.disconnect();
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runDashboardUpdate = useCallback(
    async (
      actionKey: string,
      operation: Promise<DashboardUpdate>,
      successMessage: string,
    ) => {
      setBusyAction(actionKey);
      setPageError(null);
      try {
        const result = await operation;
        setDashboard(result.dashboard);
        setToast(successMessage);
      } catch (error) {
        setPageError(getErrorMessage(error));
        throw error;
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const handleWalkInSubmit = async (request: WalkInRequest) => {
    setPageError(null);
    const result = await createWalkIn(request);
    setDashboard(result.dashboard);
    setToast(`Walk-in added · ${result.data.token}`);
  };

  const handleAddBarber = async (name: string) => {
    setPageError(null);
    const result = await createBarber(name);
    setDashboard(result.dashboard);
    setToast(`${name} added to the roster`);
  };

  const handleQueueActionConfirm = async () => {
    if (!queueAction) return;
    const { booking, action } = queueAction;
    setQueueActionError(null);
    setBusyAction(booking.id);
    try {
      const request =
        action === 'cancel'
          ? cancelWaitingCustomer(booking.id)
          : markCustomerNoShow(booking.id);
      const result = await request;
      setDashboard(result.dashboard);
      setToast(
        action === 'cancel'
          ? `${booking.token} cancelled`
          : `${booking.token} marked No-show`,
      );
      setQueueAction(null);
    } catch (error) {
      setQueueActionError(getErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  };

  const isInitialLoading = loading && !dashboard;
  const formattedDateTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(currentTime),
    [currentTime],
  );

  return (
    <main className="min-h-screen bg-charcoal text-cream">
      <header className="border-b border-white/[0.08] bg-charcoal-deep/80">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Link aria-label={`${salonConfig.name} Queue home`} className="flex items-center gap-3" to="/">
              <SalonBrand />
            </Link>
            <span className="hidden h-8 border-l border-white/10 sm:block" />
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-cream">Reception Dashboard</p>
              <p className="mt-1 text-[10px] text-stone-500">Salon operations</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <time className="hidden text-xs text-stone-400 md:block">
              {formattedDateTime}
            </time>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] ${
                dashboard?.queueOpen
                  ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
                  : 'border-rose-200/20 bg-rose-200/[0.06] text-rose-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  dashboard?.queueOpen ? 'bg-emerald-300' : 'bg-rose-200'
                }`}
              />
              {dashboard ? (dashboard.queueOpen ? 'Queue Open' : 'Queue Closed') : 'Queue —'}
            </span>
            {dashboard && (
              <button
                className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-stone-300 transition hover:border-gold/40 hover:text-gold-light disabled:opacity-50"
                disabled={busyAction === 'queue'}
                onClick={() =>
                  void runDashboardUpdate(
                    'queue',
                    updateQueueState(!dashboard.queueOpen),
                    dashboard.queueOpen
                      ? 'Queue closed · new walk-ins paused'
                      : 'Queue opened · walk-ins can join',
                  ).catch(() => undefined)
                }
                type="button"
              >
                {dashboard.queueOpen ? 'Close queue' : 'Open queue'}
              </button>
            )}
            <button
              className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-stone-300 transition hover:border-gold/40 hover:text-gold-light disabled:cursor-wait disabled:opacity-50"
              disabled={loading}
              onClick={() => void refresh()}
              type="button"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link
              className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-stone-300 transition hover:border-gold/40 hover:text-gold-light"
              to="/"
            >
              Back to site
            </Link>
            <AccountActions />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 pb-16 pt-8 sm:px-7 sm:pt-10 lg:px-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
              Salon operations
            </p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
              Reception Dashboard
            </h1>
            <p className="mt-3 text-xs text-stone-500 sm:text-sm">
              {formattedDateTime} · Manage today&apos;s queue and barber flow
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-gold px-6 py-3.5 text-xs font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50 md:self-auto"
            disabled={!dashboard?.queueOpen || isInitialLoading}
            onClick={() => setWalkInOpen(true)}
            type="button"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            Add Walk-in
          </button>
        </div>

        {pageError && (
          <div
            className="mt-7 flex flex-col gap-3 rounded-2xl border border-rose-200/20 bg-rose-200/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <div>
              <p className="text-sm font-medium text-rose-100">
                {dashboard ? 'Dashboard update failed' : 'Dashboard unavailable'}
              </p>
              <p className="mt-1 text-xs leading-5 text-rose-100/70">{pageError}</p>
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

        {!dashboard && loading && (
          <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-12 text-center text-sm text-stone-400">
            Loading live salon data…
          </div>
        )}

        {dashboard && (
          <>
            <section aria-label="Queue overview" className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ReceptionMetricCard
                accent
                detail="Customers awaiting a barber"
                label="Waiting"
                value={dashboard.overview.waiting}
              />
              <ReceptionMetricCard
                detail="Service currently underway"
                label="In service"
                value={dashboard.overview.inService}
              />
              <ReceptionMetricCard
                detail="Ready to receive a customer"
                label="Available barbers"
                value={dashboard.overview.availableBarbers}
              />
              <ReceptionMetricCard
                detail="Completed today"
                label="Customers served"
                value={dashboard.overview.servedToday}
              />
            </section>

            <section aria-labelledby="barber-status-heading" className="mt-10">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                    Team
                  </p>
                  <h2 className="mt-2 font-serif text-2xl text-cream" id="barber-status-heading">
                    Barber status
                  </h2>
                </div>
                <button
                  className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/45 hover:text-gold-light"
                  onClick={() => setAddBarberOpen(true)}
                  type="button"
                >
                  + Add barber
                </button>
              </div>

              {dashboard.barbers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-9 text-center">
                  <p className="font-serif text-xl text-cream">No barbers in the roster</p>
                  <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-stone-500">
                    Add your real salon team to enable availability tracking and Call Next. No sample barbers are displayed.
                  </p>
                  <button
                    className="mt-5 rounded-full border border-gold/35 px-5 py-2.5 text-xs font-medium text-gold-light transition hover:bg-gold/[0.07]"
                    onClick={() => setAddBarberOpen(true)}
                    type="button"
                  >
                    Add first barber
                  </button>
                </div>
              ) : (
                <>
                  {dashboard.overview.availableBarbers === 0 && (
                    <p className="mb-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-xs text-amber-100/80">
                      No barbers are available right now. Waiting customers will remain in the queue until a barber is available.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {dashboard.barbers.map((barber) => (
                      <ReceptionBarberCard
                        barber={barber}
                        busyAction={busyAction === barber.id}
                        key={barber.id}
                        now={currentTime}
                        onAvailabilityChange={(status) =>
                          void runDashboardUpdate(
                            barber.id,
                            updateBarberAvailability(barber.id, status),
                            status === 'on_break'
                              ? `${barber.name} marked On Break`
                              : `${barber.name} marked Available`,
                          ).catch(() => undefined)
                        }
                        onCallNext={() => {
                          setBusyAction(barber.id);
                          setPageError(null);
                          void callNextCustomer(barber.id)
                            .then((result) => {
                              setDashboard(result.dashboard);
                              setToast(`${result.data.token} called for ${barber.name}`);
                            })
                            .catch((error: unknown) =>
                              setPageError(getErrorMessage(error)),
                            )
                            .finally(() => setBusyAction(null));
                        }}
                        onCompleteService={() => {
                          if (!barber.currentBookingId) return;
                          void runDashboardUpdate(
                            barber.id,
                            completeCustomerService(barber.currentBookingId, barber.id),
                            `${barber.currentCustomerName ?? 'Customer'} service completed`,
                          ).catch(() => undefined);
                        }}
                        onStartService={() => {
                          if (!barber.currentBookingId) return;
                          void runDashboardUpdate(
                            barber.id,
                            startCustomerService(barber.currentBookingId, barber.id),
                            `${barber.currentCustomerName ?? 'Customer'} service started`,
                          ).catch(() => undefined);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>

            {!dashboard.queueOpen && (
              <p className="mt-8 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-xs text-amber-100/80">
                Queue is closed. New walk-ins are paused; existing waiting customers can still be served.
              </p>
            )}

            {socketError && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3">
                <p className="text-xs text-amber-100/80">{socketError}</p>
                <button
                  className="text-xs font-medium text-gold-light underline decoration-gold/40 underline-offset-4"
                  onClick={() => {
                    setSocketError(null);
                    socket.connect();
                  }}
                  type="button"
                >
                  Reconnect
                </button>
              </div>
            )}
            <p className="mt-3 text-right text-[10px] text-stone-600">
              {socketConnected ? 'Live updates connected' : 'Live updates disconnected'}
            </p>

            <section className="mt-8">
              <ReceptionQueueTable
                barberFilter={barberFilter}
                barbers={dashboard.barbers}
                bookings={dashboard.bookings}
                busyBookingId={busyAction}
                now={currentTime}
                onAction={(booking, action) => {
                  setQueueActionError(null);
                  setQueueAction({ booking, action });
                }}
                onBarberFilterChange={setBarberFilter}
                onSearchChange={setSearch}
                onStatusFilterChange={setStatusFilter}
                search={search}
                statusFilter={statusFilter}
              />
            </section>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] text-stone-600">
              <p>
                Queue order is FIFO. A barber receives the oldest Waiting customer preferring Any barber or that barber.
              </p>
              <p>Dashboard snapshot · {new Date(dashboard.generatedAt).toLocaleTimeString('en-IN')}</p>
            </div>
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

      {dashboard && (
        <>
          <WalkInModal
            dashboard={dashboard}
            onClose={() => setWalkInOpen(false)}
            onSubmit={handleWalkInSubmit}
            open={walkInOpen}
          />
          <AddBarberModal
            onClose={() => setAddBarberOpen(false)}
            onSubmit={handleAddBarber}
            open={addBarberOpen}
          />
        </>
      )}

      <ReceptionActionModal
        action={queueAction?.action ?? null}
        booking={queueAction?.booking ?? null}
        busy={busyAction === queueAction?.booking.id}
        error={queueActionError}
        onClose={() => {
          setQueueAction(null);
          setQueueActionError(null);
        }}
        onConfirm={() => void handleQueueActionConfirm()}
      />
    </main>
  );
}

export default ReceptionDashboardPage;
