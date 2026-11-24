import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { config } from './config/env.js';
import { createDatabase } from './database/connection.js';
import { initializeReceptionSchema } from './database/reception-schema.js';
import healthRouter from './routes/health.routes.js';
import { createApiRouter } from './routes/api.routes.js';
import { createReceptionRouter } from './routes/reception.routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { registerSocketHandlers } from './socket/index.js';
import { assertJwtSecretConfigured } from './services/auth.service.js';

assertJwtSecretConfigured();
const database = createDatabase();
initializeReceptionSchema(database);
const app = express();

app.disable('x-powered-by');
app.use((request, response, next) => {
  const origin = request.get('origin');
  if (origin && !config.frontendOrigins.includes(origin)) {
    response.status(403).json({
      success: false,
      message: 'This origin is not allowed to access the API.',
    });
    return;
  }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
});
app.use(requestLogger);
app.use(express.json({ limit: '32kb' }));

const httpServer = createServer(app);
const socketServer = new SocketServer(httpServer, {
  cors: {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('This origin is not allowed to access Socket.IO.'));
    },
  },
});

registerSocketHandlers(socketServer, database);
app.use('/api', healthRouter);
app.use('/api', createApiRouter(database, socketServer));
app.use('/api/reception', createReceptionRouter(database, socketServer));
app.use('/api', (_request, response) => {
  response.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});
app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.info(`Salon Queue API listening on http://localhost:${config.port}`);
});

const shutdown = (): void => {
  socketServer.close(() => {
    database.close();
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
