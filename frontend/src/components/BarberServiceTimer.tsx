import { useEffect, useState } from 'react';

interface BarberServiceTimerProps {
  generatedAt: string;
  serviceStartedAt: string;
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function BarberServiceTimer({
  generatedAt,
  serviceStartedAt,
}: BarberServiceTimerProps) {
  const [monotonicTime, setMonotonicTime] = useState(() => performance.now());
  const [serverTime, setServerTime] = useState(() => Date.parse(generatedAt));
  const [anchorTime, setAnchorTime] = useState(() => performance.now());

  useEffect(() => {
    setServerTime(Date.parse(generatedAt));
    setAnchorTime(performance.now());
  }, [generatedAt, serviceStartedAt]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setMonotonicTime(performance.now()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (serverTime + monotonicTime - anchorTime - Date.parse(serviceStartedAt)) /
        1000,
    ),
  );

  return (
    <div
      aria-label={`Service elapsed time ${formatElapsed(elapsedSeconds)}`}
      className="mt-5 rounded-2xl border border-gold/20 bg-charcoal-deep/70 px-4 py-4 text-center"
      role="timer"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        Service time
      </p>
      <p className="mt-2 font-mono text-3xl tracking-[0.12em] text-gold-light tabular-nums sm:text-4xl">
        {formatElapsed(elapsedSeconds)}
      </p>
    </div>
  );
}

export default BarberServiceTimer;
