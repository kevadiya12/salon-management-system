import type { AuthUser, CustomerRegistration } from '../types/auth';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !result.success || result.data === undefined) {
    if (
      response.status === 401 &&
      !['/login', '/register', '/me', '/logout'].includes(path)
    ) {
      window.dispatchEvent(new Event('salon-auth-expired'));
    }
    throw new Error(
      result.message ?? `The request failed with HTTP ${response.status}.`,
    );
  }
  return result.data;
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/me', { signal });
  return result.user;
}

export async function loginUser(
  identifier: string,
  password: string,
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  return result.user;
}

export async function registerCustomer(
  account: CustomerRegistration,
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>('/register', {
    method: 'POST',
    body: JSON.stringify(account),
  });
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await request<unknown>('/logout', { method: 'POST' });
}
