import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { Server as SocketServer } from 'socket.io';
import { emitSalonEvent } from '../socket/events.js';
import {
  ReceptionServiceError,
  callNext,
  cancelWaitingBooking,
  completeService,
  createBarber,
  createWalkIn,
  getBarberDashboard,
  getReceptionDashboard,
  markWaitingBookingNoShow,
  setBarberAvailability,
  setQueueOpen,
  startService,
} from '../services/reception.service.js';

function routeId(value: string | string[] | undefined, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ReceptionServiceError(`${label} is required.`, 400);
  }
  return value;
}

function requiredBodyBarberId(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ReceptionServiceError('Barber ID is required.', 400);
  }
  const barberId = (body as Record<string, unknown>)['barberId'];
  if (typeof barberId !== 'string' || !barberId.trim()) {
    throw new ReceptionServiceError('Barber ID is required.', 400);
  }
  return barberId;
}

function optionalQueryString(value: unknown, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new ReceptionServiceError(`${label} must be a string.`, 400);
  }
  return value.trim();
}

export function createReceptionController(
  database: DatabaseSync,
  io: SocketServer,
) {
  const getDashboard: RequestHandler = (request, response) => {
    const status = optionalQueryString(request.query['status'], 'Status');
    const allowedStatuses = new Set(['waiting', 'called', 'in_service']);
    if (status && !allowedStatuses.has(status)) {
      throw new ReceptionServiceError('Status filter is invalid.', 400);
    }
    response.status(200).json({
      success: true,
      data: getReceptionDashboard(database, new Date(), {
        search: optionalQueryString(request.query['search'], 'Search'),
        status,
        barberId: optionalQueryString(request.query['barberId'], 'Barber ID'),
      }),
    });
  };

  const getBarberView: RequestHandler = (request, response) => {
    response.status(200).json({
      success: true,
      data: getBarberDashboard(
        database,
        routeId(request.params['barberId'], 'Barber ID'),
      ),
    });
  };

  const addWalkIn: RequestHandler = (request, response) => {
    const booking = createWalkIn(database, request.body);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'queue:joined', { bookingId: booking.id });
    response.status(201).json({
      success: true,
      data: booking,
      dashboard,
    });
  };

  const addBarber: RequestHandler = (request, response) => {
    const barber = createBarber(database, request.body);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'barber:updated', { barberId: barber.id });
    response.status(201).json({
      success: true,
      data: barber,
      dashboard,
    });
  };

  const changeBarberAvailability: RequestHandler = (request, response) => {
    const barberId = routeId(request.params['barberId'], 'Barber ID');
    setBarberAvailability(database, barberId, request.body?.status);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'barber:updated', { barberId });
    response.status(200).json({
      success: true,
      dashboard,
      barberDashboard: getBarberDashboard(database, barberId),
    });
  };

  const changeQueueState: RequestHandler = (request, response) => {
    setQueueOpen(database, request.body?.open);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'salon:queue-status', {
      queueOpen: dashboard.queueOpen,
    });
    response.status(200).json({
      success: true,
      dashboard,
    });
  };

  const callNextCustomer: RequestHandler = (request, response) => {
    const barberId = routeId(request.params['barberId'], 'Barber ID');
    const booking = callNext(database, barberId);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'queue:called', {
      bookingId: booking.id,
      barberId,
    });
    response.status(200).json({
      success: true,
      data: booking,
      dashboard,
    });
  };

  const beginService: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['bookingId'], 'Booking ID');
    const barberId = requiredBodyBarberId(request.body);
    startService(database, bookingId, new Date(), barberId);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'service:started', { bookingId, barberId });
    response.status(200).json({
      success: true,
      dashboard,
      barberDashboard: getBarberDashboard(database, barberId),
    });
  };

  const finishService: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['bookingId'], 'Booking ID');
    const barberId = requiredBodyBarberId(request.body);
    completeService(database, bookingId, new Date(), barberId);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'service:completed', { bookingId, barberId });
    response.status(200).json({
      success: true,
      dashboard,
      barberDashboard: getBarberDashboard(database, barberId),
    });
  };

  const cancelBooking: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['bookingId'], 'Booking ID');
    cancelWaitingBooking(database, bookingId);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'queue:cancelled', { bookingId });
    response.status(200).json({
      success: true,
      dashboard,
    });
  };

  const markNoShow: RequestHandler = (request, response) => {
    const bookingId = routeId(request.params['bookingId'], 'Booking ID');
    markWaitingBookingNoShow(database, bookingId);
    const dashboard = getReceptionDashboard(database);
    emitSalonEvent(database, io, 'queue:no-show', { bookingId });
    response.status(200).json({
      success: true,
      dashboard,
    });
  };

  return {
    getDashboard,
    getBarberView,
    addWalkIn,
    addBarber,
    changeBarberAvailability,
    changeQueueState,
    callNextCustomer,
    beginService,
    finishService,
    cancelBooking,
    markNoShow,
  };
}
