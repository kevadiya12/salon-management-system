export type UserRole = 'OWNER' | 'RECEPTIONIST' | 'BARBER' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: UserRole;
  barberId: string | null;
  customerId: string | null;
  customerPhoneNumber: string | null;
  activeQueueId: string | null;
}

export interface CustomerRegistration {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
}
