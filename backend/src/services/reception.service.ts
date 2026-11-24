import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { config } from '../config/env.js';
import {
  type BarberDashboard,
  type BarberDashboardBooking,
  type BarberStatus,
  type BookingStatus,
  type ReceptionBarber,
  type ReceptionBooking,
  type ReceptionDashboard,
  type ReceptionServiceId,
  type SalonServiceRecord,
  type CustomerRecord,
  type QueueEntryStatus,
} from '../types/reception.js';

export class ReceptionServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ReceptionServiceError';
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ReceptionServiceError(`${label} is required.`, 400);
  }

  const text = value.trim();
  if (text.length > maximumLength) {
    throw new ReceptionServiceError(`${label} is too long.`, 400);
  }

  return text;
}

function inputRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ReceptionServiceError('A valid JSON object is required.', 400);
  }
  return value as Record<string, unknown>;
}

function rowText(row: Record<string, SQLOutputValue>, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new Error(`Database row is missing ${column}.`);
  }
  return String(value);
}

function nullableRowText(
  row: Record<string, SQLOutputValue>,
  column: string,
): string | null {
  const value = row[column];
  return value === null || value === undefined ? null : String(value);
}

function numberValue(value: SQLOutputValue | undefined): number {
  return Number(value ?? 0);
}

function datePartsInBusinessTimeZone(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values['year']),
    month: Number(values['month']),
    day: Number(values['day']),
  };
}

function startOfBusinessDay(
  year: number,
  month: number,
  day: number,
): Date {
  const utcForLocalMidnight = Date.UTC(year, month - 1, day);
  let candidate = utcForLocalMidnight;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.businessTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const representedAsUtc = Date.UTC(
      Number(values['year']),
      Number(values['month']) - 1,
      Number(values['day']),
      Number(values['hour']),
      Number(values['minute']),
      Number(values['second']),
    );
    candidate = utcForLocalMidnight - (representedAsUtc - candidate);
  }

  return new Date(candidate);
}

function inTransaction<T>(database: DatabaseSync, action: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function requireBarber(
  database: DatabaseSync,
  barberId: string,
): Record<string, SQLOutputValue> {
  if (!uuidPattern.test(barberId)) {
    throw new ReceptionServiceError('Invalid barber ID.', 400);
  }
  const barber = database
    .prepare(
      'SELECT id, name, photo_url, status, is_active FROM reception_barbers WHERE id = ?',
    )
    .get(barberId);

  if (!barber) {
    throw new ReceptionServiceError('Barber not found.', 404);
  }

  return barber;
}

function getServiceDetails(
  database: DatabaseSync,
  serviceIds: string[],
  activeOnly = true,
): {
  ids: ReceptionServiceId[];
  names: string[];
  durationMinutes: number;
  totalPriceRupees: number;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    priceRupees: number;
  }>;
} {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ReceptionServiceError('Select at least one service.', 400);
  }
  if (serviceIds.length > 3) {
    throw new ReceptionServiceError('Select no more than three services.', 400);
  }
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new ReceptionServiceError('A service can only be selected once.', 400);
  }

  const selectService = database.prepare(
    `SELECT id, name, duration_minutes, price_rupees, is_active
     FROM salon_services
     WHERE id = ?`,
  );
  const selected = serviceIds.map((id) => {
    const service = selectService.get(id);
    if (!service || (activeOnly && numberValue(service['is_active']) !== 1)) {
      throw new ReceptionServiceError('One or more selected services are invalid or inactive.', 400);
    }
    return {
      id: rowText(service, 'id'),
      name: rowText(service, 'name'),
      durationMinutes: numberValue(service['duration_minutes']),
      priceRupees: numberValue(service['price_rupees']),
    };
  });

  return {
    ids: selected.map((service) => service.id),
    names: selected.map((service) => service.name),
    durationMinutes: selected.reduce(
      (total, service) => total + service.durationMinutes,
      0,
    ),
    totalPriceRupees: selected.reduce(
      (total, service) => total + service.priceRupees,
      0,
    ),
    services: selected,
  };
}

function getBookingServiceDetails(
  database: DatabaseSync,
  bookingId: string,
  serviceIds: string[],
): ReturnType<typeof getServiceDetails> {
  const snapshots = database
    .prepare(
      `SELECT service_id, service_name, duration_minutes, price_rupees
       FROM booking_services
       WHERE booking_id = ?
       ORDER BY rowid`,
    )
    .all(bookingId);
  if (snapshots.length) {
    const services = snapshots.map((row) => ({
      id: rowText(row, 'service_id'),
      name: rowText(row, 'service_name'),
      durationMinutes: numberValue(row['duration_minutes']),
      priceRupees: numberValue(row['price_rupees']),
    }));
    return {
      ids: services.map((service) => service.id),
      names: services.map((service) => service.name),
      durationMinutes: services.reduce((total, service) => total + service.durationMinutes, 0),
      totalPriceRupees: services.reduce((total, service) => total + service.priceRupees, 0),
      services,
    };
  }
  return getServiceDetails(database, serviceIds, false);
}

function mapSalonService(
  row: Record<string, SQLOutputValue>,
): SalonServiceRecord {
  return {
    id: rowText(row, 'id'),
    name: rowText(row, 'name'),
    description: nullableRowText(row, 'description'),
    durationMinutes: numberValue(row['duration_minutes']),
    priceRupees: numberValue(row['price_rupees']),
    isActive: numberValue(row['is_active']) === 1,
  };
}

function mapCustomer(
  row: Record<string, SQLOutputValue>,
): CustomerRecord {
  return {
    id: rowText(row, 'id'),
    name: rowText(row, 'name'),
    phoneNumber: rowText(row, 'phone_number'),
    createdAt: rowText(row, 'created_at'),
    updatedAt: rowText(row, 'updated_at'),
  };
}

function validatePhoneNumber(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{10}$/.test(value)) {
    throw new ReceptionServiceError(
      'Phone number must contain exactly 10 digits.',
      400,
    );
  }
  return value;
}

