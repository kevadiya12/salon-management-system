export const receptionServices = [
  { id: 'haircut', name: 'Haircut', durationMinutes: 30, priceRupees: 150 },
  { id: 'beard-trim', name: 'Beard Trim', durationMinutes: 15, priceRupees: 80 },
  { id: 'hair-spa', name: 'Hair Spa', durationMinutes: 45, priceRupees: 400 },
] as const;

export type ReceptionServiceId = string;
export type BarberStatus = 'available' | 'busy' | 'on_break';
export type BookingStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface SalonServiceRecord {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceRupees: number;
  isActive: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalkInInput {
  customerName: string;
  phoneNumber: string;
  serviceIds: string[];
  preferredBarberId: string | null;
}

export interface ReceptionOverview {
  waiting: number;
  inService: number;
  availableBarbers: number;
  servedToday: number;
}

export interface ReceptionBarber {
  id: string;
  name: string;
  photoUrl: string | null;
  status: BarberStatus;
  isActive: boolean;
  currentBookingId: string | null;
  currentCustomerName: string | null;
  currentServiceNames: string[];
  currentBookingStatus: 'called' | 'in_service' | null;
  serviceStartedAt: string | null;
  currentServiceDurationMinutes: number | null;
  estimatedRemainingMinutes: number | null;
}

export interface ReceptionBooking {
  id: string;
  token: string;
  customerName: string;
  serviceIds: ReceptionServiceId[];
  serviceNames: string[];
  durationMinutes: number;
  totalPriceRupees: number;
  preferredBarberId: string | null;
  preferredBarberName: string;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  status: BookingStatus;
  createdAt: string;
  waitingMinutes: number;
  estimatedWaitMinutes: number | null;
}

export interface ReceptionDashboard {
  queueOpen: boolean;
  generatedAt: string;
  overview: ReceptionOverview;
  services: SalonServiceRecord[];
  barbers: ReceptionBarber[];
  bookings: ReceptionBooking[];
}

export interface BarberDashboardBooking {
  id: string;
  token: string;
  customerName: string;
  serviceNames: string[];
  serviceDurationMinutes: number;
  totalPriceRupees: number;
  status: BookingStatus;
  createdAt: string;
  serviceStartedAt: string | null;
}

export interface QueueEntryStatus extends BarberDashboardBooking {
  preferredBarberId: string | null;
  preferredBarberName: string;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  position: number | null;
  customersAhead: number;
  estimatedWaitMinutes: number | null;
}

export interface BarberDashboard {
  generatedAt: string;
  barber: {
    id: string;
    name: string;
    photoUrl: string | null;
    status: BarberStatus;
    isActive: boolean;
  };
  currentCustomer: BarberDashboardBooking | null;
  nextCustomer: BarberDashboardBooking | null;
}
