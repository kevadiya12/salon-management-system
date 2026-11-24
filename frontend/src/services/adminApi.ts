import type {
  OwnerBarber,
  OwnerDashboardData,
  OwnerSettings,
  OwnerStatistics,
  StaffAccount,
  StaffAccountInput,
} from '../types/admin';
import type { SalonService } from '../types/queue';
import type { BarberStatus } from '../types/reception';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let result: ApiResponse<T>;
  try {
    result = JSON.parse(text) as ApiResponse<T>;
  } catch {
    if (!response.ok) {
      throw new Error(`The request failed with HTTP ${response.status}.`);
    }
    throw new Error('The server returned an invalid JSON response.');
  }
  if (!response.ok || !result.success) {
    throw new Error(
      result.message ?? `The request failed with HTTP ${response.status}.`,
    );
  }
  return result.data;
}

export async function fetchOwnerDashboard(): Promise<OwnerDashboardData> {
  const [settings, statistics, services, barbers] = await Promise.all([
    request<OwnerSettings>('/owner/settings'),
    request<OwnerStatistics>('/owner/statistics'),
    request<SalonService[]>('/owner/services?includeInactive=true'),
    request<OwnerBarber[]>('/owner/barbers'),
  ]);
  return { settings, statistics, services, barbers };
}

export function updateOwnerSettings(
  settings: OwnerSettings,
): Promise<OwnerSettings> {
  return request('/owner/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

export function createOwnerService(
  service: Omit<SalonService, 'id'>,
): Promise<SalonService> {
  return request('/owner/services', {
    method: 'POST',
    body: JSON.stringify(service),
  });
}

export function updateOwnerService(
  serviceId: string,
  service: Omit<SalonService, 'id'>,
): Promise<SalonService> {
  return request(`/owner/services/${encodeURIComponent(serviceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(service),
  });
}

export function createOwnerBarber(input: {
  name: string;
  photoUrl: string | null;
}): Promise<OwnerBarber> {
  return request('/owner/barbers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOwnerBarber(
  barberId: string,
  input: { name: string; photoUrl: string | null; isActive: boolean },
): Promise<OwnerBarber> {
  return request(`/owner/barbers/${encodeURIComponent(barberId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateOwnerBarberStatus(
  barberId: string,
  status: Exclude<BarberStatus, 'busy'>,
): Promise<OwnerBarber> {
  return request(`/owner/barbers/${encodeURIComponent(barberId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function fetchStaffAccounts(): Promise<StaffAccount[]> {
  return request('/owner/users');
}

export function createStaffAccount(
  input: Required<Pick<StaffAccountInput, 'name' | 'email' | 'password' | 'role'>> &
    Pick<StaffAccountInput, 'username' | 'barberId'>,
): Promise<StaffAccount> {
  return request('/owner/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateStaffAccount(
  userId: string,
  input: StaffAccountInput,
): Promise<StaffAccount> {
  return request(`/owner/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
