import { randomUUID } from 'node:crypto';
import { Database, type DatabaseRow } from '../database/client.js';
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

function rowText(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new Error(`Database row is missing ${column}.`);
  }
  return String(value);
}

function nullableRowText(
  row: DatabaseRow,
  column: string,
): string | null {
  const value = row[column];
  return value === null || value === undefined ? null : String(value);
}

function numberValue(value: unknown): number {
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

function inTransaction<T>(
  database: Database,
  action: () => Promise<T>,
): Promise<T> {
  return database.transaction(action);
}

async function requireBarber(
  database: Database,
  barberId: string,
): Promise<DatabaseRow> {
  if (!uuidPattern.test(barberId)) {
    throw new ReceptionServiceError('Invalid barber ID.', 400);
  }
  const barber = await database
    .prepare(
      'SELECT id, name, photo_url, status, is_active FROM reception_barbers WHERE id = ?',
    )
    .get(barberId);

  if (!barber) {
    throw new ReceptionServiceError('Barber not found.', 404);
  }

  return barber;
}

async function getServiceDetails(
  database: Database,
  serviceIds: string[],
  activeOnly = true,
): Promise<{
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
}> {
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
  const selected = await Promise.all(serviceIds.map(async (id) => {
    const service = await selectService.get(id);
    if (!service || (activeOnly && numberValue(service['is_active']) !== 1)) {
      throw new ReceptionServiceError('One or more selected services are invalid or inactive.', 400);
    }
    return {
      id: rowText(service, 'id'),
      name: rowText(service, 'name'),
      durationMinutes: numberValue(service['duration_minutes']),
      priceRupees: numberValue(service['price_rupees']),
    };
  }));

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

async function getBookingServiceDetails(
  database: Database,
  bookingId: string,
  serviceIds: string[],
): ReturnType<typeof getServiceDetails> {
  const snapshots = await database
    .prepare(
      `SELECT service_id, service_name, duration_minutes, price_rupees
       FROM booking_services
       WHERE booking_id = ?
       ORDER BY service_id`,
    )
    .all(bookingId);
  if (snapshots.length) {
    const servicesById = new Map(
      snapshots.map((row) => [rowText(row, 'service_id'), row]),
    );
    const services = serviceIds
      .map((serviceId) => servicesById.get(serviceId))
      .filter((row): row is DatabaseRow => row !== undefined)
      .map((row) => ({
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
  row: DatabaseRow,
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
  row: DatabaseRow,
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

export async function createCustomer(
  database: Database,
  input: unknown,
  now = new Date(),
): Promise<CustomerRecord> {
  const values = inputRecord(input);
  const name = requiredText(values['name'], 'Customer name', 100);
  const phoneNumber = validatePhoneNumber(values['phoneNumber']);
  const id = randomUUID();
  const timestamp = now.toISOString();

  await database
    .prepare(
      `INSERT INTO customers (id, name, phone_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, name, phoneNumber, timestamp, timestamp);

  const customer = await database
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(id);
  if (!customer) throw new Error('Created customer could not be loaded.');
  return mapCustomer(customer);
}

export async function getCustomer(
  database: Database,
  customerId: string,
): Promise<CustomerRecord> {
  if (!uuidPattern.test(customerId)) {
    throw new ReceptionServiceError('Invalid customer ID.', 400);
  }
  const customer = await database
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(customerId);
  if (!customer) throw new ReceptionServiceError('Customer not found.', 404);
  return mapCustomer(customer);
}

export async function listSalonServices(
  database: Database,
  includeInactive = false,
): Promise<SalonServiceRecord[]> {
  const query = includeInactive
    ? 'SELECT * FROM salon_services ORDER BY name, id'
    : 'SELECT * FROM salon_services WHERE is_active = 1 ORDER BY name, id';
  return (await database.prepare(query).all()).map(mapSalonService);
}

export async function getSalonService(
  database: Database,
  serviceId: string,
  includeInactive = false,
): Promise<SalonServiceRecord> {
  const service = await database
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

export async function createSalonService(
  database: Database,
  input: unknown,
  now = new Date(),
): Promise<SalonServiceRecord> {
  const values = validateServiceInput(inputRecord(input));
  const duplicate = await database
    .prepare('SELECT id FROM salon_services WHERE lower(name) = lower(?)')
    .get(values.name);
  if (duplicate) throw new ReceptionServiceError('A service with this name already exists.', 409);

  const id = randomUUID();
  const timestamp = now.toISOString();
  await database
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

export async function updateSalonService(
  database: Database,
  serviceId: string,
  input: unknown,
): Promise<SalonServiceRecord> {
  const current = await getSalonService(database, serviceId, true);
  const values = validateServiceInput(inputRecord(input), current);
  const duplicate = await database
    .prepare(
      'SELECT id FROM salon_services WHERE lower(name) = lower(?) AND id != ?',
    )
    .get(values.name, serviceId);
  if (duplicate) throw new ReceptionServiceError('A service with this name already exists.', 409);

  await database
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

async function isQueueOpen(database: Database): Promise<boolean> {
  const setting = await database
    .prepare(
      "SELECT setting_value FROM reception_settings WHERE setting_key = 'queue_open'",
    )
    .get();
  return setting?.['setting_value'] === '1';
}

async function mapBooking(
  database: Database,
  row: DatabaseRow,
  now: Date,
): Promise<ReceptionBooking> {
  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  const services = await getBookingServiceDetails(
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

async function mapBarber(
  database: Database,
  row: DatabaseRow,
  now: Date,
): Promise<ReceptionBarber> {
  const id = rowText(row, 'id');
  const current = await database
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

  const services = await getBookingServiceDetails(
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

export async function createBarber(
  database: Database,
  input: unknown,
  now = new Date(),
): Promise<BarberRecord> {
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
  await database
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

export async function getBarberRecord(
  database: Database,
  barberId: string,
): Promise<BarberRecord> {
  if (!uuidPattern.test(barberId)) {
    throw new ReceptionServiceError('Invalid barber ID.', 400);
  }
  const row = await database
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

export async function listBarberRecords(
  database: Database,
  includeInactive = false,
): Promise<BarberRecord[]> {
  return (await database
    .prepare(
      `SELECT id, name, photo_url, status, is_active, created_at, updated_at
       FROM reception_barbers
       WHERE (? = 1 OR is_active = 1)
       ORDER BY created_at, id`,
    )
    .all(includeInactive ? 1 : 0))
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

export async function updateBarberProfile(
  database: Database,
  barberId: string,
  input: unknown,
): Promise<BarberRecord> {
  const values = inputRecord(input);
  const current = await getBarberRecord(database, barberId);
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
    const activeBooking = await database
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

  await database
    .prepare(
      `UPDATE reception_barbers
       SET name = ?, photo_url = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(name, photoUrl, isActive ? 1 : 0, new Date().toISOString(), barberId);
  return getBarberRecord(database, barberId);
}

export async function updateBarberStatus(
  database: Database,
  barberId: string,
  requestedStatus: unknown,
): Promise<BarberRecord> {
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
    await setBarberAvailability(database, barberId, requestedStatus);
    return getBarberRecord(database, barberId);
  }

  await inTransaction(database, async () => {
    const barber = await requireBarber(database, barberId);
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot be marked Busy.', 409);
    }
    const activeBooking = await database
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
    await database
      .prepare("UPDATE reception_barbers SET status = 'busy' WHERE id = ?")
      .run(barberId);
  });
  return getBarberRecord(database, barberId);
}

export async function setBarberAvailability(
  database: Database,
  barberId: string,
  requestedStatus: unknown,
): Promise<void> {
  if (requestedStatus !== 'available' && requestedStatus !== 'on_break') {
    throw new ReceptionServiceError(
      'Barber status can only be changed to Available or On Break.',
      400,
    );
  }

  await inTransaction(database, async () => {
    const barber = await requireBarber(database, barberId);
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot call the queue.', 409);
    }
    if (numberValue(barber['is_active']) !== 1) {
      throw new ReceptionServiceError('An inactive barber cannot change availability.', 409);
    }
    const activeBooking = await database
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

    await database
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

async function getSetting(database: Database, key: string): Promise<string | null> {
  const row = await database
    .prepare('SELECT setting_value FROM reception_settings WHERE setting_key = ?')
    .get(key);
  return row ? rowText(row, 'setting_value') : null;
}

async function saveSetting(database: Database, key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO reception_settings (setting_key, setting_value, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
    )
    .run(key, value, now, now);
}

export async function getOwnerSettings(database: Database): Promise<OwnerSettings> {
  const [
    maxCapacity,
    workingDays,
    salonName,
    address,
    contactNumber,
    openingTime,
    closingTime,
    queueOpen,
  ] = await Promise.all([
    getSetting(database, 'queue_max_capacity'),
    getSetting(database, 'business_working_days'),
    getSetting(database, 'salon_name'),
    getSetting(database, 'salon_address'),
    getSetting(database, 'salon_contact_number'),
    getSetting(database, 'business_opening_time'),
    getSetting(database, 'business_closing_time'),
    isQueueOpen(database),
  ]);
  return {
    salonName: salonName ?? 'Salon',
    address: address ?? '',
    contactNumber: contactNumber ?? '',
    openingTime: openingTime ?? '',
    closingTime: closingTime ?? '',
    workingDays: workingDays ? (JSON.parse(workingDays) as number[]) : [],
    queueOpen,
    maxQueueCapacity:
      maxCapacity === null || maxCapacity === '' ? null : Number(maxCapacity),
  };
}

export async function updateOwnerSettings(
  database: Database,
  input: unknown,
): Promise<OwnerSettings> {
  const values = inputRecord(input);
  const current = await getOwnerSettings(database);
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

  await saveSetting(database, 'salon_name', salonName);
  await saveSetting(database, 'salon_address', address);
  await saveSetting(database, 'salon_contact_number', contactNumber);
  await saveSetting(database, 'business_opening_time', openingTime);
  await saveSetting(database, 'business_closing_time', closingTime);
  await saveSetting(database, 'business_working_days', JSON.stringify(workingDays));
  await saveSetting(
    database,
    'queue_max_capacity',
    maxQueueCapacity === null ? '' : String(maxQueueCapacity),
  );
  await setQueueOpen(database, queueOpen);
  return getOwnerSettings(database);
}

export async function setQueueOpen(database: Database, open: unknown): Promise<void> {
  if (typeof open !== 'boolean') {
    throw new ReceptionServiceError('Queue state must be true or false.', 400);
  }
  await database
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

export async function createQueueEntry(
  database: Database,
  input: unknown,
  source: 'customer' | 'walk_in',
  now = new Date(),
): Promise<CreatedQueueEntry> {
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
  const services = await getServiceDetails(database, serviceIds);
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

  return inTransaction(database, async () => {
    await database.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tokenDay]);
    if (!(await isQueueOpen(database))) {
      throw new ReceptionServiceError(
        'The queue is closed and cannot accept walk-ins.',
        409,
      );
    }
    const maxQueueCapacity = (await getOwnerSettings(database)).maxQueueCapacity;
    if (maxQueueCapacity !== null) {
      const waitingCount = await database
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
      const preferredBarber = await requireBarber(database, preferredBarberId);
      if (numberValue(preferredBarber['is_active']) !== 1) {
        throw new ReceptionServiceError('The selected barber is inactive.', 409);
      }
    }
    const customer = customerIdValue === undefined
      ? undefined
      : await getCustomer(database, customerId);
    const resolvedName = customer?.name ?? customerName;
    const resolvedPhoneNumber = customer?.phoneNumber ?? phoneNumber;
    if (!resolvedName || !resolvedPhoneNumber) {
      throw new ReceptionServiceError('Customer details are required.', 400);
    }

    const activeBooking = await database
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
      await database
        .prepare(
          `INSERT INTO customers (id, name, phone_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(customerId, resolvedName, resolvedPhoneNumber, createdAt, createdAt);
    }

    await database
      .prepare(
        `INSERT INTO daily_queue_information
           (queue_day, next_token_sequence, created_at, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT (queue_day) DO NOTHING`,
      )
      .run(tokenDay, createdAt, createdAt);
    const daily = await database
      .prepare(
        `SELECT next_token_sequence
         FROM daily_queue_information
         WHERE queue_day = ?
         FOR UPDATE`,
      )
      .get(tokenDay);
    const sequence = numberValue(daily?.['next_token_sequence']);
    const token = `S-${sequence}`;
    await database
      .prepare(
        `UPDATE daily_queue_information
         SET next_token_sequence = ?, updated_at = ?
         WHERE queue_day = ?`,
      )
      .run(sequence + 1, createdAt, tokenDay);

    await database
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
      await insertLine.run(
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
  database: Database,
  input: unknown,
  now = new Date(),
): Promise<Pick<CreatedQueueEntry, 'id' | 'token'>> {
  return createQueueEntry(database, input, 'walk_in', now);
}

async function assignNextQueueEntry(
  database: Database,
  barberId: string,
  now: Date,
  expectedBookingId?: string,
): Promise<{ id: string; token: string }> {
  const barber = await requireBarber(database, barberId);
  if (rowText(barber, 'status') !== 'available') {
    throw new ReceptionServiceError(
      'Only an available barber can call the next customer.',
      409,
    );
  }
  const activeBooking = await database
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
  const nextBooking = await database
    .prepare(
      `SELECT id, token FROM reception_bookings
       WHERE status = 'waiting'
         AND (preferred_barber_id IS NULL OR preferred_barber_id = ?)
       ORDER BY queue_order
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
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

  const result = await database
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
  await database
    .prepare("UPDATE reception_barbers SET status = 'busy' WHERE id = ?")
    .run(barberId);

  return { id, token: rowText(nextBooking, 'token') };
}

export function callNext(
  database: Database,
  barberId: string,
  now = new Date(),
): Promise<{ id: string; token: string }> {
  return inTransaction(database, async () =>
    assignNextQueueEntry(database, barberId, now),
  );
}

export function callQueueEntry(
  database: Database,
  bookingId: string,
  barberId: string,
  now = new Date(),
): Promise<{ id: string; token: string }> {
  return inTransaction(database, async () =>
    assignNextQueueEntry(database, barberId, now, bookingId),
  );
}

export async function startService(
  database: Database,
  bookingId: string,
  now = new Date(),
  expectedBarberId?: string,
): Promise<void> {
  await inTransaction(database, async () => {
    const booking = await database
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
        rowText(await requireBarber(database, expectedBarberId), 'status') !== 'busy')
    ) {
      throw new ReceptionServiceError(
        'This service is not assigned to this barber.',
        409,
      );
    }

    const result = await database
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
    await database
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

export async function completeService(
  database: Database,
  bookingId: string,
  now = new Date(),
  expectedBarberId?: string,
): Promise<void> {
  await inTransaction(database, async () => {
    const booking = await database
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
        rowText(await requireBarber(database, expectedBarberId), 'status') !== 'busy')
    ) {
      throw new ReceptionServiceError(
        'This service is not assigned to this barber.',
        409,
      );
    }

    const completedAt = now.toISOString();
    await database
      .prepare(
        `UPDATE reception_bookings
         SET status = 'completed', completed_at = ?
         WHERE id = ? AND status = 'in_service'`,
      )
      .run(completedAt, bookingId);

    const record = await database
      .prepare('SELECT id FROM service_records WHERE booking_id = ?')
      .get(bookingId);
    if (record) {
      await database
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
      await database
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
      await database
        .prepare("UPDATE reception_barbers SET status = 'available' WHERE id = ?")
        .run(barberId);
    }
  });
}

async function markWaitingBooking(
  database: Database,
  bookingId: string,
  status: 'cancelled' | 'no_show',
): Promise<void> {
  const result = await database
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

export function cancelWaitingBooking(database: Database, bookingId: string): Promise<void> {
  return inTransaction(database, () => markWaitingBooking(database, bookingId, 'cancelled'));
}

export function markWaitingBookingNoShow(
  database: Database,
  bookingId: string,
): Promise<void> {
  return inTransaction(database, () => markWaitingBooking(database, bookingId, 'no_show'));
}

async function getBookingDurationMinutes(
  database: Database,
  row: DatabaseRow,
): Promise<number> {
  const durationMinutes = numberValue(row['duration_minutes']);
  if (durationMinutes > 0) return durationMinutes;

  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  return (await getBookingServiceDetails(database, rowText(row, 'id'), serviceIds))
    .durationMinutes;
}

async function estimateWaitingQueue(
  database: Database,
  now: Date,
): Promise<Map<string, number | null>> {
  const waiting = await database
    .prepare(
      `SELECT id, preferred_barber_id, service_ids, duration_minutes
       FROM reception_bookings
       WHERE status = 'waiting'
       ORDER BY queue_order`,
    )
    .all();
  const minuteInMs = 60_000;
  const nowInMs = now.getTime();
  const barberSlots = (await database
    .prepare(
      `SELECT id FROM reception_barbers
       WHERE status != 'on_break' AND is_active = 1`,
    )
    .all())
    .map(async (barber) => {
      const barberId = rowText(barber, 'id');
      const active = await database
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
          (await getBookingDurationMinutes(database, active)) * minuteInMs;
      } else if (active) {
        const startedAt = nullableRowText(active, 'service_started_at');
        if (startedAt) {
          availableAt = Math.max(
            nowInMs,
            Date.parse(startedAt) +
              (await getBookingDurationMinutes(database, active)) * minuteInMs,
          );
        }
      }

      return { id: barberId, availableAt };
    });
  const resolvedBarberSlots = await Promise.all(barberSlots);

  const estimates = new Map<string, number | null>();
  for (const entry of waiting) {
    const bookingId = rowText(entry, 'id');
    const preferredBarberId = nullableRowText(entry, 'preferred_barber_id');
    const slot = resolvedBarberSlots
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
      (await getBookingDurationMinutes(database, entry)) * minuteInMs;
  }

  return estimates;
}

export async function getReceptionDashboard(
  database: Database,
  now = new Date(),
  filters: {
    search?: string;
    status?: string;
    barberId?: string;
  } = {},
): Promise<ReceptionDashboard> {
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

  const barbers = await Promise.all((await database
    .prepare(
      'SELECT id, name, photo_url, status, is_active FROM reception_barbers WHERE is_active = 1 ORDER BY created_at, id',
    )
    .all())
    .map((row) => mapBarber(database, row, now)));
  const estimatedWaits = await estimateWaitingQueue(database, now);

  const bookings = await Promise.all((await database
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
    ))
    .map(async (row) => {
      const booking = await mapBooking(database, row, now);
      const estimatedWaitMinutes =
        booking.status === 'waiting'
          ? (estimatedWaits.get(booking.id) ?? null)
          : booking.status === 'called' || booking.status === 'in_service'
            ? 0
            : null;

      return { ...booking, estimatedWaitMinutes };
    }));

  const metrics = await database
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
         SUM(CASE WHEN status = 'in_service' THEN 1 ELSE 0 END) AS in_service
       FROM reception_bookings
       WHERE status IN ('waiting', 'in_service')`,
    )
    .get();
  const servedToday = await database
    .prepare(
      `SELECT COUNT(*) AS count FROM reception_bookings
       WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
    )
    .get(dayStart, dayEnd);

  return {
    queueOpen: await isQueueOpen(database),
    generatedAt: now.toISOString(),
    overview: {
      waiting: numberValue(metrics?.['waiting']),
      inService: numberValue(metrics?.['in_service']),
      availableBarbers: barbers.filter((barber) => barber.status === 'available').length,
      servedToday: numberValue(servedToday?.['count']),
    },
    services: await listSalonServices(database),
    barbers,
    bookings,
  };
}

async function mapBarberDashboardBooking(
  database: Database,
  row: DatabaseRow,
): Promise<BarberDashboardBooking> {
  const serviceIds = JSON.parse(rowText(row, 'service_ids')) as string[];
  const services = await getBookingServiceDetails(
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

export async function getBarberDashboard(
  database: Database,
  barberId: string,
  now = new Date(),
): Promise<BarberDashboard> {
  const barber = await requireBarber(database, barberId);

  const current = await database
    .prepare(
      `SELECT id, token, customer_name, service_ids, duration_minutes,
              total_price_rupees, status, created_at, service_started_at
       FROM reception_bookings
       WHERE assigned_barber_id = ? AND status IN ('called', 'in_service')
       ORDER BY queue_order
       LIMIT 1`,
    )
    .get(barberId);
  const next = await database
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
    currentCustomer: current
      ? await mapBarberDashboardBooking(database, current)
      : null,
    nextCustomer: next ? await mapBarberDashboardBooking(database, next) : null,
  };
}

export async function getQueueEntryStatus(
  database: Database,
  bookingId: string,
  now = new Date(),
): Promise<QueueEntryStatus> {
  const row = await database
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

  const booking = await mapBarberDashboardBooking(database, row);
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

  const waiting = await database
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
    (await estimateWaitingQueue(database, now)).get(bookingId) ?? null;

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

export async function getOwnerDailyStatistics(
  database: Database,
  day?: string,
  now = new Date(),
): Promise<{
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
}> {
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
  const queueMetrics = await database
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
  const completedMetrics = await database
    .prepare(
      `SELECT COUNT(*) AS completed,
              COALESCE(SUM(total_price_rupees), 0) AS sales
       FROM reception_bookings
       WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
    )
    .get(dayStart, dayEnd);
  const completedServiceCount = await database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM booking_services AS line
       INNER JOIN reception_bookings AS booking ON booking.id = line.booking_id
       WHERE booking.status = 'completed'
         AND booking.completed_at >= ? AND booking.completed_at < ?`,
    )
    .get(dayStart, dayEnd);
  const availableBarbers = await database
    .prepare(
      "SELECT COUNT(*) AS count FROM reception_barbers WHERE status = 'available' AND is_active = 1",
    )
    .get();
  const activeBarbers = await database
    .prepare('SELECT COUNT(*) AS count FROM reception_barbers WHERE is_active = 1')
    .get();
  const currentWaiting = await database
    .prepare("SELECT COUNT(*) AS count FROM reception_bookings WHERE status = 'waiting'")
    .get();
  const averageWait = await database
    .prepare(
      `SELECT ROUND(AVG(
         GREATEST(0, EXTRACT(EPOCH FROM
           (called_at::timestamptz - created_at::timestamptz)) / 60)
       )) AS minutes
       FROM reception_bookings
       WHERE called_at >= ? AND called_at < ?`,
    )
    .get(dayStart, dayEnd);
  const dailyQueue = await database
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

export async function getBookingStatus(
  database: Database,
  bookingId: string,
): Promise<BookingStatus | null> {
  const booking = await database
    .prepare('SELECT status FROM reception_bookings WHERE id = ?')
    .get(bookingId);
  return booking ? (rowText(booking, 'status') as BookingStatus) : null;
}
