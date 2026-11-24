import { createPool } from './client.js';
import { config } from '../config/env.js';

export function createDatabase() {
  return createPool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'salon-queue-management',
  });
}
