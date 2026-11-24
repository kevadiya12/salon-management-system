import { Router } from 'express';
import type { Database } from '../database/client.js';
import type { Server as SocketServer } from 'socket.io';
import { createReceptionController } from '../controllers/reception.controller.js';
import {
  authenticate,
  authorizeBarberIdentity,
  authorizeRoles,
  singleParam,
} from '../middleware/authentication.js';

export function createReceptionRouter(
  database: Database,
  io: SocketServer,
): Router {
  const router = Router();
  const controller = createReceptionController(database, io);
  const requireAuth = authenticate(database);
  const receptionAccess = [
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST'),
  ];

  router.get('/dashboard', ...receptionAccess, controller.getDashboard);
  router.get(
    '/barbers/:barberId/dashboard',
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST', 'BARBER'),
    authorizeBarberIdentity((request) => singleParam(request.params['barberId'])),
    controller.getBarberView,
  );
  router.post('/walk-ins', ...receptionAccess, controller.addWalkIn);
  router.post('/barbers', ...receptionAccess, controller.addBarber);
  router.patch(
    '/barbers/:barberId/status',
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST', 'BARBER'),
    authorizeBarberIdentity((request) => singleParam(request.params['barberId'])),
    controller.changeBarberAvailability,
  );
  router.post(
    '/barbers/:barberId/call-next',
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST', 'BARBER'),
    authorizeBarberIdentity((request) => singleParam(request.params['barberId'])),
    controller.callNextCustomer,
  );
  router.patch('/queue', ...receptionAccess, controller.changeQueueState);
  router.post(
    '/bookings/:bookingId/start',
    requireAuth,
    authorizeRoles('OWNER', 'BARBER'),
    authorizeBarberIdentity((request) =>
      typeof request.body?.barberId === 'string'
        ? request.body.barberId
        : undefined,
    ),
    controller.beginService,
  );
  router.post(
    '/bookings/:bookingId/complete',
    requireAuth,
    authorizeRoles('OWNER', 'BARBER'),
    authorizeBarberIdentity((request) =>
      typeof request.body?.barberId === 'string'
        ? request.body.barberId
        : undefined,
    ),
    controller.finishService,
  );
  router.post('/bookings/:bookingId/cancel', ...receptionAccess, controller.cancelBooking);
  router.post('/bookings/:bookingId/no-show', ...receptionAccess, controller.markNoShow);

  return router;
}