export function createCustomer(
  database: DatabaseSync,
  input: unknown,
  now = new Date(),
): CustomerRecord {
  const values = inputRecord(input);
  const name = requiredText(values['name'], 'Customer name', 100);
  const phoneNumber = validatePhoneNumber(values['phoneNumber']);
  const id = randomUUID();
  const timestamp = now.toISOString();

  database
    .prepare(
      `INSERT INTO customers (id, name, phone_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, name, phoneNumber, timestamp, timestamp);

  const customer = database
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(id);
  if (!customer) throw new Error('Created customer could not be loaded.');
  return mapCustomer(customer);
}

export function getCustomer(
  database: DatabaseSync,
  customerId: string,
): CustomerRecord {
  if (!uuidPattern.test(customerId)) {
    throw new ReceptionServiceError('Invalid customer ID.', 400);
  }
  const customer = database
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(customerId);
  if (!customer) throw new ReceptionServiceError('Customer not found.', 404);
  return mapCustomer(customer);
}

export function listSalonServices(
  database: DatabaseSync,
  includeInactive = false,
): SalonServiceRecord[] {
  const query = includeInactive
    ? 'SELECT * FROM salon_services ORDER BY name, id'
    : 'SELECT * FROM salon_services WHERE is_active = 1 ORDER BY name, id';
  return database.prepare(query).all().map(mapSalonService);
}

export function getSalonService(
  database: DatabaseSync,
  serviceId: string,
  includeInactive = false,
): SalonServiceRecord {
  const service = database
    .prepare(
      `SELECT * FROM salon_services
       WHERE id = ? AND (? = 1 OR is_active = 1)`,
    )
    .get(serviceId, includeInactive ? 1 : 0);
  if (!service) throw new ReceptionServiceError('Service not found.', 404);
  return mapSalonService(service);
}

function validateServiceInput(
  values: Record<string, unknown>,
  current?: SalonServiceRecord,
): Omit<SalonServiceRecord, 'id'> {
  const name =
    values['name'] === undefined && current
      ? current.name
      : requiredText(values['name'], 'Service name', 100);
  const description =
    values['description'] === undefined && current
      ? current.description
      : values['description'] === null || values['description'] === ''
        ? null
        : requiredText(values['description'], 'Description', 500);
  const durationMinutes =
    values['durationMinutes'] === undefined && current
      ? current.durationMinutes
      : values['durationMinutes'];
  const priceRupees =
    values['priceRupees'] === undefined && current
      ? current.priceRupees
      : values['priceRupees'];
  const isActive =
    values['isActive'] === undefined && current
      ? current.isActive
      : values['isActive'];

  if (
    typeof durationMinutes !== 'number' ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
    throw new ReceptionServiceError(
      'Service duration must be a whole number between 1 and 1440 minutes.',
      400,
    );
  }
  if (
    typeof priceRupees !== 'number' ||
    !Number.isSafeInteger(priceRupees) ||
    priceRupees < 0
  ) {
    throw new ReceptionServiceError(
      'Service price must be a non-negative whole number of rupees.',
      400,
    );
  }
  if (typeof isActive !== 'boolean') {
    throw new ReceptionServiceError('Service active status must be true or false.', 400);
  }
  return { name, description, durationMinutes, priceRupees, isActive };
}

export function createSalonService(
  database: DatabaseSync,
  input: unknown,
  now = new Date(),
): SalonServiceRecord {
  const values = validateServiceInput(inputRecord(input));
  const duplicate = database
    .prepare('SELECT id FROM salon_services WHERE lower(name) = lower(?)')
    .get(values.name);
  if (duplicate) throw new ReceptionServiceError('A service with this name already exists.', 409);

  const id = randomUUID();
  const timestamp = now.toISOString();
  database
    .prepare(
      `INSERT INTO salon_services
         (id, name, description, duration_minutes, price_rupees, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      values.name,
      values.description,
      values.durationMinutes,
      values.priceRupees,
      values.isActive ? 1 : 0,
      timestamp,
      timestamp,
    );
  return getSalonService(database, id, true);
}

export function updateSalonService(
  database: DatabaseSync,
  serviceId: string,
  input: unknown,
): SalonServiceRecord {
  const current = getSalonService(database, serviceId, true);
  const values = validateServiceInput(inputRecord(input), current);
  const duplicate = database
    .prepare(
      'SELECT id FROM salon_services WHERE lower(name) = lower(?) AND id != ?',
    )
    .get(values.name, serviceId);
  if (duplicate) throw new ReceptionServiceError('A service with this name already exists.', 409);

  database
    .prepare(
      `UPDATE salon_services
       SET name = ?, description = ?, duration_minutes = ?, price_rupees = ?,
           is_active = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      values.name,
      values.description,
      values.durationMinutes,
      values.priceRupees,
      values.isActive ? 1 : 0,
      new Date().toISOString(),
      serviceId,
    );
  return getSalonService(database, serviceId, true);
}

function isQueueOpen(database: DatabaseSync): boolean {
  const setting = database
    .prepare(
      "SELECT setting_value FROM reception_settings WHERE setting_key = 'queue_open'",
    )
    .get();
  return setting?.['setting_value'] === '1';
}

function mapBooking(
  database: DatabaseSync,
  row: Record<string, SQLOutputValue>,
  now: Date,
): ReceptionBooking {
  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  const services = getBookingServiceDetails(
    database,
    rowText(row, 'id'),
    serviceIds,
  );
  const createdAt = rowText(row, 'created_at');
  const status = rowText(row, 'status') as BookingStatus;
  const calledAt = nullableRowText(row, 'called_at');
  const waitEnd = status === 'waiting' || !calledAt ? now.getTime() : Date.parse(calledAt);

  return {
    id: rowText(row, 'id'),
    token: rowText(row, 'token'),
    customerName: rowText(row, 'customer_name'),
    serviceIds: services.ids,
    serviceNames: services.names,
    durationMinutes: numberValue(row['duration_minutes']) || services.durationMinutes,
    totalPriceRupees: numberValue(row['total_price_rupees']) || services.totalPriceRupees,
    preferredBarberId: nullableRowText(row, 'preferred_barber_id'),
    preferredBarberName: nullableRowText(row, 'preferred_barber_name') ?? 'Any barber',
    assignedBarberId: nullableRowText(row, 'assigned_barber_id'),
    assignedBarberName: nullableRowText(row, 'assigned_barber_name'),
    status,
    createdAt,
    waitingMinutes: Math.max(
      0,
      Math.floor((waitEnd - new Date(createdAt).getTime()) / 60_000),
    ),
    estimatedWaitMinutes: null,
  };
}

function mapBarber(
  database: DatabaseSync,
  row: Record<string, SQLOutputValue>,
  now: Date,
): ReceptionBarber {
  const id = rowText(row, 'id');
  const current = database
    .prepare(
      `SELECT id, customer_name, service_ids, status, service_started_at,
              duration_minutes
       FROM reception_bookings
       WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
       ORDER BY queue_order
       LIMIT 1`,
    )
    .get(id);

  if (!current) {
    return {
      id,
      name: rowText(row, 'name'),
      photoUrl: nullableRowText(row, 'photo_url'),
      status: rowText(row, 'status') as BarberStatus,
      isActive: numberValue(row['is_active']) === 1,
      currentBookingId: null,
      currentCustomerName: null,
      currentServiceNames: [],
      currentBookingStatus: null,
      serviceStartedAt: null,
      currentServiceDurationMinutes: null,
      estimatedRemainingMinutes: null,
    };
  }

  const services = getBookingServiceDetails(
    database,
    rowText(current, 'id'),
    JSON.parse(rowText(current, 'service_ids')) as string[],
  );
  const startedAt = nullableRowText(current, 'service_started_at');
  const elapsedMinutes = startedAt
    ? Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000)
    : 0;
  const currentBookingStatus = rowText(current, 'status') as 'called' | 'in_service';
  const serviceDurationMinutes =
    numberValue(current['duration_minutes']) || services.durationMinutes;

  return {
    id,
    name: rowText(row, 'name'),
    photoUrl: nullableRowText(row, 'photo_url'),
    status: rowText(row, 'status') as BarberStatus,
    isActive: numberValue(row['is_active']) === 1,
    currentBookingId: rowText(current, 'id'),
    currentCustomerName: rowText(current, 'customer_name'),
    currentServiceNames: services.names,
    currentBookingStatus,
    serviceStartedAt: startedAt,
    currentServiceDurationMinutes: serviceDurationMinutes,
    estimatedRemainingMinutes:
      currentBookingStatus === 'in_service'
        ? Math.max(0, serviceDurationMinutes - elapsedMinutes)
        : null,
  };
}

export function createBarber(
  database: DatabaseSync,
  input: unknown,
  now = new Date(),
): BarberRecord {
  const values = inputRecord(input);
  const name = requiredText(values['name'], 'Barber name', 100);
  const photoUrl =
    values['photoUrl'] === undefined ||
    values['photoUrl'] === null ||
    values['photoUrl'] === ''
      ? null
      : requiredText(values['photoUrl'], 'Photo URL', 2048);
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    throw new ReceptionServiceError('Photo URL must use HTTP or HTTPS.', 400);
  }

  const id = randomUUID();
  const timestamp = now.toISOString();
  database
    .prepare(
      `INSERT INTO reception_barbers
         (id, name, photo_url, status, created_at, updated_at)
       VALUES (?, ?, ?, 'available', ?, ?)`,
    )
    .run(id, name, photoUrl, timestamp, timestamp);

  return getBarberRecord(database, id);
}

export interface BarberRecord {
  id: string;
  name: string;
  photoUrl: string | null;
  status: BarberStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getBarberRecord(
  database: DatabaseSync,
  barberId: string,
): BarberRecord {
  if (!uuidPattern.test(barberId)) {
    throw new ReceptionServiceError('Invalid barber ID.', 400);
  }
  const row = database
    .prepare(
      `SELECT id, name, photo_url, status, is_active, created_at, updated_at
       FROM reception_barbers
       WHERE id = ?`,
    )
    .get(barberId);
  if (!row) throw new ReceptionServiceError('Barber not found.', 404);
  return {
    id: rowText(row, 'id'),
    name: rowText(row, 'name'),
    photoUrl: nullableRowText(row, 'photo_url'),
    status: rowText(row, 'status') as BarberStatus,
    isActive: numberValue(row['is_active']) === 1,
    createdAt: rowText(row, 'created_at'),
    updatedAt: rowText(row, 'updated_at'),
  };
}

export function listBarberRecords(
  database: DatabaseSync,
  includeInactive = false,
): BarberRecord[] {
  return database
    .prepare(
      `SELECT id, name, photo_url, status, is_active, created_at, updated_at
       FROM reception_barbers
       WHERE (? = 1 OR is_active = 1)
       ORDER BY created_at, id`,
    )
    .all(includeInactive ? 1 : 0)
    .map((row) => ({
      id: rowText(row, 'id'),
      name: rowText(row, 'name'),
      photoUrl: nullableRowText(row, 'photo_url'),
      status: rowText(row, 'status') as BarberStatus,
      isActive: numberValue(row['is_active']) === 1,
      createdAt: rowText(row, 'created_at'),
      updatedAt: rowText(row, 'updated_at'),
    }));
}

export function updateBarberProfile(
  database: DatabaseSync,
  barberId: string,
  input: unknown,
): BarberRecord {
  const values = inputRecord(input);
  const current = getBarberRecord(database, barberId);
  const name =
    values['name'] === undefined
      ? current.name
      : requiredText(values['name'], 'Barber name', 100);
  const photoUrl =
    values['photoUrl'] === undefined
      ? current.photoUrl
      : values['photoUrl'] === null || values['photoUrl'] === ''
        ? null
        : requiredText(values['photoUrl'], 'Photo URL', 2048);
  const isActive =
    values['isActive'] === undefined ? current.isActive : values['isActive'];

  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    throw new ReceptionServiceError('Photo URL must use HTTP or HTTPS.', 400);
  }
  if (typeof isActive !== 'boolean') {
    throw new ReceptionServiceError('Barber active status must be true or false.', 400);
  }
  if (!isActive && current.isActive) {
    const activeBooking = database
      .prepare(
        `SELECT id FROM reception_bookings
         WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
         LIMIT 1`,
      )
      .get(barberId);
    if (activeBooking) {
      throw new ReceptionServiceError(
        'Finish the current customer before deactivating this barber.',
        409,
      );
    }
  }

  database
    .prepare(
      `UPDATE reception_barbers
       SET name = ?, photo_url = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(name, photoUrl, isActive ? 1 : 0, new Date().toISOString(), barberId);
  return getBarberRecord(database, barberId);
}

export function updateBarberStatus(
  database: DatabaseSync,
  barberId: string,
  requestedStatus: unknown,
): BarberRecord {
  if (
    requestedStatus !== 'available' &&
    requestedStatus !== 'busy' &&
    requestedStatus !== 'on_break'
  ) {
    throw new ReceptionServiceError(
      'Barber status must be Available, Busy, or On Break.',
      400,
    );
  }

  if (requestedStatus !== 'busy') {
    setBarberAvailability(database, barberId, requestedStatus);
    return getBarberRecord(database, barberId);
  }

  inTransaction(database, () => {
    const barber = requireBarber(database, barberId);
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot be marked Busy.', 409);
    }
    const activeBooking = database
      .prepare(
        `SELECT id FROM reception_bookings
         WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
         LIMIT 1`,
      )
      .get(barberId);
    if (!activeBooking) {
      throw new ReceptionServiceError(
        'A barber can only be marked Busy while assigned to a customer.',
        409,
      );
    }
    database
      .prepare("UPDATE reception_barbers SET status = 'busy' WHERE id = ?")
      .run(barberId);
  });
  return getBarberRecord(database, barberId);
}

export function setBarberAvailability(
  database: DatabaseSync,
  barberId: string,
  requestedStatus: unknown,
): void {
  if (requestedStatus !== 'available' && requestedStatus !== 'on_break') {
    throw new ReceptionServiceError(
      'Barber status can only be changed to Available or On Break.',
      400,
    );
  }

  inTransaction(database, () => {
    const barber = requireBarber(database, barberId);
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot call the queue.', 409);
    }
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot change availability.', 409);
    }
    const activeBooking = database
      .prepare(
        `SELECT id FROM reception_bookings
         WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
         LIMIT 1`,
      )
      .get(barberId);

    if (activeBooking) {
      throw new ReceptionServiceError(
        'Finish the current customer before changing barber availability.',
        409,
      );
    }

    if (rowText(barber, 'status') === 'busy') {
      throw new ReceptionServiceError(
        'A busy barber cannot change availability.',
        409,
      );
    }

    database
      .prepare('UPDATE reception_barbers SET status = ? WHERE id = ?')
      .run(requestedStatus, barberId);
  });
}

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

