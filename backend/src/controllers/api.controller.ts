import type { RequestHandler } from 'express';
import type { Database } from '../database/client.js';
import type { Server as SocketServer } from 'socket.io';
import { emitSalonEvent } from '../socket/events.js';
import {
  ReceptionServiceError,
  callQueueEntry,
  cancelWaitingBooking,
  completeService,
  createBarber,
  createCustomer,
  createQueueEntry,
  createSalonService,
  getBarberRecord,
  getCustomer,
  getOwnerDailyStatistics,
  getOwnerSettings,
  getQueueEntryStatus,
  getReceptionDashboard,
  getSalonService,
  listBarberRecords,
  listSalonServices,
  markWaitingBookingNoShow,
  setQueueOpen,
  startService,
  updateBarberStatus,
  updateBarberProfile,
  updateOwnerSettings,
  updateSalonService,
} from '../services/reception.service.js';

function routeId(value: string | string[] | undefined, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ReceptionServiceError(`${label} is required.`, 400);
  }
  return value.trim();
}

function requiredBarberId(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ReceptionServiceError('A valid JSON object is required.', 400);
  }
  const barberId = (body as Record<string, unknown>)['barberId'];
  if (typeof barberId !== 'string' || !barberId.trim()) {
    throw new ReceptionServiceError('Barber ID is required.', 400);
  }
  return barberId.trim();
}

function queryString(value: unknown, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new ReceptionServiceError(`${label} must be a string.`, 400);
  }
  return value.trim();
}

function publishBookingEvent(
  database: Database,
  io: SocketServer,
  event:
    | 'queue:joined'
    | 'queue:called'
    | 'queue:cancelled'
    | 'queue:no-show'
    | 'service:started'
    | 'service:completed',
  bookingId: string,
  barberId?: string,
): Promise<unknown> {
  return emitSalonEvent(database, io, event, { bookingId, barberId });
}

