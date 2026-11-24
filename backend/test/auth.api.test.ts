import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createServer } from 'node:http';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { SignJWT } from 'jose';
import { DatabaseSync } from 'node:sqlite';
import { errorHandler } from '../src/middleware/error-handler.js';
import { initializeReceptionSchema } from '../src/database/reception-schema.js';
import { createApiRouter } from '../src/routes/api.routes.js';
import { createReceptionRouter } from '../src/routes/reception.routes.js';
import { registerSocketHandlers } from '../src/socket/index.js';
import {
  createAccessToken,
  registerCustomer,
  seedInitialOwner,
} from '../src/services/auth.service.js';

process.env.JWT_SECRET ??= 'test-only-jwt-secret-with-at-least-32-bytes';

interface ApiContext {
  baseUrl: string;
  database: DatabaseSync;
  close: () => Promise<void>;
}

const contexts: ApiContext[] = [];

async function createApiContext(): Promise<ApiContext> {
  const database = new DatabaseSync(':memory:');
  initializeReceptionSchema(database);
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer);
  registerSocketHandlers(io, database);
  app.use('/api', createApiRouter(database, io));
  app.use('/api/reception', createReceptionRouter(database, io));
  app.use(errorHandler);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test API did not bind to a TCP port.');
  }
  const context: ApiContext = {
    baseUrl: `http://127.0.0.1:${address.port}/api`,
    database,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      database.close();
    },
  };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

function cookieFrom(response: Response): string {
  const value = response.headers.get('set-cookie');
  if (!value) throw new Error('Authentication response did not set a cookie.');
  return value.split(';', 1)[0] ?? '';
}

