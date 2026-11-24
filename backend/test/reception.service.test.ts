import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { initializeReceptionSchema } from '../src/database/reception-schema.js';
import {
  callNext,
  cancelWaitingBooking,
  completeService,
  createBarber,
  createWalkIn,
  getBookingStatus,
  getOwnerDailyStatistics,
  getOwnerSettings,
  getReceptionDashboard,
  markWaitingBookingNoShow,
  setBarberAvailability,
  setQueueOpen,
  startService,
  updateOwnerSettings,
} from '../src/services/reception.service.js';

const databases: DatabaseSync[] = [];
let phoneSequence = 0;

function createTestDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  initializeReceptionSchema(database);
  databases.push(database);
  return database;
}

function walkIn(customerName: string, preferredBarberId: string | null = null) {
  return {
    customerName,
    phoneNumber: String(1_000_000_000 + phoneSequence++),
    serviceIds: ['haircut'],
    preferredBarberId,
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

test('dashboard starts empty and queue is open without seeded business data', () => {
  const dashboard = getReceptionDashboard(createTestDatabase());

  assert.equal(dashboard.queueOpen, true);
  assert.deepEqual(dashboard.overview, {
    waiting: 0,
    inService: 0,
    availableBarbers: 0,
    servedToday: 0,
  });
  assert.equal(dashboard.barbers.length, 0);
  assert.equal(dashboard.bookings.length, 0);
});

test('dashboard estimates wait from eligible barber availability and queue duration', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Available Barber' });
  createWalkIn(database, walkIn('First guest', barber.id));
  createWalkIn(database, walkIn('Second guest'));

  const bookings = getReceptionDashboard(database).bookings;

  assert.equal(bookings[0]?.estimatedWaitMinutes, 0);
  assert.equal(bookings[1]?.estimatedWaitMinutes, 30);
});

test('dashboard leaves the wait estimate unavailable without an eligible barber', () => {
  const database = createTestDatabase();
  createWalkIn(database, walkIn('Waiting guest'));

  const [booking] = getReceptionDashboard(database).bookings;

  assert.equal(booking?.estimatedWaitMinutes, null);
});

test('owner settings persist and configured queue capacity is enforced', () => {
  const database = createTestDatabase();
  const initialSettings = getOwnerSettings(database);
  assert.equal(initialSettings.queueOpen, true);
  assert.equal(initialSettings.maxQueueCapacity, null);

  const savedSettings = updateOwnerSettings(database, {
    salonName: 'Velvet Studio',
    address: '12 Main Street',
    contactNumber: '+91 98765 43210',
    openingTime: '09:30',
    closingTime: '18:00',
    workingDays: [1, 2, 3, 4, 5, 6],
    queueOpen: true,
    maxQueueCapacity: 1,
  });
  assert.equal(savedSettings.salonName, 'Velvet Studio');
  assert.deepEqual(savedSettings.workingDays, [1, 2, 3, 4, 5, 6]);
  assert.equal(savedSettings.maxQueueCapacity, 1);

  createWalkIn(database, walkIn('First guest'));
  assert.throws(
    () => createWalkIn(database, walkIn('Second guest')),
    /configured waiting capacity/,
  );
  assert.throws(
    () =>
      updateOwnerSettings(database, {
        ...savedSettings,
        workingDays: [1, 1],
      }),
    /unique list of weekdays/,
  );
});

test('owner daily statistics expose current wait, active barbers, and observed wait average', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  const booking = createWalkIn(
    database,
    walkIn('Waiting customer'),
    new Date('2026-11-24T00:00:00.000Z'),
  );
  callNext(database, barber.id, new Date('2026-11-24T00:04:00.000Z'));

  const statistics = getOwnerDailyStatistics(
    database,
    undefined,
    new Date('2026-11-24T00:05:00.000Z'),
  );
  assert.equal(statistics.currentWaiting, 0);
  assert.equal(statistics.activeBarbers, 1);
  assert.equal(statistics.averageWaitMinutes, 4);
  assert.equal(getBookingStatus(database, booking.id), 'called');
});