function getSetting(database: DatabaseSync, key: string): string | null {
  const row = database
    .prepare('SELECT setting_value FROM reception_settings WHERE setting_key = ?')
    .get(key);
  return row ? rowText(row, 'setting_value') : null;
}

function saveSetting(database: DatabaseSync, key: string, value: string): void {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO reception_settings (setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
    )
    .run(key, value, now, now);
}

export function getOwnerSettings(database: DatabaseSync): OwnerSettings {
  const maxCapacity = getSetting(database, 'queue_max_capacity');
  const workingDays = getSetting(database, 'business_working_days');
  return {
    salonName: getSetting(database, 'salon_name') ?? 'Salon',
    address: getSetting(database, 'salon_address') ?? '',
    contactNumber: getSetting(database, 'salon_contact_number') ?? '',
    openingTime: getSetting(database, 'business_opening_time') ?? '',
    closingTime: getSetting(database, 'business_closing_time') ?? '',
    workingDays: workingDays ? (JSON.parse(workingDays) as number[]) : [],
    queueOpen: isQueueOpen(database),
    maxQueueCapacity:
      maxCapacity === null || maxCapacity === '' ? null : Number(maxCapacity),
  };
}

export function updateOwnerSettings(
  database: DatabaseSync,
  input: unknown,
): OwnerSettings {
  const values = inputRecord(input);
  const current = getOwnerSettings(database);
  const salonName =
    values['salonName'] === undefined
      ? current.salonName
      : requiredText(values['salonName'], 'Salon name', 100);
  const address =
    values['address'] === undefined
      ? current.address
      : typeof values['address'] === 'string' && values['address'].trim().length <= 300
        ? values['address'].trim()
        : (() => {
            throw new ReceptionServiceError('Address must be 300 characters or fewer.', 400);
          })();
  const contactNumber =
    values['contactNumber'] === undefined
      ? current.contactNumber
      : typeof values['contactNumber'] === 'string' &&
          values['contactNumber'].trim().length <= 30 &&
          (!values['contactNumber'].trim() ||
            /^[+()\d\s.-]{7,30}$/.test(values['contactNumber'].trim()))
        ? values['contactNumber'].trim()
        : (() => {
            throw new ReceptionServiceError('Contact number is invalid.', 400);
          })();
  const openingTime =
    values['openingTime'] === undefined ? current.openingTime : values['openingTime'];
  const closingTime =
    values['closingTime'] === undefined ? current.closingTime : values['closingTime'];
  if (
    typeof openingTime !== 'string' ||
    (openingTime !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(openingTime)) ||
    typeof closingTime !== 'string' ||
    (closingTime !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime)) ||
    Boolean(openingTime) !== Boolean(closingTime)
  ) {
    throw new ReceptionServiceError(
      'Opening and closing times must both be blank or use HH:MM format.',
      400,
    );
  }

  const workingDays =
    values['workingDays'] === undefined ? current.workingDays : values['workingDays'];
  if (
    !Array.isArray(workingDays) ||
    workingDays.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    ) ||
    new Set(workingDays).size !== workingDays.length
  ) {
    throw new ReceptionServiceError(
      'Working days must be a unique list of weekdays from 0 to 6.',
      400,
    );
  }

  const maxQueueCapacity =
    values['maxQueueCapacity'] === undefined
      ? current.maxQueueCapacity
      : values['maxQueueCapacity'];
  if (
    maxQueueCapacity !== null &&
    (typeof maxQueueCapacity !== 'number' ||
      !Number.isSafeInteger(maxQueueCapacity) ||
      maxQueueCapacity < 1 ||
      maxQueueCapacity > 1000)
  ) {
    throw new ReceptionServiceError(
      'Maximum queue capacity must be blank or a whole number between 1 and 1000.',
      400,
    );
  }
  const queueOpen =
    values['queueOpen'] === undefined ? current.queueOpen : values['queueOpen'];
  if (typeof queueOpen !== 'boolean') {
    throw new ReceptionServiceError('Salon status must be Open or Closed.', 400);
  }

  saveSetting(database, 'salon_name', salonName);
  saveSetting(database, 'salon_address', address);
  saveSetting(database, 'salon_contact_number', contactNumber);
  saveSetting(database, 'business_opening_time', openingTime);
  saveSetting(database, 'business_closing_time', closingTime);
  saveSetting(database, 'business_working_days', JSON.stringify(workingDays));
  saveSetting(
    database,
    'queue_max_capacity',
    maxQueueCapacity === null ? '' : String(maxQueueCapacity),
  );
  setQueueOpen(database, queueOpen);
  return getOwnerSettings(database);
}

