import type { DatabaseSync } from 'node:sqlite';
import type { RequestHandler } from 'express';
import type { Server as SocketServer } from 'socket.io';
import {
  authenticateAccessToken,
  createAccessToken,
  incrementTokenVersion,
  login,
  publicAuthUser,
  registerCustomer,
} from '../services/auth.service.js';
import { ReceptionServiceError } from '../services/reception.service.js';
import { authenticateIfPresent } from '../middleware/authentication.js';

const accessCookieName = 'salon_queue_access';
const accessCookieOptions = {
  httpOnly: true,
  maxAge: 30 * 60 * 1000,
  path: '/',
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

function writeAccessCookie(response: Parameters<RequestHandler>[1], token: string): void {
  response.cookie(accessCookieName, token, accessCookieOptions);
}

export function createAuthController(database: DatabaseSync, io: SocketServer) {
  const currentUser = authenticateIfPresent(database);

  const loginHandler: RequestHandler = async (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const user = await login(database, request.body);
      if (!user) {
        next(new ReceptionServiceError('Invalid email/username or password.', 401));
        return;
      }
      const token = await createAccessToken(user);
      writeAccessCookie(response, token);
      response.json({ success: true, data: { user: publicAuthUser(user) } });
    } catch (error) {
      next(error);
    }
  };

  const registerHandler: RequestHandler = async (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const user = await registerCustomer(database, request.body);
      const token = await createAccessToken(user);
      writeAccessCookie(response, token);
      response.status(201).json({
        success: true,
        data: { user: publicAuthUser(user) },
      });
    } catch (error) {
      next(error);
    }
  };

  const meHandler: RequestHandler = (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!request.authUser) {
      response.status(401).json({
        success: false,
        message: 'Authentication is required.',
      });
      return;
    }
    response.json({
      success: true,
      data: { user: publicAuthUser(request.authUser) },
    });
  };

  const requireUserForMe: RequestHandler = (request, _response, next) => {
    if (!request.authUser) {
      next(new ReceptionServiceError('Authentication is required.', 401));
      return;
    }
    next();
  };

  const logoutHandler: RequestHandler = async (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (token) {
        const user = await authenticateAccessToken(database, token);
        if (user) {
          incrementTokenVersion(database, user.id);
          io.in(`user:${user.id}`).disconnectSockets(true);
        }
      } else if (request.authUser) {
        incrementTokenVersion(database, request.authUser.id);
        io.in(`user:${request.authUser.id}`).disconnectSockets(true);
      }
      response.clearCookie(accessCookieName, {
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
      response.json({ success: true, data: { loggedOut: true } });
    } catch (error) {
      next(error);
    }
  };

  return {
    login: loginHandler,
    logout: [currentUser, logoutHandler] as const,
    me: [currentUser, requireUserForMe, meHandler] as const,
    register: registerHandler,
  };
}
