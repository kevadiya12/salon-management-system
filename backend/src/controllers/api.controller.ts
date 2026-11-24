import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
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
  database: DatabaseSync,
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
): void {
  emitSalonEvent(database, io, event, { bookingId, barberId });
}

export function createApiController(
  database: DatabaseSync,
  io: SocketServer,
) {
  const listServices: RequestHandler = (_request, response) => {
    response.status(200).json({ success: true, data: listSalonServices(database) });
  };
  const getService: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getSalonService(
        database,
        routeId(request.params['id'], 'Service ID'),
      ),
    });
  };
  const createService: RequestHandler = (request, response) => {
    const data = createSalonService(database, request.body);
    emitSalonEvent(database, io, 'queue:updated');
    response.status(201).json({ success: true, data });
  };
  const updateService: RequestHandler = (request, response) => {
    const data = updateSalonService(
      database,
      routeId(request.params['id'], 'Service ID'),
      request.body,
    );
    emitSalonEvent(database, io, 'queue:updated');
    response.status(200).json({ success: true, data });
  };

  const addCustomer: RequestHandler = (request, response) => {
    const data = createCustomer(database, request.body);
    response.status(201).json({ success: true, data });
  };
  const getCustomerById: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getCustomer(database, routeId(request.params['id'], 'Customer ID')),
    });
  };

  const listBarbers: RequestHandler = (_request, response) => {
    response.status(200).json({
      success: true,
      data: listBarberRecords(database),
    });
  };
  const getBarber: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getBarberRecord(
        database,
        routeId(request.params['id'], 'Barber ID'),
      ),
    });
  };
  const addBarber: RequestHandler = (request, response) => {
    const data = createBarber(database, request.body);
    emitSalonEvent(database, io, 'barber:updated', { barberId: data.id });
    response.status(201).json({ success: true, data });
  };
  const changeBarberStatus: RequestHandler = (request, response) => {
    const barberId = routeId(request.params['id'], 'Barber ID');
    const data = updateBarberStatus(
      database,
      barberId,
      request.body?.status,
    );
    emitSalonEvent(database, io, 'barber:updated', { barberId });
    response.status(200).json({ success: true, data });
  };

  const listQueue: RequestHandler = (request, response) => {
    const status = queryString(request.query['status'], 'Status');
    const allowedStatuses = new Set(['waiting', 'called', 'in_service']);
    if (status && !allowedStatuses.has(status)) {
      throw new ReceptionServiceError('Status filter is invalid.', 400);
    }
    const barberId = queryString(request.query['barberId'], 'Barber ID');
    if (barberId) getBarberRecord(database, barberId);
    const dashboard = getReceptionDashboard(database, new Date(), {
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
  const getPublicQueue: RequestHandler = (_request, response) => {
    const dashboard = getReceptionDashboard(database);
    response.status(200).json({
      success: true,
      data: {
        queueOpen: dashboard.queueOpen,
        overview: dashboard.overview,
      },
    });
  };
  const getDisplayQueue: RequestHandler = (_request, response) => {
    const dashboard = getReceptionDashboard(database);
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
  const joinQueue: RequestHandler = (request, response) => {
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
    const data = createQueueEntry(database, body, 'customer');
    publishBookingEvent(database, io, 'queue:joined', data.id);
    response.status(201).json({
      success: true,
      data: {
        ...data,
        status: 'waiting',
      },
      queueStatus: getQueueEntryStatus(database, data.id),
    });
  };
  const createWalkIn: RequestHandler = (request, response) => {
    const data = createQueueEntry(database, request.body, 'walk_in');
    publishBookingEvent(database, io, 'queue:joined', data.id);
    response.status(201).json({
      success: true,
      data: { ...data, status: 'waiting' },
      queueStatus: getQueueEntryStatus(database, data.id),
    });
  };
  const getQueueEntry: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(
        database,
        routeId(request.params['id'], 'Queue entry ID'),
      ),
    });
  };
  const cancelQueueEntry: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    cancelWaitingBooking(database, bookingId);
    publishBookingEvent(database, io, 'queue:cancelled', bookingId);
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(database, bookingId),
    });
  };
  const markNoShow: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    markWaitingBookingNoShow(database, bookingId);
    publishBookingEvent(database, io, 'queue:no-show', bookingId);
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(database, bookingId),
    });
  };
  const callQueueEntryHandler: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    const data = callQueueEntry(database, bookingId, barberId);
    publishBookingEvent(database, io, 'queue:called', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(database, data.id),
    });
  };
  const startQueueEntry: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    startService(database, bookingId, new Date(), barberId);
    publishBookingEvent(database, io, 'service:started', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(database, bookingId),
    });
  };
  const completeQueueEntry: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['id'], 'Queue entry ID');
    const barberId = requiredBarberId(request.body);
    completeService(database, bookingId, new Date(), barberId);
    publishBookingEvent(database, io, 'service:completed', bookingId, barberId);
    response.status(200).json({
      success: true,
      data: getQueueEntryStatus(database, bookingId),
    });
  };

  const getOwnerServices: RequestHandler = (request, response) => {
    const includeInactiveValue = queryString(
      request.query['includeInactive'],
      'includeInactive',
    );
    if (includeInactiveValue && !['true', 'false'].includes(includeInactiveValue)) {
      throw new ReceptionServiceError('includeInactive must be true or false.', 400);
    }
    response.status(200).json({
      success: true,
      data: listSalonServices(database, includeInactiveValue === 'true'),
    });
  };
  const getOwnerBarbers: RequestHandler = (_request, response) => {
    response.status(200).json({
      success: true,
      data: listBarberRecords(database, true),
    });
  };
  const updateOwnerBarber: RequestHandler = (request, response) => {
    const barberId = routeId(request.params['id'], 'Barber ID');
    const data = updateBarberProfile(database, barberId, request.body);
    emitSalonEvent(database, io, 'barber:updated', { barberId });
    response.status(200).json({ success: true, data });
  };
  const getOwnerSettingsHandler: RequestHandler = (_request, response) => {
    response.status(200).json({
      success: true,
      data: getOwnerSettings(database),
    });
  };
  const updateOwnerSettingsHandler: RequestHandler = (request, response) => {
    const previousSettings = getOwnerSettings(database);
    const data = updateOwnerSettings(database, request.body);
    if (previousSettings.queueOpen !== data.queueOpen) {
      emitSalonEvent(database, io, 'salon:queue-status', {
        queueOpen: data.queueOpen,
      });
    }
    response.status(200).json({ success: true, data });
  };
  const changeOwnerQueueState: RequestHandler = (request, response) => {
    setQueueOpen(database, request.body?.open);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'salon:queue-status', {
      queueOpen: dashboard.queueOpen,
    });
    response.status(200).json({
      success: true,
      data: { queueOpen: dashboard.queueOpen },
    });
  };
  const ownerStatistics: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getOwnerDailyStatistics(
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
