import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, test } from 'node:test';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
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
import { login } from '../src/services/auth.service.js';

interface ApiContext {
  baseUrl: string;
  apiUrl: string;
  close: () => Promise<void>;
  originalFetch: typeof fetch;
}

const contexts: ApiContext[] = [];

async function createApiContext(): Promise<ApiContext> {
  process.env.JWT_SECRET ??= 'test-only-jwt-secret-with-at-least-32-bytes';
  const database = new DatabaseSync(':memory:');
  initializeReceptionSchema(database);
  await seedInitialOwner(database, {
    name: 'Test Owner',
    email: 'owner@example.test',
    password: 'owner-test-password-123',
  });
  const owner = await login(database, {
    identifier: 'owner@example.test',
    password: 'owner-test-password-123',
  });
  if (!owner) throw new Error('Test owner login failed.');
  const ownerToken = await createAccessToken(owner);
  const customer = await registerCustomer(database, {
    name: 'Test Customer',
    email: 'customer@example.test',
    phoneNumber: '9876543210',
    password: 'customer-test-password-123',
  });
  const customerToken = await createAccessToken(customer);

  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer);
  registerSocketHandlers(io, database);
  app.use('/api', createApiRouter(database, io));
  app.use('/api/reception', createReceptionRouter(database, io));
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test API did not bind to a TCP port.');
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const headers = new Headers(init?.headers);
    headers.set(
      'Cookie',
      `salon_queue_access=${url.includes('/queue/join') ? customerToken : ownerToken}`,
    );
    return originalFetch(input, { ...init, headers });
  }) as typeof fetch;
  const context: ApiContext = {
    baseUrl: `http://127.0.0.1:${address.port}/api/reception`,
    apiUrl: `http://127.0.0.1:${address.port}/api`,
    originalFetch,
    close: async () => {
      globalThis.fetch = originalFetch;
      await new Promise<void>((resolve) => io.close(() => resolve()));
      database.close();
    },
  };
  contexts.push(context);
  return context;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.close();
  }
});

