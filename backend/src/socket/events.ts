import { randomUUID } from 'node:crypto';
import type { Database } from '../database/client.js';
import { getQueueEntryStatus } from '../services/reception.service.js';
import type { BarberStatus, BookingStatus } from '../types/reception.js';

export type SalonEvent =
  | 'queue:updated'
  | 'queue:joined'
  | 'queue:called'
  | 'queue:cancelled'
  | 'queue:no-show'
  | 'service:started'
  | 'service:completed'
  | 'barber:updated'
  | 'salon:queue-status';

export interface SalonEventPayload {
  eventId: string;
  occurredAt: string;
  queueEntryId: string | null;
  token: string | null;
  status: BookingStatus | null;
  position: number | null;
  customersAhead: number | null;
  estimatedWaitMinutes: number | null;
  barberId: string | null;
  barberStatus: BarberStatus | null;
  queueOpen: boolean | null;
}

export interface SalonSocketEmitter {
  to(room: string): {
    emit(event: string, payload: SalonEventPayload): unknown;
  };
}

export async function emitSalonEvent(
  database: Database,
  io: SalonSocketEmitter,
  event: SalonEvent,
  options: {
    bookingId?: string;
    barberId?: string;
    queueOpen?: boolean;
  } = {},
): Promise<SalonEventPayload> {
  const entry = options.bookingId
    ? await getQueueEntryStatus(database, options.bookingId)
    : null;
  const barberStatus = options.barberId
    ? (await database
        .prepare('SELECT status FROM reception_barbers WHERE id = ?')
        .get(options.barberId))?.['status']
    : null;
  const payload: SalonEventPayload = {
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    queueEntryId: entry?.id ?? null,
    token: entry?.token ?? null,
    status: entry?.status ?? null,
    position: entry?.position ?? null,
    customersAhead: entry?.customersAhead ?? null,
    estimatedWaitMinutes: entry?.estimatedWaitMinutes ?? null,
    barberId: options.barberId ?? null,
    barberStatus:
      barberStatus === 'available' ||
      barberStatus === 'busy' ||
      barberStatus === 'on_break'
        ? barberStatus
        : null,
    queueOpen: options.queueOpen ?? null,
  };

  io.to('reception').emit('queue:updated', payload);
  if (event !== 'queue:updated' || options.bookingId) {
    io.to('barbers').emit('barber:updated', payload);
  }
  if (options.barberId) {
    io.to(`barber:${options.barberId}`).emit('barber:updated', payload);
  }
  if (options.bookingId) {
    io.to(`queue:booking:${options.bookingId}`).emit('queue:updated', payload);
  }

  if (event === 'salon:queue-status') {
    io.to('reception').emit(event, payload);
    io.to('queue:display').emit(event, payload);
    io.to('queue:display').emit('queue:updated', payload);
    return payload;
  }

  io.to('queue:display').emit('queue:updated', payload);
  if (event !== 'queue:updated') {
    io.to('queue:display').emit(event, payload);
  }
  return payload;
}
