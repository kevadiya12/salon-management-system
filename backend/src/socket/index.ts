import type { Server } from 'socket.io';
import type { DatabaseSync } from 'node:sqlite';
import { authenticateAccessToken } from '../services/auth.service.js';
import type { AuthUser } from '../services/auth.service.js';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accessCookieName = 'salon_queue_access';

function socketAccessToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (
      separator < 0 ||
      cookie.slice(0, separator).trim() !== accessCookieName
    ) {
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

function canAccessBooking(user: AuthUser | undefined, booking: {
  customer_id: string | null;
  assigned_barber_id: string | null;
}): boolean {
  if (!user) return false;
  if (user.role === 'OWNER' || user.role === 'RECEPTIONIST') return true;
  if (user.role === 'BARBER') {
    return user.barberId === booking.assigned_barber_id;
  }
  return user.customerId === booking.customer_id;
}

export function registerSocketHandlers(
  io: Server,
  database: DatabaseSync,
): void {
  io.use((socket, next) => {
    const token = socketAccessToken(socket.handshake.headers.cookie);
    if (!token) {
      socket.data['authUser'] = undefined;
      next();
      return;
    }
    void authenticateAccessToken(database, token)
      .then((user) => {
        socket.data['authUser'] = user ?? undefined;
        next();
      })
      .catch(next);
  });

  io.on('connection', (socket) => {
    console.info(`Socket connected: ${socket.id}`);
    const authenticatedUser = socket.data['authUser'] as AuthUser | undefined;
    if (authenticatedUser) {
      socket.join(`user:${authenticatedUser.id}`);
      const expiresAt = authenticatedUser.tokenExpiresAt;
      if (expiresAt !== null) {
        const expirationTimer = setTimeout(
          () => socket.disconnect(true),
          Math.max(0, expiresAt - Date.now()),
        );
        socket.once('disconnect', () => clearTimeout(expirationTimer));
      }
    }
    socket.on('reception:subscribe', () => {
      const user = socket.data['authUser'] as AuthUser | undefined;
      if (user?.role !== 'OWNER' && user?.role !== 'RECEPTIONIST') return;
      socket.join('reception');
    });
    socket.on('queue:subscribe', () => {
      socket.join('queue:display');
    });
    socket.on('queue:booking:subscribe', (bookingId: unknown) => {
      if (typeof bookingId !== 'string' || !uuidPattern.test(bookingId)) return;
      const booking = database
        .prepare(`
          SELECT customer_id, assigned_barber_id
          FROM reception_bookings
          WHERE id = ?
        `)
        .get(bookingId) as
        | { customer_id: string | null; assigned_barber_id: string | null }
        | undefined;
      const user = socket.data['authUser'] as AuthUser | undefined;
      if (booking && canAccessBooking(user, booking)) {
        socket.join(`queue:booking:${bookingId}`);
      }
    });
    socket.on('barber:subscribe', (barberId: unknown) => {
      if (typeof barberId !== 'string' || !uuidPattern.test(barberId)) return;
      const barber = database
        .prepare('SELECT id FROM reception_barbers WHERE id = ?')
        .get(barberId);
      if (barber) {
        const user = socket.data['authUser'] as AuthUser | undefined;
        if (user?.role === 'OWNER' || user?.role === 'RECEPTIONIST') {
          socket.join('barbers');
          socket.join(`barber:${barberId}`);
        } else if (user?.role === 'BARBER' && user.barberId === barberId) {
          socket.join(`barber:${barberId}`);
        }
      }
    });
  });
}
