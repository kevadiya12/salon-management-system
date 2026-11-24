import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/auth';

export function dashboardPath(
  role: UserRole,
  barberId: string | null,
  activeQueueId: string | null = null,
): string {
  if (role === 'OWNER') return '/admin';
  if (role === 'RECEPTIONIST') return '/reception';
  if (role === 'BARBER' && barberId) return `/barber/${encodeURIComponent(barberId)}`;
  if (role === 'CUSTOMER') {
    return activeQueueId
      ? `/status/${encodeURIComponent(activeQueueId)}`
      : '/join';
  }
  return '/unauthorized';
}

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  const params = useParams();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-charcoal px-5 text-cream">
        <p className="text-sm text-stone-400">Checking your secure session…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-charcoal px-5 text-cream">
        <p className="max-w-md text-center text-sm text-rose-100" role="alert">
          {error}
        </p>
      </main>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (
    user.role === 'BARBER' &&
    params['barberId'] !== undefined &&
    params['barberId'] !== user.barberId
  ) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
}

export function SignedInRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-charcoal text-stone-400">
        Checking your secure session…
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={dashboardPath(user.role, user.barberId, user.activeQueueId)}
      replace
    />
  );
}

export function QueueStatusRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.activeQueueId
    ? <Navigate to={`/status/${encodeURIComponent(user.activeQueueId)}`} replace />
    : <Navigate to="/join" replace />;
}
