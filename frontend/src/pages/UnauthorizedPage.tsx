import { Link } from 'react-router-dom';

function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-charcoal px-5 text-cream">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Access restricted
        </p>
        <h1 className="mt-3 font-serif text-3xl">You can&apos;t open this page</h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          This account does not have permission to access the requested workspace.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full border border-gold/40 px-5 py-3 text-xs font-medium text-gold-light transition hover:bg-gold/[0.07]"
          to="/"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}

export default UnauthorizedPage;