export function setQueueOpen(database: DatabaseSync, open: unknown): void {
  if (typeof open !== 'boolean') {
    throw new ReceptionServiceError('Queue state must be true or false.', 400);
  }
  database
    .prepare(
      `UPDATE reception_settings
       SET setting_value = ?
       WHERE setting_key = 'queue_open'`,
    )
    .run(open ? '1' : '0');
}

export interface CreatedQueueEntry {
  id: string;
  token: string;
  customerId: string;
  durationMinutes: number;
  totalPriceRupees: number;
}

export function createQueueEntry(
  database: DatabaseSync,
  input: unknown,
  source: 'customer' | 'walk_in',
  now = new Date(),
): CreatedQueueEntry {
  const values = inputRecord(input);
  const customerIdValue = values['customerId'];
  const customerId =
    customerIdValue === undefined
      ? randomUUID()
      : requiredText(customerIdValue, 'Customer ID', 100);
  const suppliedName = values['customerName'] ?? values['name'];
  const customerName =
    customerIdValue === undefined
      ? requiredText(suppliedName, 'Customer name', 100)
      : undefined;
  const phoneNumber =
    customerIdValue === undefined
      ? validatePhoneNumber(values['phoneNumber'])
      : undefined;
  const serviceIds = values['serviceIds'];
  if (
    !Array.isArray(serviceIds) ||
    serviceIds.some((serviceId) => typeof serviceId !== 'string')
  ) {
    throw new ReceptionServiceError('Selected services must be a list of IDs.', 400);
  }
  const services = getServiceDetails(database, serviceIds);
  const preferredValue = values['preferredBarberId'] ?? values['barberId'] ?? null;
  if (preferredValue !== null && typeof preferredValue !== 'string') {
    throw new ReceptionServiceError('Preferred barber must be a barber ID or Any.', 400);
  }
  const preferredBarberId =
    preferredValue === null || preferredValue === 'any'
      ? null
      : requiredText(preferredValue, 'Preferred barber', 100);

  const id = randomUUID();
  const createdAt = now.toISOString();
  const businessDate = datePartsInBusinessTimeZone(now);
  const tokenDay = `${businessDate.year}-${String(businessDate.month).padStart(2, '0')}-${String(businessDate.day).padStart(2, '0')}`;

  return inTransaction(database, () => {
    if (!isQueueOpen(database)) {
      throw new ReceptionServiceError(
        'The queue is closed and cannot accept walk-ins.',
        409,
      );
    }
    const maxQueueCapacity = getOwnerSettings(database).maxQueueCapacity;
    if (maxQueueCapacity !== null) {
      const waitingCount = database
        .prepare("SELECT COUNT(*) AS count FROM reception_bookings WHERE status = 'waiting'")
        .get();
      if (numberValue(waitingCount?.['count']) >= maxQueueCapacity) {
        throw new ReceptionServiceError(
          'The queue has reached its configured waiting capacity.',
          409,
        );
      }
    }
    if (preferredBarberId) {
      const preferredBarber = requireBarber(database, preferredBarberId);
      if (numberValue(preferredBarber['is_active']) !== 1) {
        throw new ReceptionServiceError('The selected barber is inactive.', 409);
      }
    }
    const customer = customerIdValue === undefined
      ? undefined
      : getCustomer(database, customerId);
    const resolvedName = customer?.name ?? customerName;
    const resolvedPhoneNumber = customer?.phoneNumber ?? phoneNumber;
    if (!resolvedName || !resolvedPhoneNumber) {
      throw new ReceptionServiceError('Customer details are required.', 400);
    }

    const activeBooking = database
      .prepare(
        `SELECT id FROM reception_bookings
         WHERE phone_number = ? AND status IN ('waiting', 'called', 'in_service')
         LIMIT 1`,
      )
      .get(resolvedPhoneNumber);
    if (activeBooking) {
      throw new ReceptionServiceError(
        'This customer already has an active queue entry.',
        409,
      );
    }

    if (customerIdValue === undefined) {
      database
        .prepare(
          `INSERT INTO customers (id, name, phone_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(customerId, resolvedName, resolvedPhoneNumber, createdAt, createdAt);
    }

    database
      .prepare(
        `INSERT OR IGNORE INTO daily_queue_information
           (queue_day, next_token_sequence, created_at, updated_at)
         VALUES (?, 1, ?, ?)`,
      )
      .run(tokenDay, createdAt, createdAt);
    const daily = database
      .prepare(
        `SELECT next_token_sequence
         FROM daily_queue_information
         WHERE queue_day = ?`,
      )
      .get(tokenDay);
    const sequence = numberValue(daily?.['next_token_sequence']);
    const token = `S-${sequence}`;
    database
      .prepare(
        `UPDATE daily_queue_information
         SET next_token_sequence = ?, updated_at = ?
         WHERE queue_day = ?`,
      )
      .run(sequence + 1, createdAt, tokenDay);

    database
      .prepare(
        `INSERT INTO reception_bookings
          (id, token, token_day, customer_id, customer_name, phone_number,
           service_ids, duration_minutes, total_price_rupees, booking_source,
           preferred_barber_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
      )
      .run(
        id,
        token,
        tokenDay,
        customerId,
        resolvedName,
        resolvedPhoneNumber,
        JSON.stringify(services.ids),
        services.durationMinutes,
        services.totalPriceRupees,
        source,
        preferredBarberId,
        createdAt,
        createdAt,
      );

    const insertLine = database.prepare(
      `INSERT INTO booking_services
         (booking_id, service_id, service_name, duration_minutes, price_rupees)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const service of services.services) {
      insertLine.run(
        id,
        service.id,
        service.name,
        service.durationMinutes,
        service.priceRupees,
      );
    }

    return {
      id,
      token,
      customerId,
      durationMinutes: services.durationMinutes,
      totalPriceRupees: services.totalPriceRupees,
    };
  });
}

export function createWalkIn(
  database: DatabaseSync,
  input: unknown,
  now = new Date(),
): Pick<CreatedQueueEntry, 'id' | 'token'> {
  return createQueueEntry(database, input, 'walk_in', now);
}

function assignNextQueueEntry(
  database: DatabaseSync,
  barberId: string,
  now: Date,
  expectedBookingId?: string,
): { id: string; token: string } {
  const barber = requireBarber(database, barberId);
  if (rowText(barber, 'status') !== 'available') {
    throw new ReceptionServiceError(
      'Only an available barber can call the next customer.',
      409,
    );
  }
  const activeBooking = database
    .prepare(
      `SELECT id FROM reception_bookings
       WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
       LIMIT 1`,
    )
    .get(barberId);
  if (activeBooking) {
    throw new ReceptionServiceError(
      'This barber already has an active customer assignment.',
      409,
    );
  }
  const nextBooking = database
    .prepare(
      `SELECT id, token FROM reception_bookings
       WHERE status = 'waiting'
         AND (preferred_barber_id IS NULL OR preferred_barber_id = ?)
       ORDER BY queue_order
       LIMIT 1`,
    )
    .get(barberId);

  if (!nextBooking) {
    throw new ReceptionServiceError(
      'There is no eligible waiting customer for this barber.',
      409,
    );
  }
  const id = rowText(nextBooking, 'id');
  if (expectedBookingId && id !== expectedBookingId) {
    throw new ReceptionServiceError(
      'Only the next eligible waiting customer can be called for this barber.',
      409,
    );
  }

  const result = database
    .prepare(
      `UPDATE reception_bookings
       SET status = 'called', assigned_barber_id = ?, called_at = ?
       WHERE id = ? AND status = 'waiting'`,
    )
    .run(barberId, now.toISOString(), id);
  if (Number(result.changes) !== 1) {
    throw new ReceptionServiceError(
      'The queue entry is no longer waiting.',
      409,
    );
  }
  database
    .prepare("UPDATE reception_barbers SET status = 'busy' WHERE id = ?")
    .run(barberId);

  return { id, token: rowText(nextBooking, 'token') };
}

export function callNext(
  database: DatabaseSync,
  barberId: string,
  now = new Date(),
): { id: string; token: string } {
  return inTransaction(database, () =>
    assignNextQueueEntry(database, barberId, now),
  );
}

export function callQueueEntry(
  database: DatabaseSync,
  bookingId: string,
  barberId: string,
  now = new Date(),
): { id: string; token: string } {
  return inTransaction(database, () =>
    assignNextQueueEntry(database, barberId, now, bookingId),
  );
}

export function startService(
  database: DatabaseSync,
  bookingId: string,
  now = new Date(),
  expectedBarberId?: string,
): void {
  inTransaction(database, () => {
    const booking = database
      .prepare(
        `SELECT assigned_barber_id, service_started_at FROM reception_bookings
         WHERE id = ? AND status = 'called'`,
      )
      .get(bookingId);
    if (!booking) {
      throw new ReceptionServiceError(
        'Only a called customer can start service.',
        409,
      );
    }

    const assignedBarberId = nullableRowText(booking, 'assigned_barber_id');
    if (
      expectedBarberId &&
      (assignedBarberId !== expectedBarberId ||
        rowText(requireBarber(database, expectedBarberId), 'status') !== 'busy')
    ) {
      throw new ReceptionServiceError(
        'This service is not assigned to this barber.',
        409,
      );
    }

    const result = database
      .prepare(
        `UPDATE reception_bookings
         SET status = 'in_service', service_started_at = ?
         WHERE id = ? AND status = 'called'`,
      )
      .run(now.toISOString(), bookingId);
    if (Number(result.changes) === 0) {
      throw new ReceptionServiceError(
        'Only a called customer can start service.',
        409,
      );
    }

    if (!assignedBarberId) {
      throw new ReceptionServiceError(
        'The customer has not been assigned to a barber.',
        409,
      );
    }
    database
      .prepare(
        `INSERT INTO service_records
           (id, booking_id, barber_id, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(
        randomUUID(),
        bookingId,
        assignedBarberId,
        now.toISOString(),
        now.toISOString(),
        now.toISOString(),
      );
  });
}

export function completeService(
  database: DatabaseSync,
  bookingId: string,
  now = new Date(),
  expectedBarberId?: string,
): void {
  inTransaction(database, () => {
    const booking = database
      .prepare(
        `SELECT assigned_barber_id, service_started_at FROM reception_bookings
         WHERE id = ? AND status = 'in_service'`,
      )
      .get(bookingId);
    if (!booking) {
      throw new ReceptionServiceError(
        'Only an in-service customer can be completed.',
        409,
      );
    }

    const barberId = nullableRowText(booking, 'assigned_barber_id');
    if (
      expectedBarberId &&
      (barberId !== expectedBarberId ||
        rowText(requireBarber(database, expectedBarberId), 'status') !== 'busy')
    ) {
      throw new ReceptionServiceError(
        'This service is not assigned to this barber.',
        409,
      );
    }

    const completedAt = now.toISOString();
    database
      .prepare(
        `UPDATE reception_bookings
         SET status = 'completed', completed_at = ?
         WHERE id = ? AND status = 'in_service'`,
      )
      .run(completedAt, bookingId);

    const record = database
      .prepare('SELECT id FROM service_records WHERE booking_id = ?')
      .get(bookingId);
    if (record) {
      database
        .prepare(
          `UPDATE service_records
           SET completed_at = ?, updated_at = ?
           WHERE booking_id = ? AND completed_at IS NULL`,
        )
        .run(completedAt, completedAt, bookingId);
    } else {
      const startedAt = nullableRowText(booking, 'service_started_at');
      if (!startedAt) {
        throw new ReceptionServiceError(
          'The service start time is missing.',
          409,
        );
      }
      database
        .prepare(
          `INSERT INTO service_records
             (id, booking_id, barber_id, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          bookingId,
          barberId,
          startedAt,
          completedAt,
          startedAt,
          completedAt,
        );
    }

    if (barberId) {
      database
        .prepare("UPDATE reception_barbers SET status = 'available' WHERE id = ?")
        .run(barberId);
    }
  });
}

function markWaitingBooking(
  database: DatabaseSync,
  bookingId: string,
  status: 'cancelled' | 'no_show',
): void {
  const result = database
    .prepare(
      `UPDATE reception_bookings
       SET status = ?
       WHERE id = ? AND status = 'waiting'`,
    )
    .run(status, bookingId);

  if (Number(result.changes) === 0) {
    throw new ReceptionServiceError(
      'Only a waiting customer can be cancelled or marked No-show.',
      409,
    );
  }
}

export function cancelWaitingBooking(database: DatabaseSync, bookingId: string): void {
  inTransaction(database, () => markWaitingBooking(database, bookingId, 'cancelled'));
}

export function markWaitingBookingNoShow(
  database: DatabaseSync,
  bookingId: string,
): void {
  inTransaction(database, () => markWaitingBooking(database, bookingId, 'no_show'));
}

function getBookingDurationMinutes(
  database: DatabaseSync,
  row: Record<string, SQLOutputValue>,
): number {
  const durationMinutes = numberValue(row['duration_minutes']);
  if (durationMinutes > 0) return durationMinutes;

  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  return getBookingServiceDetails(database, rowText(row, 'id'), serviceIds)
    .durationMinutes;
}

function estimateWaitingQueue(
  database: DatabaseSync,
  now: Date,
): Map<string, number | null> {
  const waiting = database
    .prepare(
      `SELECT id, preferred_barber_id, service_ids, duration_minutes
       FROM reception_bookings
       WHERE status = 'waiting'
       ORDER BY queue_order`,
    )
    .all();
  const minuteInMs = 60_000;
  const nowInMs = now.getTime();
  const barberSlots = database
    .prepare(
      `SELECT id FROM reception_barbers
       WHERE status != 'on_break' AND is_active = 1`,
    )
    .all()
    .map((barber) => {
      const barberId = rowText(barber, 'id');
      const active = database
        .prepare(
          `SELECT id, status, service_started_at, service_ids, duration_minutes
           FROM reception_bookings
           WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
           LIMIT 1`,
        )
        .get(barberId);
      let availableAt = nowInMs;

      if (active && rowText(active, 'status') === 'called') {
        availableAt +=
          getBookingDurationMinutes(database, active) * minuteInMs;
      } else if (active) {
        const startedAt = nullableRowText(active, 'service_started_at');
        if (startedAt) {
          availableAt = Math.max(
            nowInMs,
            Date.parse(startedAt) +
              getBookingDurationMinutes(database, active) * minuteInMs,
          );
        }
      }

      return { id: barberId, availableAt };
    });

  const estimates = new Map<string, number | null>();
  for (const entry of waiting) {
    const bookingId = rowText(entry, 'id');
    const preferredBarberId = nullableRowText(entry, 'preferred_barber_id');
    const slot = barberSlots
      .filter(
        (candidate) =>
          preferredBarberId === null || candidate.id === preferredBarberId,
      )
      .sort((left, right) => left.availableAt - right.availableAt)[0];

    if (!slot) {
      estimates.set(bookingId, null);
      continue;
    }

    estimates.set(
      bookingId,
      Math.max(0, Math.ceil((slot.availableAt - nowInMs) / minuteInMs)),
    );
    slot.availableAt +=
      getBookingDurationMinutes(database, entry) * minuteInMs;
  }

  return estimates;
}

export function getReceptionDashboard(
  database: DatabaseSync,
  now = new Date(),
  filters: {
    search?: string;
    status?: string;
    barberId?: string;
  } = {},
): ReceptionDashboard {
  const businessDate = datePartsInBusinessTimeZone(now);
  const dayStart = startOfBusinessDay(
    businessDate.year,
    businessDate.month,
    businessDate.day,
  ).toISOString();
  const nextDate = new Date(
    Date.UTC(businessDate.year, businessDate.month - 1, businessDate.day + 1),
  );
  const dayEnd = startOfBusinessDay(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
  ).toISOString();

  const barbers = database
    .prepare(
      'SELECT id, name, photo_url, status, is_active FROM reception_barbers WHERE is_active = 1 ORDER BY created_at, id',
    )
    .all()
    .map((row) => mapBarber(database, row, now));
  const estimatedWaits = estimateWaitingQueue(database, now);

  const bookings = database
    .prepare(
      `SELECT booking.id, booking.token, booking.customer_name, booking.service_ids,
              booking.duration_minutes, booking.total_price_rupees,
              booking.preferred_barber_id,
              preferred.name AS preferred_barber_name, booking.assigned_barber_id,
              assigned.name AS assigned_barber_name, booking.status, booking.created_at,
              booking.called_at
       FROM reception_bookings AS booking
       LEFT JOIN reception_barbers AS preferred
         ON preferred.id = booking.preferred_barber_id
       LEFT JOIN reception_barbers AS assigned
         ON assigned.id = booking.assigned_barber_id
       WHERE booking.status IN ('waiting', 'called', 'in_service')
         AND (? = '' OR lower(booking.customer_name) LIKE '%' || lower(?) || '%'
              OR lower(booking.token) LIKE '%' || lower(?) || '%')
         AND (? = '' OR booking.status = ?)
         AND (? = '' OR booking.assigned_barber_id = ?)
       ORDER BY booking.queue_order`,
    )
    .all(
      filters.search?.trim() ?? '',
      filters.search?.trim() ?? '',
      filters.search?.trim() ?? '',
      filters.status ?? '',
      filters.status ?? '',
      filters.barberId ?? '',
      filters.barberId ?? '',
    )
    .map((row) => {
      const booking = mapBooking(database, row, now);
      const estimatedWaitMinutes =
        booking.status === 'waiting'
          ? (estimatedWaits.get(booking.id) ?? null)
          : booking.status === 'called' || booking.status === 'in_service'
            ? 0
            : null;

      return { ...booking, estimatedWaitMinutes };
    });

  const metrics = database
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
         SUM(CASE WHEN status = 'in_service' THEN 1 ELSE 0 END) AS in_service
       FROM reception_bookings
       WHERE status IN ('waiting', 'in_service')`,
    )
    .get();
  const servedToday = database
    .prepare(
      `SELECT COUNT(*) AS count FROM reception_bookings
       WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
    )
    .get(dayStart, dayEnd);

  return {
    queueOpen: isQueueOpen(database),
    generatedAt: now.toISOString(),
    overview: {
      waiting: numberValue(metrics?.['waiting']),
      inService: numberValue(metrics?.['in_service']),
      availableBarbers: barbers.filter((barber) => barber.status === 'available').length,
      servedToday: numberValue(servedToday?.['count']),
    },
    services: listSalonServices(database),
    barbers,
    bookings,
  };
}

function mapBarberDashboardBooking(
  database: DatabaseSync,
  row: Record<string, SQLOutputValue>,
): BarberDashboardBooking {
  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  const services = getBookingServiceDetails(
    database,
    rowText(row, 'id'),
    serviceIds,
  );
  return {
    id: rowText(row, 'id'),
    token: rowText(row, 'token'),
    customerName: rowText(row, 'customer_name'),
    serviceNames: services.names,
    serviceDurationMinutes:
      numberValue(row['duration_minutes']) || services.durationMinutes,
    totalPriceRupees:
      numberValue(row['total_price_rupees']) || services.totalPriceRupees,
    status: rowText(row, 'status') as BarberDashboardBooking['status'],
    createdAt: rowText(row, 'created_at'),
    serviceStartedAt: nullableRowText(row, 'service_started_at'),
  };
}

export function getBarberDashboard(
  database: DatabaseSync,
  barberId: string,
  now = new Date(),
): BarberDashboard {
  const barber = requireBarber(database, barberId);

  const current = database
    .prepare(
      `SELECT id, token, customer_name, service_ids, duration_minutes,
              total_price_rupees, status, created_at, service_started_at
       FROM reception_bookings
       WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
       ORDER BY queue_order
       LIMIT 1`,
    )
    .get(barberId);
  const next = database
    .prepare(
      `SELECT id, token, customer_name, service_ids, duration_minutes,
             total_price_rupees, status, created_at, service_started_at
       FROM reception_bookings
       WHERE status = 'waiting'
         AND (preferred_barber_id IS NULL OR preferred_barber_id = ?)
       ORDER BY queue_order
       LIMIT 1`,
    )
    .get(barberId);

  return {
    generatedAt: now.toISOString(),
    barber: {
      id: rowText(barber, 'id'),
      name: rowText(barber, 'name'),
      photoUrl: nullableRowText(barber, 'photo_url'),
      status: rowText(barber, 'status') as BarberStatus,
      isActive: numberValue(barber['is_active']) === 1,
    },
    currentCustomer: current ? mapBarberDashboardBooking(database, current) : null,
    nextCustomer: next ? mapBarberDashboardBooking(database, next) : null,
  };
}

export function getQueueEntryStatus(
  database: DatabaseSync,
  bookingId: string,
  now = new Date(),
): QueueEntryStatus {
  const row = database
    .prepare(
      `SELECT booking.id, booking.token, booking.customer_name,
              booking.service_ids, booking.duration_minutes,
              booking.total_price_rupees, booking.status, booking.created_at,
              booking.service_started_at, booking.preferred_barber_id,
              preferred.name AS preferred_barber_name, booking.assigned_barber_id,
              assigned.name AS assigned_barber_name, booking.queue_order
       FROM reception_bookings AS booking
       LEFT JOIN reception_barbers AS preferred
         ON preferred.id = booking.preferred_barber_id
       LEFT JOIN reception_barbers AS assigned
         ON assigned.id = booking.assigned_barber_id
       WHERE booking.id = ?`,
    )
    .get(bookingId);
  if (!row) throw new ReceptionServiceError('Queue entry not found.', 404);

  const booking = mapBarberDashboardBooking(database, row);
  if (booking.status !== 'waiting') {
    return {
      ...booking,
      preferredBarberId: nullableRowText(row, 'preferred_barber_id'),
      preferredBarberName:
        nullableRowText(row, 'preferred_barber_name') ?? 'Any barber',
      assignedBarberId: nullableRowText(row, 'assigned_barber_id'),
      assignedBarberName: nullableRowText(row, 'assigned_barber_name'),
      position: null,
      customersAhead: 0,
      estimatedWaitMinutes:
        booking.status === 'called' || booking.status === 'in_service' ? 0 : null,
    };
  }

  const waiting = database
    .prepare(
      `SELECT id
       FROM reception_bookings
       WHERE status = 'waiting'
       ORDER BY queue_order`,
    )
    .all();
  const position =
    waiting.findIndex((entry) => rowText(entry, 'id') === bookingId) + 1;
  const estimatedWaitMinutes =
    estimateWaitingQueue(database, now).get(bookingId) ?? null;

  return {
    ...booking,
    preferredBarberId: nullableRowText(row, 'preferred_barber_id'),
    preferredBarberName:
      nullableRowText(row, 'preferred_barber_name') ?? 'Any barber',
    assignedBarberId: nullableRowText(row, 'assigned_barber_id'),
    assignedBarberName: nullableRowText(row, 'assigned_barber_name'),
    position: position > 0 ? position : null,
    customersAhead: position > 0 ? position - 1 : 0,
    estimatedWaitMinutes,
  };
}

export function getOwnerDailyStatistics(
  database: DatabaseSync,
  day?: string,
  now = new Date(),
): {
  day: string;
  waiting: number;
  inService: number;
  completed: number;
  completedServiceCount: number;
  currentWaiting: number;
  cancelled: number;
  noShow: number;
  availableBarbers: number;
  totalSalesRupees: number;
  nextTokenSequence: number;
  activeBarbers: number;
  averageWaitMinutes: number | null;
} {
  let businessDate = datePartsInBusinessTimeZone(now);
  if (day !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new ReceptionServiceError('Day must use YYYY-MM-DD format.', 400);
    }
    const parsed = new Date(`${day}T12:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}` !== day
    ) {
      throw new ReceptionServiceError('Day must be a valid calendar date.', 400);
    }
    businessDate = {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate(),
    };
  }
  const dayStart = startOfBusinessDay(
    businessDate.year,
    businessDate.month,
    businessDate.day,
  ).toISOString();
  const nextDate = new Date(
    Date.UTC(businessDate.year, businessDate.month - 1, businessDate.day + 1),
  );
  const dayEnd = startOfBusinessDay(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
  ).toISOString();
  const queueMetrics = database
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
         SUM(CASE WHEN status = 'in_service' THEN 1 ELSE 0 END) AS in_service,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
         SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show
       FROM reception_bookings
       WHERE created_at >= ? AND created_at < ?`,
    )
    .get(dayStart, dayEnd);
  const completedMetrics = database
    .prepare(
      `SELECT COUNT(*) AS completed,
              COALESCE(SUM(total_price_rupees), 0) AS sales
       FROM reception_bookings
       WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
    )
    .get(dayStart, dayEnd);
  const completedServiceCount = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM booking_services AS line
       INNER JOIN reception_bookings AS booking ON booking.id = line.booking_id
       WHERE booking.status = 'completed'
         AND booking.completed_at >= ? AND booking.completed_at < ?`,
    )
    .get(dayStart, dayEnd);
  const availableBarbers = database
    .prepare(
      "SELECT COUNT(*) AS count FROM reception_barbers WHERE status = 'available' AND is_active = 1",
    )
    .get();
  const activeBarbers = database
    .prepare('SELECT COUNT(*) AS count FROM reception_barbers WHERE is_active = 1')
    .get();
  const currentWaiting = database
    .prepare("SELECT COUNT(*) AS count FROM reception_bookings WHERE status = 'waiting'")
    .get();
  const averageWait = database
    .prepare(
      `SELECT ROUND(AVG(
         MAX(0, (julianday(called_at) - julianday(created_at)) * 1440)
       )) AS minutes
       FROM reception_bookings
       WHERE called_at >= ? AND called_at < ?`,
    )
    .get(dayStart, dayEnd);
  const dailyQueue = database
    .prepare(
      `SELECT next_token_sequence
       FROM daily_queue_information
       WHERE queue_day = ?`,
    )
    .get(
      `${businessDate.year}-${String(businessDate.month).padStart(2, '0')}-${String(businessDate.day).padStart(2, '0')}`,
    );
  return {
    day: `${businessDate.year}-${String(businessDate.month).padStart(2, '0')}-${String(businessDate.day).padStart(2, '0')}`,
    waiting: numberValue(queueMetrics?.['waiting']),
    inService: numberValue(queueMetrics?.['in_service']),
    completed: numberValue(completedMetrics?.['completed']),
    completedServiceCount: numberValue(completedServiceCount?.['count']),
    currentWaiting: numberValue(currentWaiting?.['count']),
    cancelled: numberValue(queueMetrics?.['cancelled']),
    noShow: numberValue(queueMetrics?.['no_show']),
    availableBarbers: numberValue(availableBarbers?.['count']),
    activeBarbers: numberValue(activeBarbers?.['count']),
    totalSalesRupees: numberValue(completedMetrics?.['sales']),
    averageWaitMinutes:
      averageWait?.['minutes'] === null ||
      averageWait?.['minutes'] === undefined
        ? null
        : numberValue(averageWait['minutes']),
    nextTokenSequence: numberValue(dailyQueue?.['next_token_sequence']) || 1,
  };
}

export function getBookingStatus(
  database: DatabaseSync,
  bookingId: string,
): BookingStatus | null {
  const booking = database
    .prepare('SELECT status FROM reception_bookings WHERE id = ?')
    .get(bookingId);
  return booking ? (rowText(booking, 'status') as BookingStatus) : null;
}
