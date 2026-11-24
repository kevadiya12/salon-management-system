import type { Database } from '../database/client.js';
import type { Request, RequestHandler } from 'express';
import {
  authenticateAccessToken,
  type UserRole,
} from '../services/auth.service.js';
import { ReceptionServiceError } from '../services/reception.service.js';

const accessCookieName = 'salon_queue_access';
const bookingIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestToken(request: Request): string | null {
  const authorization = request.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (match?.[1]) return match[1];
  }
  const cookieHeader = request.get('cookie');
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== accessCookieName) {
      continue;
    }
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function authenticate(database: Database): RequestHandler {
  return async (request, _response, next) => {
    const token = requestToken(request);
    if (!token) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    try {
      const user = await authenticateAccessToken(database, token);
      if (!user) {
        next(new ReceptionServiceError('Invalid or expired access token.', 401));
        return;
      }
      request.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authenticateIfPresent(database: Database): RequestHandler {
  return async (request, _response, next) => {
    const token = requestToken(request);
    if (!token) {
      next();
      return;
    }
    try {
      request.authUser = (await authenticateAccessToken(database, token)) ?? undefined;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.authUser) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    if (!roles.includes(request.authUser.role)) {
      next(new ReceptionServiceError('You are not authorized to perform this action.', 403));
      return;
    }
    next();
  };
}

export function authorizeQueueEntry(database: Database): RequestHandler {
  return async (request, _response, next) => {
    const user = request.authUser;
    if (!user) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    if (user.role === 'OWNER' || user.role === 'RECEPTIONIST') {
      next();
      return;
    }
    const bookingId = singleParam(request.params['id']);
    if (!bookingId) {
      next(new ReceptionServiceError('Queue entry ID is invalid.', 400));
      return;
    }
    if (user.role === 'BARBER') {
      const booking = await database.prepare(`
        SELECT assigned_barber_id
        FROM reception_bookings
        WHERE id = ?
      `).get(bookingId) as
        | { assigned_barber_id: string | null }
        | undefined;
      if (booking?.assigned_barber_id === user.barberId) {
        next();
        return;
      }
      next(new ReceptionServiceError('You are not authorized to access this queue entry.', 403));
      return;
    }
    const booking = await database.prepare(`
      SELECT customer_id
      FROM reception_bookings
      WHERE id = ?
    `).get(bookingId) as { customer_id: string | null } | undefined;
    if (booking && booking.customer_id === user.customerId) {
      next();
      return;
    }
    next(new ReceptionServiceError('You are not authorized to access this queue entry.', 403));
  };
}

export function authorizeCustomerOrStaff(database: Database): RequestHandler {
  return async (request, _response, next) => {
    const user = request.authUser;
    if (!user) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    if (user.role === 'OWNER' || user.role === 'RECEPTIONIST') {
      next();
      return;
    }
    if (user.role === 'CUSTOMER') {
      const customer = await database.prepare(
        'SELECT id FROM customers WHERE id = ?',
      ).get(singleParam(request.params['id']) ?? '') as { id: string } | undefined;
      if (customer?.id === user.customerId) {
        next();
        return;
      }
    }
    next(new ReceptionServiceError('You are not authorized to access this customer.', 403));
  };
}

export function authorizeBarberIdentity(
  barberIdFrom: (request: Request) => string | undefined,
): RequestHandler {
  return (request, _response, next) => {
    const user = request.authUser;
    if (!user) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    if (user.role === 'OWNER' || user.role === 'RECEPTIONIST') {
      next();
      return;
    }
    if (
      user.role === 'BARBER' &&
      barberIdFrom(request) === user.barberId &&
      user.barberId !== null
    ) {
      next();
      return;
    }
    next(new ReceptionServiceError('You are not authorized to access this barber.', 403));
  };
}

export function validBookingId(value: unknown): value is string {
  return typeof value === 'string' && bookingIdPattern.test(value);
}

export function singleParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
