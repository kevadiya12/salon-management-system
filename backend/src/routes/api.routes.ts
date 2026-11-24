import { Router } from 'express';
import type { Database } from '../database/client.js';
import type { Server as SocketServer } from 'socket.io';
import { createAuthController } from '../controllers/auth.controller.js';
import { createApiController } from '../controllers/api.controller.js';
import { createOwnerUsersController } from '../controllers/owner-users.controller.js';
import {
  authenticate,
  authorizeBarberIdentity,
  authorizeCustomerOrStaff,
  authorizeQueueEntry,
  authorizeRoles,
  singleParam,
} from '../middleware/authentication.js';

export function createApiRouter(
  database: Database,
  io: SocketServer,
): Router {
  const router = Router();
  const controller = createApiController(database, io);
  const auth = createAuthController(database, io);
  const ownerUsers = createOwnerUsersController(database, io);
  const requireAuth = authenticate(database);
  const ownerOnly = [requireAuth, authorizeRoles('OWNER')];
  const staffQueueAccess = [
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST'),
  ];

  router.get('/services', controller.listServices);
  router.get('/services/:id', controller.getService);

  router.post('/auth/login', auth.login);
  router.post('/auth/register', auth.register);
  router.post('/auth/logout', ...auth.logout);
  router.get('/auth/me', ...auth.me);

  router.post('/customers', ...staffQueueAccess, controller.addCustomer);
  router.get(
    '/customers/:id',
    requireAuth,
    authorizeCustomerOrStaff(database),
    controller.getCustomerById,
  );
  router.get('/barbers', controller.listBarbers);
  router.post('/barbers', ...ownerOnly, controller.addBarber);
  router.get(
    '/barbers/:id',
    requireAuth,
    authorizeBarberIdentity((request) => singleParam(request.params['id'])),
    controller.getBarber,
  );
  router.patch(
    '/barbers/:id/status',
    requireAuth,
    authorizeBarberIdentity((request) => singleParam(request.params['id'])),
    controller.changeBarberStatus,
  );

  router.post('/queue/join', requireAuth, authorizeRoles('CUSTOMER'), controller.joinQueue);
  router.post('/queue/walk-in', ...staffQueueAccess, controller.createWalkIn);
  router.get('/queue', (request, response, next) => {
    if (
      request.query['status'] !== undefined ||
      request.query['search'] !== undefined ||
      request.query['barberId'] !== undefined
    ) {
      requireAuth(request, response, (error) => {
        if (error) {
          next(error);
          return;
        }
        authorizeRoles('OWNER', 'RECEPTIONIST')(request, response, (roleError) => {
          if (roleError) next(roleError);
          else controller.listQueue(request, response, next);
        });
      });
      return;
    }
    controller.getPublicQueue(request, response, next);
  });
  router.get('/queue/display', controller.getDisplayQueue);
  router.get(
    '/queue/:id/status',
    requireAuth,
    authorizeQueueEntry(database),
    controller.getQueueEntry,
  );
  router.get(
    '/queue/:id',
    requireAuth,
    authorizeQueueEntry(database),
    controller.getQueueEntry,
  );
  router.post(
    '/queue/:id/cancel',
    requireAuth,
    authorizeRoles('OWNER', 'RECEPTIONIST', 'CUSTOMER'),
    authorizeQueueEntry(database),
    controller.cancelQueueEntry,
  );
  router.patch(
    '/queue/:id/no-show',
    ...staffQueueAccess,
    controller.markNoShow,
  );
  router.post('/queue/:id/call', ...staffQueueAccess, controller.callQueueEntry);
  router.post(
    '/queue/:id/start',
    requireAuth,
    authorizeRoles('OWNER', 'BARBER'),
    authorizeBarberIdentity((request) =>
      typeof request.body?.barberId === 'string'
        ? request.body.barberId
        : undefined,
    ),
    controller.startQueueEntry,
  );
  router.post(
    '/queue/:id/complete',
    requireAuth,
    authorizeRoles('OWNER', 'BARBER'),
    authorizeBarberIdentity((request) =>
      typeof request.body?.barberId === 'string'
        ? request.body.barberId
        : undefined,
    ),
    controller.completeQueueEntry,
  );

  router.get('/owner/services', ...ownerOnly, controller.getOwnerServices);
  router.post('/owner/services', ...ownerOnly, controller.createService);
  router.patch('/owner/services/:id', ...ownerOnly, controller.updateService);
  router.get('/owner/barbers', ...ownerOnly, controller.getOwnerBarbers);
  router.post('/owner/barbers', ...ownerOnly, controller.addBarber);
  router.patch('/owner/barbers/:id', ...ownerOnly, controller.updateOwnerBarber);
  router.patch('/owner/barbers/:id/status', ...ownerOnly, controller.changeBarberStatus);
  router.get('/owner/settings', ...ownerOnly, controller.getOwnerSettings);
  router.patch('/owner/settings', ...ownerOnly, controller.updateOwnerSettings);
  router.patch('/owner/queue', ...ownerOnly, controller.changeOwnerQueueState);
  router.get('/owner/statistics', ...ownerOnly, controller.ownerStatistics);
  router.get('/owner/users', ...ownerOnly, ownerUsers.list);
  router.post('/owner/users', ...ownerOnly, ownerUsers.create);
  router.patch('/owner/users/:id', ...ownerOnly, ownerUsers.update);

  return router;
}