export function createApiController(
  database: Database,
  io: SocketServer,
) {
  const listServices: RequestHandler = async (_request, response) => {
    response.status(200).json({ success: true, data: await listSalonServices(database) });
  };
  const getService: RequestHandler = async (request, response) => {
    response.status(200).json({
      success: true,
      data: await getSalonService(
        database,
        routeId(request.params['id'], 'Service ID'),
      ),
    });
  };
  const createService: RequestHandler = async (request, response) => {
    const data = await createSalonService(database, request.body);
    await emitSalonEvent(database, io, 'queue:updated');
    response.status(201).json({ success: true, data });
  };
  const updateService: RequestHandler = async (request, response) => {
    const data = await updateSalonService(
      database,
      routeId(request.params['id'], 'Service ID'),
      request.body,
    );
    await emitSalonEvent(database, io, 'queue:updated');
    response.status(200).json({ success: true, data });
  };

  const addCustomer: RequestHandler = async (request, response) => {
    const data = await createCustomer(database, request.body);
    response.status(201).json({ success: true, data });
  };
  const getCustomerById: RequestHandler = async (request, response) => {
    response.status(200).json({
      success: true,
      data: await getCustomer(database, routeId(request.params['id'], 'Customer ID')),
    });
  };

  const listBarbers: RequestHandler = async (_request, response) => {
    response.status(200).json({
      success: true,
      data: await listBarberRecords(database),
    });
  };
  const getBarber: RequestHandler = async (request, response) => {
    response.status(200).json({
      success: true,
      data: await getBarberRecord(
        database,
        routeId(request.params['id'], 'Barber ID'),
      ),
    });
  };
  const addBarber: RequestHandler = async (request, response) => {
    const data = await createBarber(database, request.body);
    await emitSalonEvent(database, io, 'barber:updated', { barberId: data.id });
    response.status(201).json({ success: true, data });
  };
  const changeBarberStatus: RequestHandler = async (request, response) => {
    const barberId = routeId(request.params['id'], 'Barber ID');
    const data = await updateBarberStatus(
      database,
      barberId,
      request.body?.status,
    );
    await emitSalonEvent(database, io, 'barber:updated', { barberId });
    response.status(200).json({ success: true, data });
  };

  const listQueue: RequestHandler = async (request, response) => {
    const status = queryString(request.query['status'], 'Status');
    const allowedStatuses = new Set(['waiting', 'called', 'in_service']);
    if (status && !allowedStatuses.has(status)) {
      throw new ReceptionServiceError('Status filter is invalid.', 400);
    }
    const barberId = queryString(request.query['barberId'], 'Barber ID');
    if (barberId) await getBarberRecord(database, barberId);
    const dashboard = await getReceptionDashboard(database, new Date(), {
      search: queryString(request.query['search'], 'Search'),
      status,
      barberId,
    });
    response.status(200).json({
      success: true,
      data: {
        queueOpen: dashboard.queueOpen,
        overview: dashboard.overview,
        entries: dashboard.bookings,
      },
    });
  };
  const getPublicQueue: RequestHandler = async (_request, response) => {
    const dashboard = await getReceptionDashboard(database);
    response.status(200).json({
      success: true,
      data: {
        queueOpen: dashboard.queueOpen,
        overview: dashboard.overview,
      },
    });
  };
  const getDisplayQueue: RequestHandler = async (_request, response) => {
    const dashboard = await getReceptionDashboard(database);
    const publicEntry = (booking: (typeof dashboard.bookings)[number]) => ({
      id: booking.id,
      token: booking.token,
      status: booking.status,
      assignedBarberName: booking.assignedBarberName,
      serviceNames: booking.serviceNames,
      estimatedWaitMinutes: booking.estimatedWaitMinutes,
    });
    const active = dashboard.bookings
      .filter(
        (booking) => booking.status === 'called' || booking.status === 'in_service',
      )
      .map(publicEntry);
    const serving =
      dashboard.bookings.find((booking) => booking.status === 'called') ??
      dashboard.bookings.find((booking) => booking.status === 'in_service');
    const waiting = dashboard.bookings
      .filter((booking) => booking.status === 'waiting')
      .map(publicEntry);
    response.status(200).json({
      success: true,
      data: {
        queueOpen: dashboard.queueOpen,
        nowServing: serving ? publicEntry(serving) : null,
        active,
        upNext: waiting.slice(0, 3),
        waiting,
      },
    });
  };
  const joinQueue: RequestHandler = async (request, response) => {
    const user = request.authUser;
    if (!user?.customerId) {
      throw new ReceptionServiceError('A customer account is required to join the queue.', 403);
    }
    const body =
      typeof request.body === 'object' &&
      request.body !== null &&
      !Array.isArray(request.body)
        ? { ...request.body, customerId: user.customerId }
        : request.body;
    const data = await createQueueEntry(database, body, 'customer');
    await publishBookingEvent(database, io, 'queue:joined', data.id);
    response.status(201).json({
      success: true,
      data: {
        ...data,
        status: 'waiting',
      },
      queueStatus: await getQueueEntryStatus(database, data.id),
    });
  };
  const createWalkIn: RequestHandler = async (request, response) => {
    const data = await createQueueEntry(database, request.body, 'walk_in');
    await publishBookingEvent(database, io, 'queue:joined', data.id);
    response.status(201).json({
      success: true,
      data: { ...data, status: 'waiting' },
      queueStatus: await getQueueEntryStatus(database, data.id),
    });
  };
  const getQueueEntry: RequestHandler = async (request, response) => {
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(
        database,
        routeId(request.params['id'], 'Queue entry ID'),
      ),
    });
  };
  const cancelQueueEntry: RequestHandler = async (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    await cancelWaitingBooking(database, bookingId);
    await publishBookingEvent(database, io, 'queue:cancelled', bookingId);
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(database, bookingId),
    });
  };
  const markNoShow: RequestHandler = async (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    await markWaitingBookingNoShow(database, bookingId);
    await publishBookingEvent(database, io, 'queue:no-show', bookingId);
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(database, bookingId),
    });
  };
  const callQueueEntryHandler: RequestHandler = async (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    const data = await callQueueEntry(database, bookingId, barberId);
    await publishBookingEvent(database, io, 'queue:called', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(database, data.id),
    });
  };
  const startQueueEntry: RequestHandler = async (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    await startService(database, bookingId, new Date(), barberId);
    await publishBookingEvent(database, io, 'service:started', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(database, bookingId),
    });
  };
  const completeQueueEntry: RequestHandler = async (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    await completeService(database, bookingId, new Date(), barberId);
    await publishBookingEvent(database, io, 'service:completed', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: await getQueueEntryStatus(database, bookingId),
    });
  };

  const getOwnerServices: RequestHandler = async (request, response) => {
    const includeInactiveValue = queryString(
      request.query['includeInactive'],
      'includeInactive',
    );
    if (includeInactiveValue && !['true', 'false'].includes(includeInactiveValue)) {
      throw new ReceptionServiceError('includeInactive must be true or false.', 400);
    }
    response.status(200).json({
      success: true,
      data: await listSalonServices(database, includeInactiveValue === 'true'),
    });
  };
  const getOwnerBarbers: RequestHandler = async (_request, response) => {
    response.status(200).json({
      success: true,
      data: await listBarberRecords(database, true),
    });
  };
  const updateOwnerBarber: RequestHandler = async (request, response) => {
    const barberId = routeId(request.params['id'], 'Barber ID');
    const data = await updateBarberProfile(database, barberId, request.body);
    await emitSalonEvent(database, io, 'barber:updated', { barberId });
    response.status(200).json({ success: true, data });
  };
  const getOwnerSettingsHandler: RequestHandler = async (_request, response) => {
    response.status(200).json({
      success: true,
      data: await getOwnerSettings(database),
    });
  };
  const updateOwnerSettingsHandler: RequestHandler = async (request, response) => {
    const previousSettings = await getOwnerSettings(database);
    const data = await updateOwnerSettings(database, request.body);
    if (previousSettings.queueOpen !== data.queueOpen) {
      await emitSalonEvent(database, io, 'salon:queue-status', {
        queueOpen: data.queueOpen,
      });
    }
    response.status(200).json({ success: true, data });
  };
  const changeOwnerQueueState: RequestHandler = async (request, response) => {
    await setQueueOpen(database, request.body?.open);
    const dashboard = await getReceptionDashboard(database);
    await emitSalonEvent(database, io, 'salon:queue-status', {
      queueOpen: dashboard.queueOpen,
    });
    response.status(200).json({
      success: true,
      data: { queueOpen: dashboard.queueOpen },
    });
  };
  const ownerStatistics: RequestHandler = async (request, response) => {
    response.status(200).json({
      success: true,
      data: await getOwnerDailyStatistics(
        database,
        queryString(request.query['day'], 'Day') || undefined,
      ),
    });
  };

  return {
    listServices,
    getService,
    createService,
    updateService,
    addCustomer,
    getCustomerById,
    listBarbers,
    getBarber,
    addBarber,
    changeBarberStatus,
    listQueue,
    getPublicQueue,
    getDisplayQueue,
    joinQueue,
    createWalkIn,
    getQueueEntry,
    cancelQueueEntry,
    markNoShow,
    callQueueEntry: callQueueEntryHandler,
    startQueueEntry,
    completeQueueEntry,
    getOwnerServices,
    getOwnerBarbers,
    updateOwnerBarber,
    getOwnerSettings: getOwnerSettingsHandler,
    updateOwnerSettings: updateOwnerSettingsHandler,
    changeOwnerQueueState,
    ownerStatistics,
  };
}
