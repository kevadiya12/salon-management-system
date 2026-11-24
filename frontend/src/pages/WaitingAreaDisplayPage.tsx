import { useCallback, useEffect, useRef, useState } from 'react';
import SalonBrand from '../components/SalonBrand';
import { salonConfig } from '../config/salon';
import { fetchDisplayQueue, type DisplayQueueData, type DisplayQueueEntry } from '../services/displayApi';
import { socket } from '../services/socket';

interface QueueCallEvent {
  eventId?: unknown;
  token?: unknown;
}

function playCallTone(): void {
  if (typeof window.AudioContext === 'undefined') return;

  const context = new window.AudioContext();
  void context
    .resume()
    .then(() => {
      if (context.state !== 'running') {
        void context.close();
        return;
      }

      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      volume.gain.setValueAtTime(0.0001, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.04);
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.onended = () => {
        void context.close();
      };
      oscillator.start();
      oscillator.stop(context.currentTime + 0.68);
    })
    .catch((error: unknown) => {
      void context.close();
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        console.error('Unable to play the queue call notification.', error);
      }
    });
}

function BarberLabel({ name }: { name: string | null }) {
  return <>{name ?? 'Barber to be assigned'}</>;
}

function QueueTokenCard({
  booking,
  position,
  called,
}: {
  booking: DisplayQueueEntry;
  position: number;
  called?: boolean;
}) {
  return (
    <article
      className={`flex min-w-0 items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
        called
          ? 'salon-call-highlight border-gold/70 bg-gold/[0.12]'
          : 'border-white/[0.08] bg-white/[0.025]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="w-7 shrink-0 text-center text-sm font-medium tabular-nums text-stone-500">
          {String(position).padStart(2, '0')}
        </span>
        <span className="truncate font-serif text-3xl tracking-wide text-cream sm:text-4xl">
          {booking.token}
        </span>
      </div>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-medium text-stone-200 sm:text-base">
          <BarberLabel name={booking.assignedBarberName} />
        </p>
        <p className="mt-1 truncate text-xs text-stone-500 sm:text-sm">
          {booking.serviceNames.join(' · ')}
        </p>
      </div>
    </article>
  );
}

function WaitingAreaDisplayPage() {
  const [dashboard, setDashboard] = useState<DisplayQueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [calledToken, setCalledToken] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const seenCallEvents = useRef(new Set<string>());
  const callNoticeTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const result = await fetchDisplayQueue(controller.signal);
      if (!controller.signal.aborted) {
        setDashboard(result);
        setApiError(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setApiError(
          error instanceof Error
            ? error.message
            : 'The live queue could not be loaded.',
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('queue:subscribe');
      void refresh();
    };
    const handleDisconnect = () => setSocketConnected(false);
    const handleConnectError = () => setSocketConnected(false);
    const handleQueueUpdate = () => {
      void refresh();
    };
    const handleQueueCall = (event: unknown) => {
      if (typeof event !== 'object' || event === null) return;
      const payload = event as QueueCallEvent;
      if (typeof payload.token !== 'string') return;
      if (
        typeof payload.eventId === 'string' &&
        seenCallEvents.current.has(payload.eventId)
      ) {
        return;
      }

      if (typeof payload.eventId === 'string') {
        seenCallEvents.current.add(payload.eventId);
        if (seenCallEvents.current.size > 32) {
          const [oldestEventId] = seenCallEvents.current;
          if (oldestEventId) seenCallEvents.current.delete(oldestEventId);
        }
      }

      setCalledToken(payload.token);
      if (callNoticeTimer.current !== null) {
        window.clearTimeout(callNoticeTimer.current);
      }
      callNoticeTimer.current = window.setTimeout(
        () => setCalledToken(null),
        8_000,
      );
      playCallTone();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('queue:updated', handleQueueUpdate);
    socket.on('queue:called', handleQueueCall);
    void refresh();
    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    const refreshTimer = window.setInterval(() => void refresh(), 30_000);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('queue:updated', handleQueueUpdate);
      socket.off('queue:called', handleQueueCall);
      socket.disconnect();
      window.clearInterval(refreshTimer);
      if (callNoticeTimer.current !== null) {
        window.clearTimeout(callNoticeTimer.current);
      }
      activeRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const waitingBookings = dashboard?.waiting ?? [];
  const activeBookings = dashboard?.active ?? [];
  const currentBooking = dashboard?.nowServing ?? null;
  const otherActiveBookings = currentBooking
    ? activeBookings.filter((booking) => booking.id !== currentBooking.id)
    : [];
  const nextBookings = dashboard?.upNext ?? [];
  const additionalBookings = waitingBookings.slice(3);
  const nextEstimatedWaitMinutes = nextBookings[0]?.estimatedWaitMinutes;

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(currentTime);
  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(currentTime);

  return (
    <main className="min-h-screen overflow-hidden bg-charcoal-deep text-cream">
      <div className="salon-display-glow pointer-events-none fixed inset-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1900px] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-14 lg:py-9">
        <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-white/[0.08] pb-6 sm:pb-7">
          <SalonBrand variant="display" />

          <div className="flex flex-wrap items-center gap-x-7 gap-y-3 sm:gap-x-10">
            <div className="hidden text-right sm:block">
              <p className="text-sm text-stone-400">{formattedDate}</p>
              <p className="mt-1 font-serif text-2xl tabular-nums text-cream">
                {formattedTime}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
              </span>
              <span className="text-xs font-semibold tracking-[0.18em] text-gold-light sm:text-sm">
                LIVE QUEUE
              </span>
            </div>
            <div
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-stone-400 sm:text-sm"
              title={
                socketConnected
                  ? 'Live updates connected'
                  : 'Live updates reconnecting'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  socketConnected ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              {socketConnected ? 'Connected' : 'Reconnecting'}
            </div>
          </div>
          <div className="w-full text-sm text-stone-400 sm:hidden">
            {formattedDate} · <span className="tabular-nums">{formattedTime}</span>
          </div>
        </header>

        {apiError && (
          <div
            aria-live="assertive"
            className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-5 py-3 text-sm text-rose-100"
            role="alert"
          >
            Live queue data is temporarily unavailable: {apiError}
            <span className="ml-2 text-rose-100/70">
              Retrying automatically.
            </span>
          </div>
        )}

        {loading && !dashboard ? (
          <section
            aria-label="Loading live queue"
            className="flex flex-1 items-center justify-center py-24"
          >
            <div className="text-center">
              <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-2 border-gold/25 border-t-gold" />
              <p className="mt-5 text-sm tracking-wide text-stone-400">
                Connecting to the live queue…
              </p>
            </div>
          </section>
        ) : !dashboard ? (
          <section
            aria-live="polite"
            className="flex flex-1 items-center justify-center py-24 text-center"
          >
            <div className="max-w-xl rounded-3xl border border-white/[0.08] bg-white/[0.025] px-8 py-12 sm:px-14">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                Queue status
              </p>
              <h1 className="mt-4 font-serif text-4xl text-cream sm:text-5xl">
                Queue currently unavailable
              </h1>
              <p className="mt-4 leading-7 text-stone-400">
                We’re having trouble reaching the salon queue. This display will
                update automatically when the connection is restored.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="mb-6 mt-7 flex flex-wrap items-end justify-between gap-3 sm:mt-9">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
                  Welcome
                </p>
                <h1 className="mt-2 font-serif text-3xl text-cream sm:text-4xl lg:text-5xl">
                  Your moment starts here.
                </h1>
              </div>
              <p className="text-sm text-stone-400">
                {waitingBookings.length}{' '}
                {waitingBookings.length === 1 ? 'guest' : 'guests'} waiting
              </p>
            </div>

            <div className="grid flex-1 content-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] lg:gap-6">
              <section
                aria-labelledby="now-serving-title"
                className="salon-display-card relative overflow-hidden rounded-[1.75rem] border border-gold/30 p-6 sm:p-9 lg:min-h-[370px] lg:p-11"
              >
                <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-gold/[0.08]" />
                <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border border-gold/[0.08]" />
                <div className="relative flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-light sm:text-sm"
                      id="now-serving-title"
                    >
                      Now serving
                    </p>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-stone-300 sm:text-xs">
                      {currentBooking?.status === 'called'
                        ? 'Please proceed'
                        : currentBooking
                          ? 'In service'
                          : 'Awaiting next guest'}
                    </span>
                  </div>

                  {currentBooking ? (
                    <>
                      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
                        <div>
                          <p className="font-serif text-7xl leading-none tracking-tight text-cream sm:text-8xl lg:text-9xl">
                            {currentBooking.token}
                          </p>
                          {calledToken === currentBooking.token && (
                            <p
                              aria-live="assertive"
                              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-charcoal"
                              role="status"
                            >
                              <span aria-hidden="true">✦</span>
                              Your barber is ready
                            </p>
                          )}
                        </div>
                        <div className="pb-1 text-left sm:text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                            Your barber
                          </p>
                          <p className="mt-2 font-serif text-2xl text-cream sm:text-3xl">
                            <BarberLabel name={currentBooking.assignedBarberName} />
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.12] pt-5 sm:pt-6">
                        <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                          Service
                        </p>
                        <p className="text-base text-stone-200 sm:text-lg">
                          {currentBooking.serviceNames.join(' · ')}
                        </p>
                      </div>
                      {otherActiveBookings.length > 0 && (
                        <div className="mt-5 border-t border-white/[0.08] pt-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                            Also in service
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                            {otherActiveBookings.map((booking) => (
                              <p
                                className="text-sm text-stone-300"
                                key={booking.id}
                              >
                                <span className="font-semibold text-gold-light">
                                  {booking.token}
                                </span>{' '}
                                · <BarberLabel name={booking.assignedBarberName} />
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                      <span className="font-serif text-6xl text-gold/50">
                        {salonConfig.name.charAt(0).toLocaleUpperCase()}
                      </span>
                      <p className="mt-4 font-serif text-3xl text-cream sm:text-4xl">
                        No one is being served
                      </p>
                      <p className="mt-2 text-sm text-stone-400">
                        Your barber will call the next token shortly.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section
                aria-labelledby="up-next-title"
                className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7 lg:p-8"
              >
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                      Get ready
                    </p>
                    <h2
                      className="mt-2 font-serif text-3xl text-cream sm:text-4xl"
                      id="up-next-title"
                    >
                      Up next
                    </h2>
                  </div>
                  <p className="pb-1 text-xs text-stone-500">The next three</p>
                </div>

                {nextBookings.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    {nextBookings.map((booking, index) => (
                      <QueueTokenCard
                        booking={booking}
                        key={booking.id}
                        position={index + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-white/[0.1] px-5 py-10 text-center">
                    <p className="font-serif text-2xl text-stone-300">
                      No one in line
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      New queue tokens will appear here.
                    </p>
                  </div>
                )}
              </section>

              <section
                aria-labelledby="waiting-queue-title"
                className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7 lg:col-span-2 lg:p-8"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                      Queue order
                    </p>
                    <h2
                      className="mt-2 font-serif text-3xl text-cream sm:text-4xl"
                      id="waiting-queue-title"
                    >
                      Waiting queue
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500">
                    Tokens are called in order
                  </p>
                </div>

                {waitingBookings.length > 0 ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {waitingBookings.map((booking, index) => (
                      <QueueTokenCard
                        booking={booking}
                        called={booking.token === calledToken}
                        key={booking.id}
                        position={index + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-2xl border border-dashed border-white/[0.1] px-5 py-7 text-center text-sm text-stone-500">
                    The waiting queue is empty.
                  </p>
                )}
                {additionalBookings.length > 0 && (
                  <p className="mt-4 text-xs text-stone-500">
                    Showing all {waitingBookings.length} waiting tokens in queue
                    order.
                  </p>
                )}
              </section>
            </div>

            <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-5 sm:mt-8">
              <div>
                <p className="font-serif text-base text-stone-400 sm:text-lg">
                  Thank you for choosing {salonConfig.name}.
                </p>
                {(salonConfig.address || salonConfig.contactNumber) && (
                  <p className="mt-2 text-xs text-stone-600">
                    {[salonConfig.address, salonConfig.contactNumber]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {nextEstimatedWaitMinutes !== null &&
                  nextEstimatedWaitMinutes !== undefined && (
                    <p className="text-xs text-stone-500">
                      Estimated wait for next guest:{' '}
                      <span className="text-stone-300">
                        {nextEstimatedWaitMinutes} min
                      </span>
                    </p>
                  )}
                {dashboard.queueOpen === false && (
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                    Queue currently closed to new guests
                  </p>
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

export default WaitingAreaDisplayPage;
