import type { BarberStatus } from './reception';
import type { SalonService } from './queue';

export interface OwnerSettings {
  salonName: string;
  address: string;
  contactNumber: string;
  openingTime: string;
  closingTime: string;
  workingDays: number[];
  queueOpen: boolean;
  maxQueueCapacity: number | null;
}

export interface OwnerStatistics {
  day: string;
  waiting: number;
  currentWaiting: number;
  inService: number;
  completed: number;
  completedServiceCount: number;
  cancelled: number;
  noShow: number;
  availableBarbers: number;
  activeBarbers: number;
  totalSalesRupees: number;
  nextTokenSequence: number;
  averageWaitMinutes: number | null;
}

export interface OwnerBarber {
  id: string;
  name: string;
  photoUrl: string | null;
  status: BarberStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerDashboardData {
  settings: OwnerSettings;
  statistics: OwnerStatistics;
  services: SalonService[];
  barbers: OwnerBarber[];
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: 'RECEPTIONIST' | 'BARBER';
  barberId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAccountInput {
  name: string;
  email: string;
  username?: string;
  password?: string;
  role?: 'RECEPTIONIST' | 'BARBER';
  barberId?: string;
  isActive?: boolean;
}