async function call(
  baseUrl: string,
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('JWT authentication, role boundaries, ownership, and logout are enforced', async () => {
  const { baseUrl, database } = await createApiContext();
  await seedInitialOwner(database, {
    name: 'Owner',
    email: 'owner@example.test',
    password: 'owner-initial-password-123',
  });

  const unauthenticated = await call(baseUrl, '/owner/settings');
  assert.equal(unauthenticated.status, 401);
  const anonymousMe = await call(baseUrl, '/auth/me');
  assert.equal(anonymousMe.status, 401);
  const invalidLogin = await call(baseUrl, '/auth/login', 'POST', {
    identifier: 'owner@example.test',
    password: 'incorrect-password',
  });
  assert.equal(invalidLogin.status, 401);
  assert.match((await invalidLogin.json() as { message: string }).message, /Invalid email\/username or password/);

  const ownerLogin = await call(baseUrl, '/auth/login', 'POST', {
    identifier: 'owner@example.test',
    password: 'owner-initial-password-123',
  });
  assert.equal(ownerLogin.status, 200);
  const ownerCookie = cookieFrom(ownerLogin);
  const ownerBody = await ownerLogin.json() as {
    data: { user: { id: string; role: string; tokenVersion?: number } };
  };
  assert.equal(ownerBody.data.user.role, 'OWNER');
  assert.equal(ownerBody.data.user.tokenVersion, undefined);
  const ownerResponseJson = JSON.stringify(ownerBody);
  assert.doesNotMatch(ownerResponseJson, /password_hash|owner-initial-password/);
  assert.equal((await call(baseUrl, '/owner/settings', 'GET', undefined, ownerCookie)).status, 200);
  assert.equal((await call(baseUrl, '/owner/users', 'GET', undefined, ownerCookie)).status, 200);

  const badCustomerRegistration = await call(baseUrl, '/auth/register', 'POST', {
    name: 'Customer',
    email: 'new@example.test',
    phoneNumber: '123',
    password: 'long-enough-password-123',
    role: 'OWNER',
  });
  assert.equal(badCustomerRegistration.status, 400);
  const receptionistResponse = await call(baseUrl, '/owner/users', 'POST', {
    name: 'Front Desk',
    email: 'frontdesk@example.test',
    username: 'frontdesk',
    password: 'reception-password-123',
    role: 'RECEPTIONIST',
  }, ownerCookie);
  assert.equal(receptionistResponse.status, 201);
  const receptionistAccount = await receptionistResponse.json() as {
    data: { id: string; role: string };
  };
  assert.equal(receptionistAccount.data.role, 'RECEPTIONIST');
  assert.doesNotMatch(JSON.stringify(receptionistAccount), /password_hash|password/);

  const receptionistLogin = await call(baseUrl, '/auth/login', 'POST', {
    identifier: 'frontdesk',
    password: 'reception-password-123',
  });
  assert.equal(receptionistLogin.status, 200);
  const receptionistCookie = cookieFrom(receptionistLogin);
  assert.equal((await call(baseUrl, '/owner/settings', 'GET', undefined, receptionistCookie)).status, 403);
  assert.equal((await call(baseUrl, '/owner/users', 'GET', undefined, receptionistCookie)).status, 403);
  assert.equal((await call(baseUrl, '/reception/dashboard', 'GET', undefined, receptionistCookie)).status, 200);

  const barberProfileResponse = await call(baseUrl, '/owner/barbers', 'POST', {
    name: 'Barber One',
  }, ownerCookie);
  assert.equal(barberProfileResponse.status, 201);
  const barberProfile = await barberProfileResponse.json() as { data: { id: string } };
  const secondBarberProfileResponse = await call(baseUrl, '/owner/barbers', 'POST', {
    name: 'Barber Two',
  }, ownerCookie);
  const secondBarberProfile = await secondBarberProfileResponse.json() as {
    data: { id: string };
  };
  const barberAccountResponse = await call(baseUrl, '/owner/users', 'POST', {
    name: 'Barber One',
    email: 'barber@example.test',
    password: 'barber-test-password-123',
    role: 'BARBER',
    barberId: barberProfile.data.id,
  }, ownerCookie);
  assert.equal(barberAccountResponse.status, 201);
  const barberLogin = await call(baseUrl, '/auth/login', 'POST', {
    identifier: 'barber@example.test',
    password: 'barber-test-password-123',
  });
  const barberCookie = cookieFrom(barberLogin);
  assert.equal(
    (await call(
      baseUrl,
      `/reception/barbers/${barberProfile.data.id}/dashboard`,
      'GET',
      undefined,
      barberCookie,
    )).status,
    200,
  );
  assert.equal(
    (await call(
      baseUrl,
      `/reception/barbers/${secondBarberProfile.data.id}/dashboard`,
      'GET',
      undefined,
      barberCookie,
    )).status,
    403,
  );
  assert.equal((await call(baseUrl, '/reception/dashboard', 'GET', undefined, barberCookie)).status, 403);
  assert.equal((await call(baseUrl, '/owner/settings', 'GET', undefined, barberCookie)).status, 403);

  const customerRegistration = await call(baseUrl, '/auth/register', 'POST', {
    name: 'Customer One',
    email: 'customer-one@example.test',
    phoneNumber: '9876543210',
    password: 'customer-one-password-123',
    role: 'OWNER',
  });
  assert.equal(customerRegistration.status, 201);
  const customerCookie = cookieFrom(customerRegistration);
  const customerJson = await customerRegistration.json() as {
    data: { user: { role: string; customerId: string; tokenVersion?: number } };
  };
  assert.equal(customerJson.data.user.role, 'CUSTOMER');
  assert.equal(customerJson.data.user.tokenVersion, undefined);
  const rawCustomerPassword = database.prepare(
    'SELECT password_hash FROM users WHERE email = ?',
  ).get('customer-one@example.test') as { password_hash: string };
  assert.notEqual(rawCustomerPassword.password_hash, 'customer-one-password-123');
  assert.match(rawCustomerPassword.password_hash, /^\$2[aby]\$/);

  const customerJoin = await call(baseUrl, '/queue/join', 'POST', {
    customerName: 'Spoofed Name',
    phoneNumber: '1111111111',
    customerId: '00000000-0000-4000-8000-000000000000',
    serviceIds: ['haircut'],
    preferredBarberId: null,
  }, customerCookie);
  assert.equal(customerJoin.status, 201);
  const joined = await customerJoin.json() as {
    data: { id: string };
    queueStatus: { customerName: string };
  };
  assert.equal(joined.queueStatus.customerName, 'Customer One');
  assert.equal((await call(baseUrl, `/queue/${joined.data.id}/status`, 'GET', undefined, customerCookie)).status, 200);

  const secondCustomer = await registerCustomer(database, {
    name: 'Customer Two',
    email: 'customer-two@example.test',
    phoneNumber: '1234567890',
    password: 'customer-two-password-123',
  });
  const secondCustomerCookie = `salon_queue_access=${await createAccessToken(secondCustomer)}`;
  assert.equal(
    (await call(
      baseUrl,
      `/queue/${joined.data.id}/status`,
      'GET',
      undefined,
      secondCustomerCookie,
    )).status,
    403,
  );
  assert.equal(
    (await call(baseUrl, `/queue/${joined.data.id}/cancel`, 'POST', undefined, secondCustomerCookie)).status,
    403,
  );
  assert.equal((await call(baseUrl, '/queue', 'GET')).status, 200);
  const publicDisplayResponse = await call(baseUrl, '/queue/display');
  const publicDisplayText = await publicDisplayResponse.text();
  assert.equal(publicDisplayResponse.status, 200);
  assert.doesNotMatch(publicDisplayText, /Customer One|Spoofed Name|9876543210/);

  const expiredToken = await new SignJWT({ version: ownerBody.data.user.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ownerBody.data.user.id)
    .setIssuedAt()
    .setExpirationTime(1)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(
    (await call(baseUrl, '/auth/me', 'GET', undefined, `salon_queue_access=${expiredToken}`)).status,
    401,
  );

  const logoutResponse = await call(baseUrl, '/auth/logout', 'POST', undefined, ownerCookie);
  assert.equal(logoutResponse.status, 200);
  assert.equal(
    (await call(baseUrl, '/owner/settings', 'GET', undefined, ownerCookie)).status,
    401,
  );
  const duplicateOwnerError = await seedInitialOwner(database, {
    name: 'Second Owner',
    email: 'second-owner@example.test',
    password: 'another-owner-password-123',
  }).then(() => null, (error: unknown) => error);
  assert.ok(duplicateOwnerError instanceof Error);
  assert.match(duplicateOwnerError.message, /already exists/);
});
