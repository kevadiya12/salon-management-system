import type { SalonService } from '../types/queue';
import type { ReceptionBarber, ReceptionOverview } from '../types/reception';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function getData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !result.success) {
    throw new Error(
      result.message ?? `The request failed with HTTP ${response.status}.`,
    );
  }
  return result.data;
}

export function fetchSalonServices(
  signal?: AbortSignal,
): Promise<SalonService[]> {
  return getData('/api/services', signal);
}

export function fetchSalonBarbers(
  signal?: AbortSignal,
): Promise<Array<Pick<ReceptionBarber, 'id' | 'name' | 'photoUrl' | 'status'>>> {
  return getData('/api/barbers', signal);
}

export function fetchQueueOverview(
  signal?: AbortSignal,
): Promise<{ queueOpen: boolean; overview: ReceptionOverview }> {
  return getData('/api/queue', signal);
}
