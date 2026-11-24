import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import SalonBrand from '../components/SalonBrand';
import { dashboardPath } from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import { salonConfig } from '../config/salon';
import type { CustomerRegistration } from '../types/auth';

function LoginPage() {
  const { login, register, user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [registerMode, setRegisterMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [account, setAccount] = useState<CustomerRegistration>({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-charcoal text-stone-400">
        Checking your secure session…
      </main>
    );
  }
  if (user) {
    return (
      <Navigate
        to={dashboardPath(user.role, user.barberId, user.activeQueueId)}
        replace
      />
    );
  }

  const setRegistrationField = (
    field: keyof CustomerRegistration,
    value: string,
  ) => setAccount((current) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const user = registerMode
        ? await register(account)
        : await login(identifier.trim(), password);
      const from = (location.state as { from?: { pathname?: string } } | null)
        ?.from?.pathname;
      navigate(
        from && from !== '/login'
          ? from
          : dashboardPath(user.role, user.barberId, user.activeQueueId),
        {
        replace: true,
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Authentication could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-charcoal px-5 py-10 text-cream">
      <section className="w-full max-w-lg rounded-3xl border border-white/[0.09] bg-white/[0.025] p-6 shadow-2xl shadow-black/20 sm:p-9">
        <Link aria-label={`${salonConfig.name} home`} className="inline-flex" to="/">
          <SalonBrand />
        </Link>
        <p className="mt-9 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Secure account access
        </p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">
          {registerMode ? 'Create your customer account' : 'Welcome back'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">
          {registerMode
            ? 'Create an account to join the queue and view your own booking status.'
            : 'Sign in to continue to your salon workspace.'}
        </p>

        <form className="mt-8 space-y-5" noValidate onSubmit={submit}>
          {registerMode ? (
            <>
              <label className="block text-xs text-stone-300" htmlFor="register-name">
                Name
                <input
                  autoComplete="name"
                  className={inputClassName}
                  id="register-name"
                  maxLength={100}
                  onChange={(event) => setRegistrationField('name', event.currentTarget.value)}
                  required
                  value={account.name}
                />
              </label>
              <label className="block text-xs text-stone-300" htmlFor="register-email">
                Email
                <input
                  autoComplete="email"
                  className={inputClassName}
                  id="register-email"
                  onChange={(event) => setRegistrationField('email', event.currentTarget.value)}
                  required
                  type="email"
                  value={account.email}
                />
              </label>
              <label className="block text-xs text-stone-300" htmlFor="register-phone">
                Phone number
                <input
                  autoComplete="tel"
                  className={inputClassName}
                  id="register-phone"
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) => setRegistrationField('phoneNumber', event.currentTarget.value)}
                  required
                  type="tel"
                  value={account.phoneNumber}
                />
              </label>
              <label className="block text-xs text-stone-300" htmlFor="register-password">
                Password
                <input
                  autoComplete="new-password"
                  className={inputClassName}
                  id="register-password"
                  minLength={12}
                  onChange={(event) => setRegistrationField('password', event.currentTarget.value)}
                  required
                  type="password"
                  value={account.password}
                />
                <span className="mt-2 block text-[11px] text-stone-500">
                  Use at least 12 characters.
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs text-stone-300" htmlFor="login-identifier">
                Email or username
                <input
                  autoComplete="username"
                  className={inputClassName}
                  id="login-identifier"
                  onChange={(event) => setIdentifier(event.currentTarget.value)}
                  required
                  value={identifier}
                />
              </label>
              <label className="block text-xs text-stone-300" htmlFor="login-password">
                Password
                <input
                  autoComplete="current-password"
                  className={inputClassName}
                  id="login-password"
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
            </>
          )}

          {message && (
            <p className="rounded-xl border border-rose-200/20 bg-rose-200/[0.05] px-4 py-3 text-sm text-rose-100" role="alert">
              {message}
            </p>
          )}
          <button
            className="w-full rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-charcoal transition hover:bg-gold-light disabled:cursor-wait disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Please wait…' : registerMode ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          className="mt-5 text-left text-xs text-stone-400 transition hover:text-gold-light"
          onClick={() => {
            setRegisterMode((current) => !current);
            setMessage(null);
          }}
          type="button"
        >
          {registerMode
            ? 'Already have a customer account? Sign in'
            : 'New customer? Create an account'}
        </button>
      </section>
    </main>
  );
}

const inputClassName =
  'mt-2 block w-full rounded-xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-cream outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/10';

export default LoginPage;
