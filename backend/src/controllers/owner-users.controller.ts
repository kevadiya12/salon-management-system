import type { DatabaseSync } from 'node:sqlite';
import type { RequestHandler } from 'express';
import type { Server as SocketServer } from 'socket.io';
import {
  createStaffAccount,
  listStaffAccounts,
  updateStaffAccount,
} from '../services/auth.service.js';
import { ReceptionServiceError } from '../services/reception.service.js';

export function createOwnerUsersController(
  database: DatabaseSync,
  io: SocketServer,
) {
  const list: RequestHandler = (_request, response) => {
    response.json({ success: true, data: listStaffAccounts(database) });
  };

  const create: RequestHandler = async (request, response, next) => {
    try {
      const account = await createStaffAccount(database, request.body);
      response.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  };

  const update: RequestHandler = async (request, response, next) => {
    try {
      const userId = request.params['id'];
      if (!userId) throw new ReceptionServiceError('User ID is required.', 400);
      if (Array.isArray(userId)) {
        throw new ReceptionServiceError('User ID is invalid.', 400);
      }
      if (userId === request.authUser?.id && request.body?.isActive === false) {
        throw new ReceptionServiceError('You cannot deactivate your own account.', 409);
      }
      const account = await updateStaffAccount(database, userId, request.body);
      if (
        request.body?.password !== undefined ||
        request.body?.isActive !== undefined
      ) {
        io.in(`user:${userId}`).disconnectSockets(true);
      }
      response.json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  };

  return { list, create, update };
}
