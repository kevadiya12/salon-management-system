import type { BookingStatus } from './reception';

export type QueueStatus =
  | 'waiting'
  | 'second-in-line'
  | 'called'
  | 'in-service'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export const queueStatusMessages: Record<QueueStatus, string> = {
  waiting:
    'You are in the queue. Please relax while we prepare for your service.',
  'second-in-line': "You're almost up! Start coming to the salon.",
  called: "It's your turn! Please proceed to your assigned barber.",
  'in-service': 'Your service has started. Enjoy your experience!',
  completed: 'Your service is complete. Thank you for visiting us!',
  cancelled: 'Your queue entry has been cancelled.',
  'no-show': 'Your queue entry was marked as no-show.',
};

export interface QueueEntryStatus {
  id: string;
  token: string;
  customerName: string;
  serviceNames: string[];
  serviceDurationMinutes: number;
  totalPriceRupees: number;
  status: BookingStatus;
  createdAt: string;
  serviceStartedAt: string | null;
  preferredBarberId: string | null;
  preferredBarberName: string;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  position: number | null;
  customersAhead: number;
  estimatedWaitMinutes: number | null;
}
