import { Link } from 'react-router-dom';
import type { HomepageCopy } from '../types/homepage';
import type { ReceptionOverview } from '../types/reception';
import SectionHeading from './SectionHeading';

interface QueuePreviewSectionProps {
  copy: HomepageCopy['queue'];
  queue: { queueOpen: boolean; overview: ReceptionOverview } | null;
  loading: boolean;
  error: string | null;
}

function QueuePreviewSection({ copy, queue, loading, error }: QueuePreviewSectionProps) {
  const queueStatus = loading
    ? 'Checking live queue'
    : error
      ? 'Queue status unavailable'
      : queue?.queueOpen
        ? 'Queue open'
        : 'Queue closed';

  return (
    <section
      aria-labelledby="queue-preview-title"
      className="mx-auto grid max-w-7xl gap-10 px-6 py-20 sm:px-10 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-12"
      id="queue-preview"
    >
      <SectionHeading
        description={copy.description}
        eyebrow={copy.eyebrow}
        id="queue-preview-title"
        title={copy.title}
      />

      <div className="rounded-3xl border border-white/10 bg-charcoal-raised p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-300">
              {copy.previewLabel}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
              {queueStatus}
            </div>
          </div>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-sm text-gold"
          >
            —
          </span>
        </div>

        <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
          {queue ? (
            <>
              <p className="font-serif text-5xl text-gold-light">
                {queue.overview.waiting}
              </p>
              <p className="mt-2 text-sm font-medium text-stone-200">
                customers currently waiting
              </p>
              <p className="mt-3 text-xs leading-5 text-stone-500">
                {queue.overview.availableBarbers} barbers available ·{' '}
                {queue.overview.inService} currently in service
              </p>
            </>
          ) : (
            <>
              <div
                aria-hidden="true"
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold/25"
              >
                <span className="h-2 w-2 rounded-full bg-gold/70" />
              </div>
              <p className="max-w-sm text-sm font-medium text-stone-200">
                {error ? 'Live queue information is unavailable.' : copy.emptyTitle}
              </p>
              <p className="mt-2 max-w-sm text-xs leading-5 text-stone-500">
                {error ? 'Please try again later.' : copy.emptyDescription}
              </p>
            </>
          )}
        </div>

        <div className="border-t border-white/[0.08] pt-4">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-gold-light transition hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            to="/status"
          >
            {copy.statusLink}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default QueuePreviewSection;
