import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { ReceptionServiceError } from './reception.service.js';

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
  tokenVersion: number;
  tokenExpiresAt: number | null;
}

export type PublicAuthUser = Omit<AuthUser, 'tokenVersion' | 'tokenExpiresAt'>;

export function publicAuthUser(user: AuthUser): PublicAuthUser {
  const {
    tokenVersion: _tokenVersion,
    tokenExpiresAt: _tokenExpiresAt,
    ...publicUser
  } = user;
  return publicUser;
}

export interface NewCustomerAccount {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export interface NewStaffAccount {
  name: string;
  email: string;
  username?: string;
  password: string;
  role: 'RECEPTIONIST' | 'BARBER';
  barberId?: string;
}

export interface StaffAccountUpdate {
  name?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
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

const accessTokenLifetime = '30m';
const passwordMinimumLength = 12;
const bcryptCost = 12;

function authError(message: string, statusCode: number): ReceptionServiceError {
  return new ReceptionServiceError(message, statusCode);
}

function requiredText(value: unknown, label: string, maximumLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw authError(`${label} is required.`, 400);
  }
  const result = value.trim();
  if (result.length > maximumLength) {
    throw authError(`${label} is too long.`, 400);
  }
  return result;
}

function inputObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw authError('A valid JSON object is required.', 400);
  }
  return value as Record<string, unknown>;
}

function normalizedEmail(value: unknown): string {
  const email = requiredText(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw authError('Enter a valid email address.', 400);
  }
  return email;
}

function validatedPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < passwordMinimumLength) {
    throw authError(
      `Password must contain at least ${passwordMinimumLength} characters.`,
      400,
    );
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw authError('Password must not exceed 72 UTF-8 bytes.', 400);
  }
  return value;
}

function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
  }
  return new TextEncoder().encode(secret);
}

export function assertJwtSecretConfigured(): void {
  jwtSecret();
}

function dbText(row: Record<string, SQLOutputValue>, field: string): string {
  const value = row[field];
  if (value === null || value === undefined) {
    throw new Error(`Database row is missing ${field}.`);
  }
  return String(value);
}

function dbNullableText(
  row: Record<string, SQLOutputValue>,
  field: string,
): string | null {
  const value = row[field];
  return value === null || value === undefined ? null : String(value);
}

function mapAuthUser(row: Record<string, SQLOutputValue>): AuthUser {
  const role = dbText(row, 'role');
  if (!['OWNER', 'RECEPTIONIST', 'BARBER', 'CUSTOMER'].includes(role)) {
    throw new Error('Database contains an unsupported user role.');
  }
  return {
    id: dbText(row, 'id'),
    name: dbText(row, 'name'),
    email: dbText(row, 'email'),
    username: dbNullableText(row, 'username'),
    role: role as UserRole,
    barberId: dbNullableText(row, 'barber_id'),
    customerId: dbNullableText(row, 'customer_id'),
    customerPhoneNumber: dbNullableText(row, 'customer_phone_number'),
    activeQueueId: dbNullableText(row, 'active_queue_id'),
    tokenVersion: Number(row['token_version']),
    tokenExpiresAt: null,
  };
}