test('reception API validates, assigns, advances and completes walk-ins', async () => {
  const { baseUrl } = await createApiContext();

  const initialResponse = await fetch(`${baseUrl}/dashboard`);
  assert.equal(initialResponse.status, 200);
  const initial = (await initialResponse.json()) as {
    success: boolean;
    data: { overview: { waiting: number }; barbers: unknown[] };
  };
  assert.equal(initial.success, true);
  assert.equal(initial.data.overview.waiting, 0);
  assert.equal(initial.data.barbers.length, 0);

  const barberResponse = await fetch(`${baseUrl}/barbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Barber' }),
  });
  assert.equal(barberResponse.status, 201);
  const barberBody = (await barberResponse.json()) as {
    data: { id: string };
  };

  const invalidBarberResponse = await fetch(
    `${baseUrl}/barbers/invalid-id/dashboard`,
  );
  assert.equal(invalidBarberResponse.status, 400);
  const missingBarberResponse = await fetch(
    `${baseUrl}/barbers/11111111-1111-4111-8111-111111111111/dashboard`,
  );
  assert.equal(missingBarberResponse.status, 404);
  const emptyBarberDashboardResponse = await fetch(
    `${baseUrl}/barbers/${barberBody.data.id}/dashboard`,
  );
  assert.equal(emptyBarberDashboardResponse.status, 200);
  const emptyBarberDashboard = (await emptyBarberDashboardResponse.json()) as {
    data: { currentCustomer: unknown; nextCustomer: unknown };
  };
  assert.equal(emptyBarberDashboard.data.currentCustomer, null);
  assert.equal(emptyBarberDashboard.data.nextCustomer, null);

  const invalidWalkIn = await fetch(`${baseUrl}/walk-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Customer',
      phoneNumber: '123',
      serviceIds: ['haircut'],
      preferredBarberId: null,
    }),
  });
  assert.equal(invalidWalkIn.status, 400);

  const walkInResponse = await fetch(`${baseUrl}/walk-ins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Customer',
      phoneNumber: '9876543210',
      serviceIds: ['haircut'],
      preferredBarberId: null,
    }),
  });
  assert.equal(walkInResponse.status, 201);
  const walkInBody = (await walkInResponse.json()) as {
    data: { id: string; token: string };
    dashboard: { overview: { waiting: number } };
  };
  assert.equal(walkInBody.data.token, 'S-1');
  assert.equal(walkInBody.dashboard.overview.waiting, 1);
  const previewResponse = await fetch(
    `${baseUrl}/barbers/${barberBody.data.id}/dashboard`,
  );
  const previewText = await previewResponse.text();
  assert.match(previewText, /"token":"S-1"/);
  assert.doesNotMatch(previewText, /phoneNumber|9876543210/);

  const calledResponse = await fetch(
    `${baseUrl}/barbers/${barberBody.data.id}/call-next`,
    { method: 'POST' },
  );
  assert.equal(calledResponse.status, 200);
  const calledBody = (await calledResponse.json()) as {
    data: { id: string };
    dashboard: { barbers: Array<{ status: string }> };
  };
  assert.equal(calledBody.data.id, walkInBody.data.id);
  assert.equal(calledBody.dashboard.barbers[0]?.status, 'busy');

  const busyCallResponse = await fetch(
    `${baseUrl}/barbers/${barberBody.data.id}/call-next`,
    { method: 'POST' },
  );
  assert.equal(busyCallResponse.status, 409);

  const anotherBarberResponse = await fetch(`${baseUrl}/barbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Another Barber' }),
  });
  const anotherBarber = (await anotherBarberResponse.json()) as {
    data: { id: string };
  };
  const wrongStartResponse = await fetch(
    `${baseUrl}/bookings/${walkInBody.data.id}/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barberId: anotherBarber.data.id }),
    },
  );
  assert.equal(wrongStartResponse.status, 409);

  const startResponse = await fetch(
    `${baseUrl}/bookings/${walkInBody.data.id}/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barberId: barberBody.data.id }),
    },
  );
  assert.equal(startResponse.status, 200);
  const startBody = (await startResponse.json()) as {
    barberDashboard: {
      currentCustomer: { status: string; serviceStartedAt: string };
    };
  };
  assert.equal(startBody.barberDashboard.currentCustomer.status, 'in_service');
  assert.ok(startBody.barberDashboard.currentCustomer.serviceStartedAt);

  const completeResponse = await fetch(
    `${baseUrl}/bookings/${walkInBody.data.id}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barberId: barberBody.data.id }),
    },
  );
  assert.equal(completeResponse.status, 200);
  const completeBody = (await completeResponse.json()) as {
    dashboard: { overview: { servedToday: number; availableBarbers: number } };
  };
  assert.equal(completeBody.dashboard.overview.servedToday, 1);
  assert.equal(completeBody.dashboard.overview.availableBarbers, 2);
  const completedTwice = await fetch(
    `${baseUrl}/bookings/${walkInBody.data.id}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barberId: barberBody.data.id }),
    },
  );
  assert.equal(completedTwice.status, 409);

  const finalBarberDashboardResponse = await fetch(
    `${baseUrl}/barbers/${barberBody.data.id}/dashboard`,
  );
  const finalBarberDashboard = (await finalBarberDashboardResponse.json()) as {
    data: { currentCustomer: unknown };
  };
  assert.equal(finalBarberDashboard.data.currentCustomer, null);
});

