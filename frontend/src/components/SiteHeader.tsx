import { useState } from 'react';
import { Link } from 'react-router-dom';
import SalonBrand from './SalonBrand';
import AccountActions from './AccountActions';
import { salonConfig } from '../config/salon';
import type { HomepageCopy, Language } from '../types/homepage';

interface SiteHeaderProps {
  copy: HomepageCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

interface LanguageSelectProps {
  id: string;
  label: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

function LanguageSelect({
  id,
  label,
  language,
  onLanguageChange,
}: LanguageSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-400">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="cursor-pointer rounded-full border border-white/15 bg-charcoal px-3 py-2 text-xs text-stone-200 outline-none transition hover:border-gold/60 focus-visible:ring-2 focus-visible:ring-gold"
        id={id}
        onChange={(event) =>
          onLanguageChange(event.currentTarget.value === 'gu' ? 'gu' : 'en')
        }
        value={language}
      >
        <option value="en">English</option>
        <option value="gu">ગુજરાતી</option>
      </select>
    </label>
  );
}

function SiteHeader({
  copy,
  language,
  onLanguageChange,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-charcoal/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-4 sm:px-10 lg:px-12">
        <Link
          aria-label={`${salonConfig.name} Queue home`}
          className="group flex shrink-0 items-center gap-3"
          onClick={closeMenu}
          to="/"
        >
          <SalonBrand />
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 lg:flex"
        >
          <Link
            className="text-sm text-stone-300 transition hover:text-gold-light"
            onClick={closeMenu}
            to="/"
          >
            {copy.nav.home}
          </Link>
          <a
            className="text-sm text-stone-300 transition hover:text-gold-light"
            href="#how-it-works"
            onClick={closeMenu}
          >
            {copy.nav.howItWorks}
          </a>
          <a
            className="text-sm text-stone-300 transition hover:text-gold-light"
            href="#services"
            onClick={closeMenu}
          >
            {copy.nav.services}
          </a>
          <Link
            className="text-sm text-stone-300 transition hover:text-gold-light"
            onClick={closeMenu}
            to="/status"
          >
            {copy.nav.status}
          </Link>
          <Link
            className="rounded-full border border-gold/60 px-4 py-2.5 text-sm font-medium text-gold-light transition hover:bg-gold hover:text-charcoal"
            onClick={closeMenu}
            to="/join"
          >
            {copy.nav.join}
          </Link>
          <LanguageSelect
            id="desktop-language"
            label={copy.nav.language}
            language={language}
            onLanguageChange={onLanguageChange}
          />
          <AccountActions />
        </nav>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? copy.nav.closeMenu : copy.nav.openMenu}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full border border-white/15 text-cream transition hover:border-gold/60 lg:hidden"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
          type="button"
        >
          <span
            className={`h-px w-4 bg-current transition-transform ${
              menuOpen ? 'translate-y-[4px] rotate-45' : ''
            }`}
          />
          <span
            className={`h-px w-4 bg-current transition-opacity ${
              menuOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`h-px w-4 bg-current transition-transform ${
              menuOpen ? '-translate-y-[6px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {menuOpen && (
        <div
          className="border-t border-white/[0.08] bg-charcoal px-6 pb-6 pt-3 lg:hidden"
          id="mobile-navigation"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col">
            <Link
              className="border-b border-white/[0.07] py-3 text-sm text-stone-200"
              onClick={closeMenu}
              to="/"
            >
              {copy.nav.home}
            </Link>
            <a
              className="border-b border-white/[0.07] py-3 text-sm text-stone-200"
              href="#how-it-works"
              onClick={closeMenu}
            >
              {copy.nav.howItWorks}
            </a>
            <a
              className="border-b border-white/[0.07] py-3 text-sm text-stone-200"
              href="#services"
              onClick={closeMenu}
            >
              {copy.nav.services}
            </a>
            <Link
              className="border-b border-white/[0.07] py-3 text-sm text-stone-200"
              onClick={closeMenu}
              to="/status"
            >
              {copy.nav.status}
            </Link>
            <Link
              className="py-3 text-sm font-medium text-gold-light"
              onClick={closeMenu}
              to="/join"
            >
              {copy.nav.join}
            </Link>
          </nav>
          <div className="mt-2">
            <LanguageSelect
              id="mobile-language"
              label={copy.nav.language}
              language={language}
              onLanguageChange={onLanguageChange}
            />
          </div>
          <div className="mt-4">
            <AccountActions />
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
