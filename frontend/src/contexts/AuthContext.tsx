import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerCustomer,
} from '../services/authApi';
import type { AuthUser, CustomerRegistration } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  register: (account: CustomerRegistration) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCurrentUser(controller.signal)
      .then((currentUser) => {
        if (!controller.signal.aborted) {
          setUser(currentUser);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof Error && reason.message === 'Authentication is required.') {
          setUser(null);
          setError(null);
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not verify the current session.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setError(null);
    };
    window.addEventListener('salon-auth-expired', handleExpiredSession);
    return () => window.removeEventListener('salon-auth-expired', handleExpiredSession);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const authenticatedUser = await loginUser(identifier, password);
    setUser(authenticatedUser);
    setError(null);
    return authenticatedUser;
  }, []);

  const register = useCallback(async (account: CustomerRegistration) => {
    const authenticatedUser = await registerCustomer(account);
    setUser(authenticatedUser);
    setError(null);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout }),
    [user, loading, error, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