test('queue mutations remove cancelled and no-show customers and reject closed walk-ins', async () => {
  const { baseUrl } = await createApiContext();

  const createBooking = async (customerName: string) => {
    const response = await fetch(`${baseUrl}/walk-ins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        phoneNumber: '9876543210',
        serviceIds: ['beard-trim'],
        preferredBarberId: null,
      }),
    });
    return {
      response,
      body: (await response.json()) as { data: { id: string } },
    };
  };

  const cancelled = await createBooking('Cancel');
  assert.equal(cancelled.response.status, 201);
  const cancelResponse = await fetch(
    `${baseUrl}/bookings/${cancelled.body.data.id}/cancel`,
    { method: 'POST' },
  );
  assert.equal(cancelResponse.status, 200);

  const noShow = await createBooking('No-show');
  assert.equal(noShow.response.status, 201);
  const noShowResponse = await fetch(
    `${baseUrl}/bookings/${noShow.body.data.id}/no-show`,
    { method: 'POST' },
  );
  assert.equal(noShowResponse.status, 200);

  const closeResponse = await fetch(`${baseUrl}/queue`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ open: false }),
  });
  assert.equal(closeResponse.status, 200);

  const rejectedWalkIn = await createBooking('Closed queue');
  assert.equal(rejectedWalkIn.response.status, 409);

  const dashboardResponse = await fetch(`${baseUrl}/dashboard`);
  const dashboard = (await dashboardResponse.json()) as {
    data: { queueOpen: boolean; bookings: unknown[]; overview: { waiting: number } };
  };
  assert.equal(dashboard.data.queueOpen, false);
  assert.equal(dashboard.data.bookings.length, 0);
  assert.equal(dashboard.data.overview.waiting, 0);
});

test('resource APIs validate customers, services, barbers, and queue lifecycle', async () => {
  const { apiUrl } = await createApiContext();
  const send = (
    path: string,
    method: string,
    body?: unknown,
  ) =>
    fetch(`${apiUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const invalidCustomer = await send('/customers', 'POST', {
    name: 'A customer',
    phoneNumber: '12345',
  });
  assert.equal(invalidCustomer.status, 400);

  const customerResponse = await send('/customers', 'POST', {
    name: 'Amara Patel',
    phoneNumber: '9876543210',
  });
  assert.equal(customerResponse.status, 201);
  const customer = (await customerResponse.json()) as {
    data: { id: string; name: string };
  };
  assert.equal(customer.data.name, 'Amara Patel');
  const customerLookup = await send(`/customers/${customer.data.id}`, 'GET');
  assert.equal(customerLookup.status, 200);

  const servicesResponse = await send('/services', 'GET');
  assert.equal(servicesResponse.status, 200);
  const services = (await servicesResponse.json()) as {
    data: Array<{ id: string; durationMinutes: number; priceRupees: number }>;
  };
  assert.ok(services.data.some((service) => service.id === 'haircut'));
  const haircutResponse = await send('/services/haircut', 'GET');
  assert.equal(haircutResponse.status, 200);

  const ownerServiceResponse = await send('/owner/services', 'POST', {
    name: 'Test Style Service',
    description: 'Temporary API test service',
    durationMinutes: 20,
    priceRupees: 120,
    isActive: true,
  });
  assert.equal(ownerServiceResponse.status, 201);
  const ownerService = (await ownerServiceResponse.json()) as {
    data: { id: string };
  };
  const deactivateService = await send(
    `/owner/services/${ownerService.data.id}`,
    'PATCH',
    { isActive: false },
  );
  assert.equal(deactivateService.status, 200);
  assert.equal(
    (await send(`/services/${ownerService.data.id}`, 'GET')).status,
    404,
  );
  const ownerServiceList = await send(
    '/owner/services?includeInactive=true',
    'GET',
  );
  assert.equal(ownerServiceList.status, 200);

  const barberResponse = await send('/barbers', 'POST', {
    name: 'Test Barber',
  });
  assert.equal(barberResponse.status, 201);
  const barber = (await barberResponse.json()) as {
    data: { id: string; status: string };
  };
  assert.equal(barber.data.status, 'available');
  assert.equal((await send('/barbers', 'GET')).status, 200);
  assert.equal((await send(`/barbers/${barber.data.id}`, 'GET')).status, 200);
  assert.equal(
    (
      await send(`/barbers/${barber.data.id}/status`, 'PATCH', {
        status: 'busy',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await send(`/barbers/${barber.data.id}/status`, 'PATCH', {
        status: 'on_break',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(`/barbers/${barber.data.id}/status`, 'PATCH', {
        status: 'available',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(`/barbers/${barber.data.id}/status`, 'PATCH', {
        status: 'unknown',
      })
    ).status,
    400,
  );

  const firstJoin = await send('/queue/join', 'POST', {
    customerName: 'Amara Patel',
    phoneNumber: '9876543210',
    serviceIds: ['haircut', 'beard-trim'],
    preferredBarberId: barber.data.id,
  });
  assert.equal(firstJoin.status, 201);
  const first = (await firstJoin.json()) as {
    data: { id: string; token: string; durationMinutes: number; totalPriceRupees: number };
    queueStatus: { position: number; estimatedWaitMinutes: number | null };
  };
  assert.equal(first.data.token, 'S-1');
  assert.equal(first.data.durationMinutes, 45);
  assert.equal(first.data.totalPriceRupees, 230);
  assert.equal(first.queueStatus.position, 1);
  assert.equal(first.queueStatus.estimatedWaitMinutes, 0);

  const duplicateJoin = await send('/queue/join', 'POST', {
    customerName: 'Amara Patel',
    phoneNumber: '9876543210',
    serviceIds: ['haircut'],
    preferredBarberId: 'any',
  });
  assert.equal(duplicateJoin.status, 409);

  const secondJoin = await send('/queue/walk-in', 'POST', {
    customerName: 'Rohan Shah',
    phoneNumber: '1234567890',
    serviceIds: ['haircut'],
    preferredBarberId: null,
  });
  assert.equal(secondJoin.status, 201);
  const second = (await secondJoin.json()) as {
    data: { id: string; token: string };
    queueStatus: { position: number; customersAhead: number; estimatedWaitMinutes: number };
  };
  assert.equal(second.data.token, 'S-2');
  assert.equal(second.queueStatus.position, 2);
  assert.equal(second.queueStatus.customersAhead, 1);
  assert.equal(second.queueStatus.estimatedWaitMinutes, 45);

  const dashboardResponse = await send('/reception/dashboard', 'GET');
  const dashboardBody = (await dashboardResponse.json()) as {
    data: {
      bookings: Array<{ token: string; estimatedWaitMinutes: number | null }>;
    };
  };
  assert.equal(dashboardResponse.status, 200);
  assert.deepEqual(
    dashboardBody.data.bookings.map((booking) => [
      booking.token,
      booking.estimatedWaitMinutes,
    ]),
    [
      ['S-1', 0],
      ['S-2', 45],
    ],
  );

  const searchResults = await send('/queue?status=waiting&search=S-2', 'GET');
  const searchData = (await searchResults.json()) as {
    data: { entries: Array<{ id: string }> };
  };
  assert.equal(searchResults.status, 200);
  assert.deepEqual(searchData.data.entries.map((entry) => entry.id), [
    second.data.id,
  ]);
  const invalidFilter = await send('/queue?status=completed', 'GET');
  assert.equal(invalidFilter.status, 400);

  const called = await send(`/queue/${first.data.id}/call`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(called.status, 200);
  const calledAgain = await send(`/queue/${first.data.id}/call`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(calledAgain.status, 409);
  const busyBarber = await send(`/barbers/${barber.data.id}/status`, 'PATCH', {
    status: 'busy',
  });
  assert.equal(busyBarber.status, 200);

  const started = await send(`/queue/${first.data.id}/start`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(started.status, 200);
  const startAgain = await send(`/queue/${first.data.id}/start`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(startAgain.status, 409);
  const completed = await send(`/queue/${first.data.id}/complete`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(completed.status, 200);
  const completeAgain = await send(`/queue/${first.data.id}/complete`, 'POST', {
    barberId: barber.data.id,
  });
  assert.equal(completeAgain.status, 409);
  const completedStatus = await send(`/queue/${first.data.id}/status`, 'GET');
  const completedData = (await completedStatus.json()) as {
    data: { status: string; position: number | null };
  };
  assert.equal(completedData.data.status, 'completed');
  assert.equal(completedData.data.position, null);

  const noShowJoin = await send('/queue/walk-in', 'POST', {
    customerName: 'No Show',
    phoneNumber: '1111111111',
    serviceIds: ['beard-trim'],
    preferredBarberId: null,
  });
  const noShowEntry = (await noShowJoin.json()) as { data: { id: string } };
  assert.equal(
    (await send(`/queue/${noShowEntry.data.id}/no-show`, 'PATCH')).status,
    200,
  );
  const cancelJoin = await send('/queue/walk-in', 'POST', {
    customerName: 'Cancel',
    phoneNumber: '2222222222',
    serviceIds: ['beard-trim'],
    preferredBarberId: null,
  });
  const cancelEntry = (await cancelJoin.json()) as { data: { id: string } };
  assert.equal(
    (await send(`/queue/${cancelEntry.data.id}/cancel`, 'POST')).status,
    200,
  );

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const statsResponse = await send(
    `/owner/statistics?day=${today}`,
    'GET',
  );
  const stats = (await statsResponse.json()) as {
    data: {
      completed: number;
      completedServiceCount: number;
      totalSalesRupees: number;
    };
  };
  assert.equal(statsResponse.status, 200);
  assert.equal(stats.data.completed, 1);
  assert.equal(stats.data.completedServiceCount, 2);
  assert.equal(stats.data.totalSalesRupees, 230);

  const closeQueue = await send('/owner/queue', 'PATCH', { open: false });
  assert.equal(closeQueue.status, 200);
  const closedWalkIn = await send('/queue/walk-in', 'POST', {
    customerName: 'Queue Closed',
    phoneNumber: '3333333333',
    serviceIds: ['haircut'],
    preferredBarberId: null,
  });
  assert.equal(closedWalkIn.status, 409);
});

test('owner settings and barber profile APIs persist validated salon operations data', async () => {
  const { apiUrl } = await createApiContext();
  const send = (path: string, method: string, body?: unknown) =>
    fetch(`${apiUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const initialSettingsResponse = await send('/owner/settings', 'GET');
  assert.equal(initialSettingsResponse.status, 200);
  const initialSettings = (await initialSettingsResponse.json()) as {
    data: { queueOpen: boolean; maxQueueCapacity: number | null };
  };
  assert.equal(initialSettings.data.queueOpen, true);
  assert.equal(initialSettings.data.maxQueueCapacity, null);

  const settings = {
    salonName: 'Velvet Studio',
    address: '12 Main Street',
    contactNumber: '+91 98765 43210',
    openingTime: '09:30',
    closingTime: '18:00',
    workingDays: [1, 2, 3, 4, 5, 6],
    queueOpen: false,
    maxQueueCapacity: 12,
  };
  assert.equal((await send('/owner/settings', 'PATCH', settings)).status, 200);
  const persistedSettings = (await (
    await send('/owner/settings', 'GET')
  ).json()) as { data: typeof settings };
  assert.deepEqual(persistedSettings.data, settings);

  const invalidSettings = await send('/owner/settings', 'PATCH', {
    ...settings,
    contactNumber: 'not a phone',
  });
  assert.equal(invalidSettings.status, 400);

  const barberResponse = await send('/owner/barbers', 'POST', {
    name: 'Owner Managed Barber',
  });
  assert.equal(barberResponse.status, 201);
  const barber = (await barberResponse.json()) as {
    data: { id: string; isActive: boolean };
  };
  assert.equal(barber.data.isActive, true);

  const updatedBarberResponse = await send(
    `/owner/barbers/${barber.data.id}`,
    'PATCH',
    {
      name: 'Updated Barber',
      photoUrl: 'https://example.test/barber.jpg',
      isActive: false,
    },
  );
  assert.equal(updatedBarberResponse.status, 200);
  const updatedBarber = (await updatedBarberResponse.json()) as {
    data: { name: string; isActive: boolean };
  };
  assert.equal(updatedBarber.data.name, 'Updated Barber');
  assert.equal(updatedBarber.data.isActive, false);

  const ownerBarbersResponse = await send('/owner/barbers', 'GET');
  const ownerBarbers = (await ownerBarbersResponse.json()) as {
    data: Array<{ id: string; isActive: boolean }>;
  };
  assert.ok(
    ownerBarbers.data.some(
      (entry) => entry.id === barber.data.id && !entry.isActive,
    ),
  );
  const publicBarbers = (await (await send('/barbers', 'GET')).json()) as {
    data: Array<{ id: string }>;
  };
  assert.ok(!publicBarbers.data.some((entry) => entry.id === barber.data.id));
});
