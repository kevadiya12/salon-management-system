import type {
  DashboardMutation,
  DashboardUpdate,
  BarberDashboard,
  ReceptionDashboard,
  WalkInRequest,
} from '../types/reception';

interface ApiErrorResponse {
  success?: false;
  message?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/reception${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const body = await response.text();
  let result: T & ApiErrorResponse;
  try {
    result = JSON.parse(body) as T & ApiErrorResponse;
  } catch {
    if (!response.ok) {
      throw new Error(`The request failed with HTTP ${response.status}.`);
    }
    throw new Error('The server returned an invalid JSON response.');
  }

  if (!response.ok) {
    throw new Error(
      result.message ?? `The request failed with HTTP ${response.status}.`,
    );
  }

  return result;
}

export async function fetchReceptionDashboard(
  signal?: AbortSignal,
): Promise<ReceptionDashboard> {
  const result = await requestJson<{
    success: true;
    data: ReceptionDashboard;
  }>('/dashboard', { signal });
  return result.data;
}

export async function fetchBarberDashboard(
  barberId: string,
  signal?: AbortSignal,
): Promise<BarberDashboard> {
  const result = await requestJson<{
    success: true;
    data: BarberDashboard;
  }>(`/barbers/${encodeURIComponent(barberId)}/dashboard`, { signal });
  return result.data;
}

export function createWalkIn(
  request: WalkInRequest,
): Promise<DashboardMutation<{ id: string; token: string }>> {
  return requestJson('/walk-ins', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function createBarber(
  name: string,
): Promise<DashboardMutation<{ id: string }>> {
  return requestJson('/barbers', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateBarberAvailability(
  barberId: string,
  status: 'available' | 'on_break',
): Promise<DashboardUpdate> {
  return requestJson(`/barbers/${encodeURIComponent(barberId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateQueueState(open: boolean): Promise<DashboardUpdate> {
  return requestJson('/queue', {
    method: 'PATCH',
    body: JSON.stringify({ open }),
  });
}

export function callNextCustomer(
  barberId: string,
): Promise<DashboardMutation<{ id: string; token: string }>> {
  return requestJson(`/barbers/${encodeURIComponent(barberId)}/call-next`, {
    method: 'POST',
  });
}

export function startCustomerService(
  bookingId: string,
  barberId: string,
): Promise<DashboardUpdate> {
  return requestJson(
    `/bookings/${encodeURIComponent(bookingId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify({ barberId }),
    },
  );
}

export function completeCustomerService(
  bookingId: string,
  barberId: string,
): Promise<DashboardUpdate> {
  return requestJson(
    `/bookings/${encodeURIComponent(bookingId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ barberId }),
    },
  );
}

export function cancelWaitingCustomer(
  bookingId: string,
): Promise<DashboardUpdate> {
  return requestJson(
    `/bookings/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' },
  );
}

export function markCustomerNoShow(
  bookingId: string,
): Promise<DashboardUpdate> {
  return requestJson(
    `/bookings/${encodeURIComponent(bookingId)}/no-show`,
    { method: 'POST' },
  );
}
