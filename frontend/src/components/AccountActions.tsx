import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardPath } from './ProtectedRoute';

const roleLabel = {
  OWNER: 'Owner',
  RECEPTIONIST: 'Reception',
  BARBER: 'Barber',
  CUSTOMER: 'Customer',
} as const;

function AccountActions() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <Link
        className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium text-stone-300 transition hover:border-gold/60 hover:text-gold-light"
        to="/login"
      >
        Sign in
      </Link>
    );
  }

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-stone-300 transition hover:border-gold/40 hover:text-gold-light"
        to={dashboardPath(user.role, user.barberId, user.activeQueueId)}
      >
        {roleLabel[user.role]}
      </Link>
      <button
        className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-stone-300 transition hover:border-rose-200/30 hover:text-rose-100 disabled:opacity-50"
        disabled={busy}
        onClick={() => void signOut()}
        type="button"
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span className="text-[10px] text-rose-100" role="alert">{error}</span>}
    </div>
  );
}

export default AccountActions;
