export interface SalonService {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceRupees: number;
  isActive?: boolean;
}

export interface QueueBookingRequest {
  customerName: string;
  phoneNumber: string;
  serviceIds: string[];
  barberId: string;
}

export type QueueBookingResult =
  | { status: 'success'; bookingId: string }
  | { status: 'unavailable'; message: string };

export interface QueueFormErrors {
  customerName?: string;
  phoneNumber?: string;
  services?: string;
  barber?: string;
}
