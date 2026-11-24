import { Link } from 'react-router-dom';
import { salonConfig } from '../config/salon';
import type { HomepageCopy } from '../types/homepage';

interface SiteFooterProps {
  copy: HomepageCopy['footer'];
  navCopy: HomepageCopy['nav'];
}

function SiteFooter({ copy, navCopy }: SiteFooterProps) {
  return (
    <footer className="border-t border-white/[0.08] bg-charcoal-deep">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-9 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-12">
        <div>
          <Link
            className="font-semibold tracking-[0.16em] text-cream transition hover:text-gold-light"
            to="/"
          >
            {salonConfig.name} <span className="text-gold">QUEUE</span>
          </Link>
          <p className="mt-2 text-sm text-stone-500">{copy.tagline}</p>
          {(salonConfig.address || salonConfig.contactNumber) && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
              {salonConfig.address && <p>{salonConfig.address}</p>}
              {salonConfig.contactNumber && (
                <a
                  className="transition hover:text-gold-light"
                  href={`tel:${salonConfig.contactNumber.replace(/[^\d+]/g, '')}`}
                >
                  {salonConfig.contactNumber}
                </a>
              )}
            </div>
          )}
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-stone-400"
        >
          <Link className="transition hover:text-gold-light" to="/">
            {navCopy.home}
          </Link>
          <Link className="transition hover:text-gold-light" to="/join">
            {navCopy.join}
          </Link>
          <Link className="transition hover:text-gold-light" to="/status">
            {navCopy.status}
          </Link>
        </nav>

        <p className="text-xs text-stone-600">
          © {new Date().getFullYear()} {salonConfig.name} Queue. {copy.copyright}
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
