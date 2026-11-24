interface WaitEstimateProps {
  estimatedMinutes: number | null;
}

function WaitEstimate({ estimatedMinutes }: WaitEstimateProps) {
  const available = estimatedMinutes !== null;

  return (
    <section
      aria-label={
        available
          ? `Estimated wait: about ${estimatedMinutes} minutes`
          : 'Estimated wait unavailable'
      }
      className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 text-center sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
        Estimated wait
      </p>
      <div className="relative mx-auto mt-5 flex h-36 w-36 items-center justify-center">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 144 144"
        >
          <circle
            cx="72"
            cy="72"
            fill="none"
            r="62"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2"
          />
          {available && (
            <circle
              cx="72"
              cy="72"
              fill="none"
              r="62"
              stroke="rgb(var(--salon-gold-rgb))"
              strokeDasharray="390"
              strokeDashoffset="95"
              strokeLinecap="round"
              strokeWidth="2"
            />
          )}
        </svg>
        <div>
          <span className="block font-serif text-4xl text-cream">
            {available ? estimatedMinutes : '—'}
          </span>
          <span className="mt-1 block text-xs text-stone-500">minutes</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-500">
        {available
          ? 'An estimate, not an exact countdown.'
          : 'Estimate unavailable until live queue data is provided.'}
      </p>
    </section>
  );
}

export default WaitEstimate;
