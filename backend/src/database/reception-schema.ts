import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { receptionServices } from '../types/reception.js';

function hasColumn(
  database: DatabaseSync,
  table: string,
  column: string,
): boolean {
  return database
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => row['name'] === column);
}

function addColumn(
  database: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function textValue(
  row: Record<string, SQLOutputValue>,
  column: string,
): string {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new Error(`Database row is missing ${column}.`);
  }
  return String(value);
}

function migrateLegacyRows(database: DatabaseSync): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    const bookings = database
    .prepare(
      `SELECT id, customer_id, customer_name, phone_number, service_ids,
              token_day, token, assigned_barber_id, service_started_at,
              completed_at, created_at
       FROM reception_bookings`,
    )
    .all();
    const insertCustomer = database.prepare(
    `INSERT INTO customers (id, name, phone_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    );
    const attachCustomer = database.prepare(
    'UPDATE reception_bookings SET customer_id = ? WHERE id = ?',
    );
    const insertLine = database.prepare(
    `INSERT OR IGNORE INTO booking_services
       (booking_id, service_id, service_name, duration_minutes, price_rupees)
     VALUES (?, ?, ?, ?, ?)`,
    );
    const insertDailyQueue = database.prepare(
    `INSERT OR IGNORE INTO daily_queue_information
       (queue_day, next_token_sequence, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    );
    const insertRecord = database.prepare(
    `INSERT OR IGNORE INTO service_records
       (id, booking_id, barber_id, started_at, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const serviceById = new Map<string, (typeof receptionServices)[number]>(
    receptionServices.map((service) => [service.id, service]),
    );
    const dailySequences = new Map<string, number>();

    for (const booking of bookings) {
    const bookingId = textValue(booking, 'id');
    const createdAt = textValue(booking, 'created_at');
    if (booking['customer_id'] === null) {
      const customerId = randomUUID();
      insertCustomer.run(
        customerId,
        textValue(booking, 'customer_name'),
        textValue(booking, 'phone_number'),
        createdAt,
        createdAt,
      );
      attachCustomer.run(customerId, bookingId);
      }

    const serviceIds = JSON.parse(textValue(booking, 'service_ids')) as unknown;
    if (Array.isArray(serviceIds)) {
      for (const serviceId of serviceIds) {
        if (typeof serviceId !== 'string') continue;
        const service = serviceById.get(serviceId);
        if (!service) continue;
        insertLine.run(
          bookingId,
          service.id,
          service.name,
          service.durationMinutes,
          service.priceRupees,
        );
      }
    }

    const tokenDay = textValue(booking, 'token_day');
    const sequence = Number(textValue(booking, 'token').replace(/^S-/, ''));
    if (Number.isSafeInteger(sequence) && sequence > 0) {
      dailySequences.set(
        tokenDay,
        Math.max(dailySequences.get(tokenDay) ?? 1, sequence + 1),
      );
    }

    const serviceStartedAt =
      booking['service_started_at'] === null
        ? null
        : textValue(booking, 'service_started_at');
    if (serviceStartedAt) {
      const completedAt =
        booking['completed_at'] === null
          ? null
          : textValue(booking, 'completed_at');
      const barberId =
        booking['assigned_barber_id'] === null
          ? null
          : textValue(booking, 'assigned_barber_id');
      insertRecord.run(
        randomUUID(),
        bookingId,
        barberId,
        serviceStartedAt,
        completedAt,
        serviceStartedAt,
        completedAt ?? serviceStartedAt,
      );
    }
    }

    for (const [queueDay, nextSequence] of dailySequences) {
    const timestamp = new Date().toISOString();
    insertDailyQueue.run(queueDay, nextSequence, timestamp, timestamp);
    }

    database
      .prepare(
        `UPDATE daily_queue_information
         SET next_token_sequence = MAX(
           next_token_sequence,
           COALESCE((
             SELECT MAX(CAST(substr(token, 3) AS INTEGER)) + 1
             FROM reception_bookings
             WHERE token_day = daily_queue_information.queue_day
           ), 1)
         )`,
      )
      .run();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function initializeReceptionSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      phone_number TEXT NOT NULL CHECK (phone_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS customers_phone_idx
      ON customers (phone_number);

    CREATE TABLE IF NOT EXISTS salon_services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      price_rupees INTEGER NOT NULL CHECK (price_rupees >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reception_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    INSERT OR IGNORE INTO reception_settings (setting_key, setting_value)
    VALUES ('queue_open', '1');

    CREATE TABLE IF NOT EXISTS reception_barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      photo_url TEXT,
      status TEXT NOT NULL CHECK (status IN ('available', 'busy', 'on_break')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      username TEXT COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('OWNER', 'RECEPTIONIST', 'BARBER', 'CUSTOMER')),
      barber_id TEXT REFERENCES reception_barbers(id),
      customer_id TEXT REFERENCES customers(id),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (role = 'BARBER' AND barber_id IS NOT NULL AND customer_id IS NULL) OR
        (role = 'CUSTOMER' AND customer_id IS NOT NULL AND barber_id IS NULL) OR
        (role IN ('OWNER', 'RECEPTIONIST') AND barber_id IS NULL AND customer_id IS NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
      ON users (username COLLATE NOCASE)
      WHERE username IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_barber_unique_idx
      ON users (barber_id)
      WHERE barber_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_customer_unique_idx
      ON users (customer_id)
      WHERE customer_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner_idx
      ON users (role)
      WHERE role = 'OWNER';
    CREATE INDEX IF NOT EXISTS users_role_active_idx
      ON users (role, is_active);

    CREATE TABLE IF NOT EXISTS reception_bookings (
      queue_order INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      token TEXT NOT NULL,
      token_day TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      service_ids TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
      total_price_rupees INTEGER NOT NULL DEFAULT 0 CHECK (total_price_rupees >= 0),
      booking_source TEXT NOT NULL DEFAULT 'walk_in'
        CHECK (booking_source IN ('customer', 'walk_in')),
      preferred_barber_id TEXT REFERENCES reception_barbers(id),
      assigned_barber_id TEXT REFERENCES reception_barbers(id),
      status TEXT NOT NULL CHECK (
        status IN ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT '',
      called_at TEXT,
      service_started_at TEXT,
      completed_at TEXT,
      UNIQUE (token_day, token)
    );

    CREATE INDEX IF NOT EXISTS reception_bookings_queue_idx
      ON reception_bookings (status, queue_order);
    CREATE INDEX IF NOT EXISTS reception_bookings_barber_idx
      ON reception_bookings (assigned_barber_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS reception_bookings_one_active_per_barber_idx
      ON reception_bookings (assigned_barber_id)
      WHERE status IN ('called', 'in_service');
    CREATE UNIQUE INDEX IF NOT EXISTS reception_bookings_one_active_per_customer_idx
      ON reception_bookings (phone_number)
      WHERE status IN ('waiting', 'called', 'in_service');
    CREATE INDEX IF NOT EXISTS reception_bookings_completed_idx
      ON reception_bookings (status, completed_at);
    CREATE TABLE IF NOT EXISTS booking_services (
      booking_id TEXT NOT NULL REFERENCES reception_bookings(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES salon_services(id),
      service_name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      price_rupees INTEGER NOT NULL CHECK (price_rupees >= 0),
      PRIMARY KEY (booking_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS service_records (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL UNIQUE REFERENCES reception_bookings(id) ON DELETE CASCADE,
      barber_id TEXT REFERENCES reception_barbers(id),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS service_records_barber_idx
      ON service_records (barber_id, started_at);

    CREATE TABLE IF NOT EXISTS daily_queue_information (
      queue_day TEXT PRIMARY KEY,
      next_token_sequence INTEGER NOT NULL CHECK (next_token_sequence > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  addColumn(database, 'reception_settings', 'created_at', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'reception_settings', 'updated_at', "TEXT NOT NULL DEFAULT ''");
  addColumn(
    database,
    'reception_barbers',
    'is_active',
    'INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))',
  );
  addColumn(database, 'reception_barbers', 'updated_at', "TEXT NOT NULL DEFAULT ''");
  addColumn(database, 'reception_bookings', 'customer_id', 'TEXT REFERENCES customers(id)');
  addColumn(
    database,
    'reception_bookings',
    'duration_minutes',
    'INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0)',
  );
  addColumn(
    database,
    'reception_bookings',
    'total_price_rupees',
    'INTEGER NOT NULL DEFAULT 0 CHECK (total_price_rupees >= 0)',
  );
  addColumn(
    database,
    'reception_bookings',
    'booking_source',
    "TEXT NOT NULL DEFAULT 'walk_in' CHECK (booking_source IN ('customer', 'walk_in'))",
  );
  addColumn(database, 'reception_bookings', 'updated_at', "TEXT NOT NULL DEFAULT ''");

  database.exec(`
    CREATE INDEX IF NOT EXISTS reception_bookings_customer_idx
      ON reception_bookings (customer_id, created_at);
  `);

  const now = new Date().toISOString();
  const insertService = database.prepare(
    `INSERT OR IGNORE INTO salon_services
       (id, name, description, duration_minutes, price_rupees, is_active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 1, ?, ?)`,
  );
  for (const service of receptionServices) {
    insertService.run(
      service.id,
      service.name,
      service.durationMinutes,
      service.priceRupees,
      now,
      now,
    );
  }

  database
    .prepare(
      `UPDATE reception_settings
       SET created_at = COALESCE(NULLIF(created_at, ''), ?),
           updated_at = COALESCE(NULLIF(updated_at, ''), ?)`,
    )
    .run(now, now);
  database
    .prepare(
      `UPDATE reception_barbers
       SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?)`,
    )
    .run(now);
  database
    .prepare(
      `UPDATE reception_bookings
       SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?)`,
    )
    .run(now);

  migrateLegacyRows(database);

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS customers_updated_at
    AFTER UPDATE ON customers
    FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE customers
      SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS services_updated_at
    AFTER UPDATE ON salon_services
    FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE salon_services
      SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS barbers_updated_at
    AFTER UPDATE ON reception_barbers
    FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE reception_barbers
      SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS bookings_updated_at
    AFTER UPDATE ON reception_bookings
    FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE reception_bookings
      SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = OLD.id;
    END;
  `);
}
