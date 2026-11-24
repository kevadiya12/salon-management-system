import type { QueueBookingRequest, QueueBookingResult } from '../types/queue';

export async function requestQueueBooking(
  request: QueueBookingRequest,
): Promise<QueueBookingResult> {
  try {
    const response = await fetch('/api/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: request.customerName,
        phoneNumber: request.phoneNumber,
        serviceIds: request.serviceIds,
        preferredBarberId: request.barberId,
      }),
    });
    const result = (await response.json()) as {
      success?: boolean;
      data?: { id?: string };
      message?: string;
    };
    if (!response.ok || !result.success || !result.data?.id) {
      return {
        status: 'unavailable',
        message:
          result.message ??
          `Unable to join the queue (HTTP ${response.status}).`,
      };
    }

    return { status: 'success', bookingId: result.data.id };
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? `Unable to reach the queue API. ${error.message}`
          : 'Unable to reach the queue API. Your details have not been submitted.',
    };
  }
}
