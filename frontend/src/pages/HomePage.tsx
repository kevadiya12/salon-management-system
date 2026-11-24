import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroArtwork from '../components/HeroArtwork';
import HowItWorksSection from '../components/HowItWorksSection';
import QueuePreviewSection from '../components/QueuePreviewSection';
import ServicesSection from '../components/ServicesSection';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import type { Language } from '../types/homepage';
import type { SalonService } from '../types/queue';
import type { ReceptionOverview } from '../types/reception';
import {
  fetchQueueOverview,
  fetchSalonServices,
} from '../services/salonApi';
import { homepageCopy } from '../utils/homepageCopy';

function HomePage() {
  const [language, setLanguage] = useState<Language>('en');
  const [services, setServices] = useState<SalonService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [queue, setQueue] = useState<{
    queueOpen: boolean;
    overview: ReceptionOverview;
  } | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const copy = homepageCopy[language];

  useEffect(() => {
    const controller = new AbortController();
    void fetchSalonServices(controller.signal)
      .then(setServices)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setServicesError(
            error instanceof Error ? error.message : 'Services are unavailable.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setServicesLoading(false);
      });
    void fetchQueueOverview(controller.signal)
      .then(setQueue)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setQueueError(
            error instanceof Error
              ? error.message
              : 'Live queue information is unavailable.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setQueueLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-charcoal text-cream">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-cream focus:px-4 focus:py-2 focus:text-charcoal"
        href="#main-content"
      >
        {copy.skipToContent}
      </a>
      <SiteHeader
        copy={copy}
        language={language}
        onLanguageChange={setLanguage}
      />

      <main id="main-content">
        <section
          aria-labelledby="hero-title"
          className="relative isolate border-b border-white/[0.07]"
          id="home"
        >
          <div className="salon-hero-glow pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-16 sm:px-10 sm:pb-24 sm:pt-20 lg:min-h-[650px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:px-12 lg:py-12">
            <div className="max-w-2xl animate-fade-up">
              <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-gold sm:text-sm">
                <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
                {copy.hero.eyebrow}
              </p>
              <h1
                className="max-w-[13ch] font-serif text-5xl font-medium leading-[1.08] tracking-[-0.035em] text-cream sm:text-6xl lg:text-7xl"
                id="hero-title"
              >
                {copy.hero.title}
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-stone-300 sm:text-lg sm:leading-8">
                {copy.hero.description}
              </p>
              <div className="mt-9 flex flex-col gap-3 min-[420px]:flex-row">
                <Link
                  className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-charcoal transition duration-200 hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                  to="/join"
                >
                  {copy.hero.join}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-cream transition duration-200 hover:border-gold/70 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                  to="/status"
                >
                  {copy.hero.status}
                </Link>
              </div>
              <p className="mt-7 text-xs tracking-wide text-stone-500">
                {copy.hero.note}
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[540px] animate-fade-up lg:justify-self-end">
              <div
                aria-hidden="true"
                className="absolute -right-2 top-10 h-24 w-24 rounded-full border border-gold/15 sm:-right-5 sm:top-16 sm:h-32 sm:w-32"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-2 left-4 h-20 w-20 rounded-full border border-white/10 sm:bottom-4 sm:left-0 sm:h-28 sm:w-28"
              />
              <HeroArtwork label={copy.hero.artLabel} />
              <div className="absolute bottom-5 left-5 max-w-[210px] rounded-2xl border border-white/10 bg-charcoal/90 px-4 py-3 shadow-2xl backdrop-blur sm:bottom-10 sm:left-0 sm:px-5 sm:py-4">
                <span className="mb-2 block h-px w-8 bg-gold" />
                <p className="text-xs leading-5 text-stone-200 sm:text-sm">
                  {copy.hero.artCaption}
                </p>
              </div>
            </div>
          </div>
        </section>

        <HowItWorksSection copy={copy.steps} />
        <ServicesSection
          copy={copy.services}
          error={servicesError}
          loading={servicesLoading}
          services={services}
        />
        <QueuePreviewSection
          copy={copy.queue}
          error={queueError}
          loading={queueLoading}
          queue={queue}
        />
      </main>

      <SiteFooter copy={copy.footer} navCopy={copy.nav} />
    </div>
  );
}

export default HomePage;