function findAuthUser(database: DatabaseSync, userId: string): AuthUser | null {
  const row = database.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.username,
      u.role,
      u.barber_id,
      u.customer_id,
      u.token_version,
      c.phone_number AS customer_phone_number,
      (
        SELECT b.id
        FROM reception_bookings b
        WHERE b.customer_id = u.customer_id
          AND b.status IN ('waiting', 'called', 'in_service')
        ORDER BY b.queue_order ASC
        LIMIT 1
      ) AS active_queue_id
    FROM users u
    LEFT JOIN customers c ON c.id = u.customer_id
    WHERE u.id = ? AND u.is_active = 1
  `).get(userId) as Record<string, SQLOutputValue> | undefined;
  return row ? mapAuthUser(row) : null;
}

export async function createAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ version: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(accessTokenLifetime)
    .sign(jwtSecret());
}

export async function authenticateAccessToken(
  database: DatabaseSync,
  token: string,
): Promise<AuthUser | null> {
  let subject: string;
  let version: unknown;
  let expiresAt: number | undefined;
  try {
    const verified = await jwtVerify(token, jwtSecret(), {
      algorithms: ['HS256'],
    });
    subject = verified.payload.sub ?? '';
    version = verified.payload.version;
    expiresAt = verified.payload.exp;
  } catch {
    return null;
  }
  if (!subject || typeof version !== 'number') return null;
  const user = findAuthUser(database, subject);
  return user && user.tokenVersion === version
    ? { ...user, tokenExpiresAt: expiresAt ? expiresAt * 1000 : null }
    : null;
}

function checkUniqueAccountFields(
  database: DatabaseSync,
  email: string,
  username: string | null,
): void {
  const existingEmail = database
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email);
  if (existingEmail) throw authError('An account with this email already exists.', 409);

  if (username) {
    const existingUsername = database
      .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
      .get(username);
    if (existingUsername) {
      throw authError('An account with this username already exists.', 409);
    }
  }
}

function createCustomerAccountRecord(
  database: DatabaseSync,
  input: Pick<NewCustomerAccount, 'name' | 'email' | 'phoneNumber'>,
  passwordHash: string,
): string {
  const customerId = randomUUID();
  const userId = randomUUID();
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO customers (id, name, phone_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerId, input.name, input.phoneNumber, now, now);
    database.prepare(`
      INSERT INTO users
        (id, name, email, password_hash, role, customer_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'CUSTOMER', ?, 1, ?, ?)
    `).run(userId, input.name, input.email, passwordHash, customerId, now, now);
    database.exec('COMMIT');
    return userId;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export async function registerCustomer(
  database: DatabaseSync,
  rawInput: unknown,
): Promise<AuthUser> {
  const input = inputObject(rawInput);
  const name = requiredText(input['name'], 'Name', 100);
  const email = normalizedEmail(input['email']);
  const phoneNumber = requiredText(input['phoneNumber'], 'Phone number', 20)
    .replace(/\D/g, '');
  if (!/^\d{10}$/.test(phoneNumber)) {
    throw authError('Enter a valid 10-digit phone number.', 400);
  }
  const password = validatedPassword(input['password']);
  checkUniqueAccountFields(database, email, null);
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const userId = createCustomerAccountRecord(
    database,
    { name, email, phoneNumber },
    passwordHash,
  );
  const user = findAuthUser(database, userId);
  if (!user) throw new Error('New customer account could not be loaded.');
  return user;
}

export async function login(
  database: DatabaseSync,
  rawInput: unknown,
): Promise<AuthUser | null> {
  const input = inputObject(rawInput);
  const identifier = requiredText(input['identifier'], 'Email or username', 254);
  const password =
    typeof input['password'] === 'string' ? input['password'] : '';
  const row = database.prepare(`
    SELECT id, password_hash
    FROM users
    WHERE is_active = 1
      AND (email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE)
    LIMIT 1
  `).get(identifier, identifier) as
    | Record<string, SQLOutputValue>
    | undefined;
  const matches = row
    ? await bcrypt.compare(password, dbText(row, 'password_hash'))
    : false;
  if (!row || !matches) return null;
  return findAuthUser(database, dbText(row, 'id'));
}

export async function seedInitialOwner(
  database: DatabaseSync,
  rawInput: { name: unknown; email: unknown; password: unknown },
): Promise<void> {
  const name = requiredText(rawInput.name, 'Owner name', 100);
  const email = normalizedEmail(rawInput.email);
  const password = validatedPassword(rawInput.password);
  const ownerExists = database
    .prepare("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1")
    .get();
  if (ownerExists) {
    throw authError('An owner account already exists; no account was created.', 409);
  }
  checkUniqueAccountFields(database, email, null);
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO users
      (id, name, email, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'OWNER', 1, ?, ?)
  `).run(randomUUID(), name, email, passwordHash, now, now);
}

function mapStaffAccount(row: Record<string, SQLOutputValue>): StaffAccount {
  const role = dbText(row, 'role');
  if (role !== 'RECEPTIONIST' && role !== 'BARBER') {
    throw new Error('Staff account query returned a non-staff role.');
  }
  return {
    id: dbText(row, 'id'),
    name: dbText(row, 'name'),
    email: dbText(row, 'email'),
    username: dbNullableText(row, 'username'),
    role,
    barberId: dbNullableText(row, 'barber_id'),
    isActive: Number(row['is_active']) === 1,
    createdAt: dbText(row, 'created_at'),
    updatedAt: dbText(row, 'updated_at'),
  };
}

const staffSelect = `
  SELECT id, name, email, username, role, barber_id, is_active, created_at, updated_at
  FROM users
  WHERE role IN ('RECEPTIONIST', 'BARBER')
`;

