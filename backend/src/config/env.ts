import 'dotenv/config';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.PORT ?? 4000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const configuredDatabasePath = process.env.DB_PATH ?? 'data/salon.sqlite';
const businessTimeZone = process.env.BUSINESS_TIME_ZONE ?? 'Asia/Kolkata';
const frontendOrigins = (process.env.FRONTEND_ORIGINS ??
  process.env.FRONTEND_ORIGIN ??
  'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!configuredDatabasePath.trim()) {
  throw new Error('DB_PATH must be a non-empty path.');
}
if (frontendOrigins.length === 0) {
  throw new Error('FRONTEND_ORIGINS must contain at least one valid origin.');
}

for (const origin of frontendOrigins) {
  try {
    const parsedOrigin = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('FRONTEND_ORIGINS must be a comma-separated list of HTTP(S) origins.');
  }
}

try {
  new Intl.DateTimeFormat('en-IN', { timeZone: businessTimeZone }).format();
} catch {
  throw new Error('BUSINESS_TIME_ZONE must be a supported IANA time zone.');
}

export const config = {
  port,
  frontendOrigins,
  businessTimeZone,
  databasePath: isAbsolute(configuredDatabasePath)
    ? configuredDatabasePath
    : resolve(backendRoot, configuredDatabasePath),
};
