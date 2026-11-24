import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { initializeReceptionSchema } from '../src/database/reception-schema.js';
import {
  createBarber,
  createWalkIn,
} from '../src/services/reception.service.js';
import {
  emitSalonEvent,
  type SalonEventPayload,
  type SalonSocketEmitter,
} from '../src/socket/events.js';

const databases: DatabaseSync[] = [];

function createTestDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  initializeReceptionSchema(database);
  databases.push(database);
  return database;
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

test('salon socket events use a consistent, customer-safe payload', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  const booking = createWalkIn(database, {
    customerName: 'Private Customer',
    phoneNumber: '9876543210',
    serviceIds: ['haircut'],
    preferredBarberId: barber.id,
  });
  const deliveries: Array<{
    room: string;
    event: string;
    payload: SalonEventPayload;
  }> = [];
  const io: SalonSocketEmitter = {
    to(room) {
      return {
        emit(event, payload) {
          deliveries.push({ room, event, payload });
          return true;
        },
      };
    },
  };

  const payload = emitSalonEvent(database, io, 'queue:joined', {
    bookingId: booking.id,
  });

  assert.ok(payload.eventId);
  assert.equal(payload.queueEntryId, booking.id);
  assert.equal(payload.token, booking.token);
  assert.equal(payload.status, 'waiting');
  assert.ok(
    deliveries.some(
      (delivery) =>
        delivery.room === 'queue:display' && delivery.event === 'queue:joined',
    ),
  );
  assert.ok(
    deliveries.some(
      (delivery) =>
        delivery.room === `queue:booking:${booking.id}` &&
        delivery.event === 'queue:updated',
    ),
  );
  assert.ok(
    deliveries.every(
      (delivery) =>
        !('customerName' in delivery.payload) &&
        !('phoneNumber' in delivery.payload),
    ),
  );
});
