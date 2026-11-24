import type { QueueEntryStatus } from '../types/queueStatus';

export type QueueStatusAvailability =
  | { kind: 'loaded'; data: QueueEntryStatus }
  | { kind: 'invalid-link'; message: string }
  | { kind: 'not-found'; message: string }
  | { kind: 'server-unavailable'; message: string }
  | { kind: 'aborted' };

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

export async function checkQueueStatusAvailability(
  bookingId: string,
  signal?: AbortSignal,
): Promise<QueueStatusAvailability> {
  if (!bookingId.trim()) {
    return {
      kind: 'invalid-link',
      message: 'This queue link is missing a booking ID.',
    };
  }

  try {
    const response = await fetch(
      `/api/queue/${encodeURIComponent(bookingId)}/status`,
      { signal },
    );
    const result = (await response.json()) as ApiResponse<QueueEntryStatus>;
    if (response.status === 404) {
      return {
        kind: 'not-found',
        message: result.message ?? 'This queue entry could not be found.',
      };
    }
    if (!response.ok || !result.success || !result.data) {
      return {
        kind: 'server-unavailable',
        message:
          result.message ??
          `Queue status request failed with HTTP ${response.status}.`,
      };
    }
    return { kind: 'loaded', data: result.data };
  } catch (error) {
    if (signal?.aborted) return { kind: 'aborted' };
    return {
      kind: 'server-unavailable',
      message:
        error instanceof Error
          ? `Unable to reach the queue API. ${error.message}`
          : 'Unable to reach the queue API. Please try again.',
    };
  }
}

export async function requestQueueCancellation(
  bookingId: string,
): Promise<QueueEntryStatus> {
  if (!bookingId.trim()) {
    throw new Error('This queue link is missing a booking ID.');
  }
  const response = await fetch(
    `/api/queue/${encodeURIComponent(bookingId)}/cancel`,
    { method: 'POST' },
  );
  const result = (await response.json()) as ApiResponse<QueueEntryStatus>;
  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message ??
        `Cancellation request failed with HTTP ${response.status}.`,
    );
  }
  return result.data;
}
