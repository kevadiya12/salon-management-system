import type { SalonService } from './queue';

export type BarberStatus = 'available' | 'busy' | 'on_break';
export type BookingStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

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
  serviceIds: string[];
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
  services: SalonService[];
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
  status: 'waiting' | 'called' | 'in_service';
  createdAt: string;
  serviceStartedAt: string | null;
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

export interface WalkInRequest {
  customerName: string;
  phoneNumber: string;
  serviceIds: string[];
  preferredBarberId: string | null;
}

export interface DashboardMutation<T = undefined> {
  success: true;
  data: T;
  dashboard: ReceptionDashboard;
}

export interface DashboardUpdate {
  success: true;
  dashboard: ReceptionDashboard;
  barberDashboard?: BarberDashboard;
}
