import { Link } from 'react-router-dom';
import { homepageCopy } from '../utils/homepageCopy';

interface RoutePlaceholderProps {
  title: string;
}

function RoutePlaceholder({ title }: RoutePlaceholderProps) {
  const copy = homepageCopy.en.placeholder;

  return (
    <main className="flex min-h-screen items-center justify-center bg-charcoal px-6 py-16 text-center text-cream">
      <div className="max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">
          {copy.eyebrow}
        </p>
        <h1 className="mt-5 font-serif text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-stone-400">
          {copy.description}
        </p>
        <Link
          className="mt-8 inline-flex rounded-full border border-gold/50 px-5 py-3 text-sm font-medium text-gold-light transition hover:bg-gold hover:text-charcoal"
          to="/"
        >
          {copy.back}
        </Link>
      </div>
    </main>
  );
}

export default RoutePlaceholder;