export function listStaffAccounts(database: DatabaseSync): StaffAccount[] {
  return (database.prepare(`${staffSelect} ORDER BY created_at DESC`).all() as
    Record<string, SQLOutputValue>[]).map(mapStaffAccount);
}

export async function createStaffAccount(
  database: DatabaseSync,
  rawInput: unknown,
): Promise<StaffAccount> {
  const input = inputObject(rawInput);
  const name = requiredText(input['name'], 'Name', 100);
  const email = normalizedEmail(input['email']);
  const username = input['username'] === undefined || input['username'] === ''
    ? null
    : requiredText(input['username'], 'Username', 30);
  if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    throw authError('Username must be 3-30 letters, numbers, dots, underscores, or hyphens.', 400);
  }
  const password = validatedPassword(input['password']);
  const role = input['role'];
  if (role !== 'RECEPTIONIST' && role !== 'BARBER') {
    throw authError('Staff role must be RECEPTIONIST or BARBER.', 400);
  }
  const barberId = input['barberId'] === undefined || input['barberId'] === ''
    ? null
    : requiredText(input['barberId'], 'Barber ID', 100);
  if ((role === 'BARBER') !== (barberId !== null)) {
    throw authError('A barber account must be linked to one barber profile.', 400);
  }
  if (barberId) {
    const barber = database
      .prepare('SELECT id FROM reception_barbers WHERE id = ? AND is_active = 1')
      .get(barberId);
    if (!barber) throw authError('The selected barber is not active.', 404);
    if (database.prepare('SELECT id FROM users WHERE barber_id = ?').get(barberId)) {
      throw authError('This barber already has an account.', 409);
    }
  }
  checkUniqueAccountFields(database, email, username);
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const now = new Date().toISOString();
  const userId = randomUUID();
  database.prepare(`
    INSERT INTO users
      (id, name, email, username, password_hash, role, barber_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(userId, name, email, username, passwordHash, role, barberId, now, now);
  const row = database
    .prepare(`${staffSelect} AND id = ?`)
    .get(userId) as Record<string, SQLOutputValue> | undefined;
  if (!row) throw new Error('New staff account could not be loaded.');
  return mapStaffAccount(row);
}

export async function updateStaffAccount(
  database: DatabaseSync,
  userId: string,
  rawInput: unknown,
): Promise<StaffAccount> {
  const input = inputObject(rawInput);
  if (input['role'] !== undefined || input['barberId'] !== undefined) {
    throw authError('Staff roles and barber assignments cannot be changed here.', 400);
  }
  const current = database
    .prepare(`${staffSelect} AND id = ?`)
    .get(userId) as Record<string, SQLOutputValue> | undefined;
  if (!current) throw authError('Staff account not found.', 404);

  const updates: string[] = [];
  const values: Array<string | number> = [];
  let revokeSessions = false;
  if (input['name'] !== undefined) {
    updates.push('name = ?');
    values.push(requiredText(input['name'], 'Name', 100));
  }
  if (input['email'] !== undefined) {
    const email = normalizedEmail(input['email']);
    const duplicate = database
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email, userId);
    if (duplicate) throw authError('An account with this email already exists.', 409);
    updates.push('email = ?');
    values.push(email);
  }
  if (input['password'] !== undefined) {
    const hash = await bcrypt.hash(validatedPassword(input['password']), bcryptCost);
    updates.push('password_hash = ?');
    values.push(hash);
    revokeSessions = true;
  }
  if (input['isActive'] !== undefined) {
    if (typeof input['isActive'] !== 'boolean') {
      throw authError('isActive must be a boolean.', 400);
    }
    updates.push('is_active = ?');
    values.push(input['isActive'] ? 1 : 0);
    revokeSessions = true;
  }
  if (revokeSessions) updates.push('token_version = token_version + 1');
  if (updates.length === 0) {
    throw authError('Provide a name, email, password, or active status to update.', 400);
  }
  updates.push('updated_at = ?');
  values.push(new Date().toISOString(), userId);
  database.prepare(`
    UPDATE users SET ${updates.join(', ')}
    WHERE id = ? AND role IN ('RECEPTIONIST', 'BARBER')
  `).run(...values);
  const row = database
    .prepare(`${staffSelect} AND id = ?`)
    .get(userId) as Record<string, SQLOutputValue> | undefined;
  if (!row) throw new Error('Updated staff account could not be loaded.');
  return mapStaffAccount(row);
}

export function incrementTokenVersion(database: DatabaseSync, userId: string): void {
  database.prepare(`
    UPDATE users SET token_version = token_version + 1, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), userId);
}