test('database initialization migrates legacy queue rows idempotently', () => {
  const database = new DatabaseSync(':memory:');
  databases.push(database);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE reception_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
    INSERT INTO reception_settings (setting_key, setting_value)
      VALUES ('queue_open', '1');
    CREATE TABLE reception_barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_url TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE reception_bookings (
      queue_order INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL,
      token_day TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      service_ids TEXT NOT NULL,
      preferred_barber_id TEXT REFERENCES reception_barbers(id),
      assigned_barber_id TEXT REFERENCES reception_barbers(id),
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      called_at TEXT,
      service_started_at TEXT,
      completed_at TEXT,
      UNIQUE (token_day, token)
    );
    INSERT INTO reception_barbers
      (id, name, status, created_at)
      VALUES ('11111111-1111-4111-8111-111111111111', 'Legacy Barber',
        'available', '2026-11-24T00:00:00.000Z');
    INSERT INTO reception_bookings
      (id, token, token_day, customer_name, phone_number, service_ids,
       assigned_barber_id, status, created_at, service_started_at, completed_at)
      VALUES ('22222222-2222-4222-8222-222222222222', 'S-4', '2026-11-24',
        'Legacy Customer', '9876543210', '["haircut"]',
        '11111111-1111-4111-8111-111111111111', 'completed',
        '2026-11-24T00:00:00.000Z', '2026-11-24T00:10:00.000Z',
        '2026-11-24T00:40:00.000Z');
  `);

  initializeReceptionSchema(database);
  initializeReceptionSchema(database);
  const customerCount = database
    .prepare('SELECT COUNT(*) AS count FROM customers')
    .get();
  const booking = database
    .prepare(
      'SELECT customer_id FROM reception_bookings WHERE id = ?',
    )
    .get('22222222-2222-4222-8222-222222222222');
  const dailyQueue = database
    .prepare(
      'SELECT next_token_sequence FROM daily_queue_information WHERE queue_day = ?',
    )
    .get('2026-11-24');
  const lineCount = database
    .prepare(
      'SELECT COUNT(*) AS count FROM booking_services WHERE booking_id = ?',
    )
    .get('22222222-2222-4222-8222-222222222222');
  const serviceRecordCount = database
    .prepare('SELECT COUNT(*) AS count FROM service_records')
    .get();
  const foreignKeyViolations = database
    .prepare('PRAGMA foreign_key_check')
    .all();

  assert.equal(Number(customerCount?.['count']), 1);
  assert.equal(typeof booking?.['customer_id'], 'string');
  assert.equal(Number(dailyQueue?.['next_token_sequence']), 5);
  assert.equal(Number(lineCount?.['count']), 1);
  assert.equal(Number(serviceRecordCount?.['count']), 1);
  assert.equal(foreignKeyViolations.length, 0);
});

test('waiting duration is calculated from the arrival time', () => {
  const database = createTestDatabase();
  const booking = createWalkIn(
    database,
    walkIn('Long wait'),
    new Date('2026-11-24T00:00:00.000Z'),
  );
  const dashboard = getReceptionDashboard(
    database,
    new Date('2026-11-24T01:01:00.000Z'),
  );

  assert.equal(dashboard.bookings[0]?.id, booking.id);
  assert.equal(dashboard.bookings[0]?.waitingMinutes, 61);
});

test('walk-ins validate input and receive daily sequential tokens', () => {
  const database = createTestDatabase();
  const first = createWalkIn(
    database,
    walkIn('Asha'),
    new Date('2026-11-24T00:00:00.000Z'),
  );
  const second = createWalkIn(
    database,
    walkIn('Mira'),
    new Date('2026-11-24T00:01:00.000Z'),
  );
  const nextDay = createWalkIn(
    database,
    walkIn('Ravi'),
    new Date('2026-11-25T00:00:00.000Z'),
  );

  assert.equal(first.token, 'S-1');
  assert.equal(second.token, 'S-2');
  assert.equal(nextDay.token, 'S-1');

  assert.throws(
    () =>
      createWalkIn(database, {
        ...walkIn('Invalid'),
        phoneNumber: '12345',
      }),
    /exactly 10 digits/,
  );
  assert.throws(
    () =>
      createWalkIn(database, {
        ...walkIn('Invalid'),
        serviceIds: ['haircut', 'beard-trim', 'hair-spa', 'haircut'],
      }),
    /no more than three/,
  );
  assert.throws(() => createWalkIn(database, null), /valid JSON object/);
});

test('daily token and served counts follow the configured business timezone', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  const lastBookingOfDay = createWalkIn(
    database,
    walkIn('Late appointment'),
    new Date('2026-11-24T18:20:00.000Z'),
  );
  callNext(database, barber.id);
  startService(database, lastBookingOfDay.id, new Date('2026-11-24T18:21:00.000Z'));
  completeService(database, lastBookingOfDay.id, new Date('2026-11-24T18:25:00.000Z'));

  const firstBookingNextDay = createWalkIn(
    database,
    walkIn('Early appointment'),
    new Date('2026-11-24T18:35:00.000Z'),
  );
  assert.equal(lastBookingOfDay.token, 'S-1');
  assert.equal(firstBookingNextDay.token, 'S-1');

  callNext(database, barber.id);
  startService(database, firstBookingNextDay.id, new Date('2026-11-24T18:36:00.000Z'));
  completeService(database, firstBookingNextDay.id, new Date('2026-11-24T18:37:00.000Z'));
  assert.equal(
    getReceptionDashboard(database, new Date('2026-11-24T18:40:00.000Z')).overview
      .servedToday,
    1,
  );
});

test('Call Next picks the oldest eligible customer and protects barber availability', () => {
  const database = createTestDatabase();
  const barberA = createBarber(database, { name: 'Barber A' });
  const barberB = createBarber(database, { name: 'Barber B' });
  const joinedAt = new Date('2026-11-24T00:00:00.000Z');
  const prefersB = createWalkIn(database, walkIn('Prefers B', barberB.id), joinedAt);
  const anyBarber = createWalkIn(database, walkIn('Any barber'), joinedAt);
  createWalkIn(database, walkIn('Prefers A', barberA.id), joinedAt);

  const calledForA = callNext(
    database,
    barberA.id,
    new Date('2026-11-24T00:01:00.000Z'),
  );
  assert.equal(calledForA.id, anyBarber.id);
  assert.equal(calledForA.token, 'S-2');
  assert.equal(getBookingStatus(database, anyBarber.id), 'called');

  assert.throws(() => callNext(database, barberA.id), /available barber/);
  assert.throws(() => setBarberAvailability(database, barberA.id, 'on_break'), /current customer/);

  const calledForB = callNext(
    database,
    barberB.id,
    new Date('2026-11-24T00:01:00.000Z'),
  );
  assert.equal(calledForB.id, prefersB.id);

  const dashboard = getReceptionDashboard(
    database,
    new Date('2026-11-24T00:02:00.000Z'),
  );
  assert.equal(dashboard.overview.waiting, 1);
  assert.equal(dashboard.barbers.find((barber) => barber.id === barberA.id)?.status, 'busy');
  assert.equal(dashboard.bookings.find((booking) => booking.id === prefersB.id)?.waitingMinutes, 1);
});

test('service completion frees the barber and increments served-today count', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  const booking = createWalkIn(database, walkIn('Customer'));
  callNext(database, barber.id);
  startService(database, booking.id, new Date('2026-11-24T00:01:00.000Z'));

  const inServiceDashboard = getReceptionDashboard(
    database,
    new Date('2026-11-24T00:10:00.000Z'),
  );
  assert.equal(inServiceDashboard.overview.inService, 1);
  assert.equal(inServiceDashboard.barbers[0]?.estimatedRemainingMinutes, 21);

  completeService(database, booking.id, new Date('2026-11-24T00:20:00.000Z'));
  const completedDashboard = getReceptionDashboard(
    database,
    new Date('2026-11-24T00:21:00.000Z'),
  );
  assert.equal(completedDashboard.overview.inService, 0);
  assert.equal(completedDashboard.overview.availableBarbers, 1);
  assert.equal(completedDashboard.overview.servedToday, 1);
  assert.equal(getBookingStatus(database, booking.id), 'completed');
  const serviceRecord = database
    .prepare(
      `SELECT started_at, completed_at FROM service_records WHERE booking_id = ?`,
    )
    .get(booking.id);
  assert.equal(serviceRecord?.['started_at'], '2026-11-24T00:01:00.000Z');
  assert.equal(serviceRecord?.['completed_at'], '2026-11-24T00:20:00.000Z');
});

test('cancellation and No-show only apply to waiting customers', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  const cancelled = createWalkIn(database, walkIn('Cancel'));
  const noShow = createWalkIn(database, walkIn('No show'));
  cancelWaitingBooking(database, cancelled.id);
  markWaitingBookingNoShow(database, noShow.id);

  assert.equal(getBookingStatus(database, cancelled.id), 'cancelled');
  assert.equal(getBookingStatus(database, noShow.id), 'no_show');
  assert.equal(getReceptionDashboard(database).bookings.length, 0);

  const called = createWalkIn(database, walkIn('Already called'));
  callNext(database, barber.id);
  assert.throws(() => cancelWaitingBooking(database, called.id), /Only a waiting customer/);
  assert.throws(() => markWaitingBookingNoShow(database, called.id), /Only a waiting customer/);
});

test('closed queue rejects walk-ins but still allows the existing queue to be served', () => {
  const database = createTestDatabase();
  const barber = createBarber(database, { name: 'Barber A' });
  setQueueOpen(database, false);

  assert.throws(
    () => createWalkIn(database, walkIn('Rejected')),
    /queue is closed/,
  );
  assert.equal(getReceptionDashboard(database).queueOpen, false);

  setQueueOpen(database, true);
  const booking = createWalkIn(database, walkIn('Accepted'));
  assert.equal(callNext(database, barber.id).id, booking.id);
});

test('barber with no eligible customers cannot call next', () => {
  const database = createTestDatabase();
  const barberA = createBarber(database, { name: 'Barber A' });
  const barberB = createBarber(database, { name: 'Barber B' });
  createWalkIn(database, walkIn('Prefers B', barberB.id));

  assert.throws(() => callNext(database, barberA.id), /no eligible waiting customer/);
  setBarberAvailability(database, barberA.id, 'on_break');
  assert.throws(() => callNext(database, barberA.id), /available barber/);
});
