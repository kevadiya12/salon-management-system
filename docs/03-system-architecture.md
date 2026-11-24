# System Architecture

## Runtime components

```text
Browser (React / Vite :5173)
  ├─ HTTP /api/* ────────────────┐
  └─ Socket.IO /socket.io ───────┤ Vite development proxy
                                  v
                            Express + Socket.IO (:4000)
                                  |
                            SQLite (node:sqlite)
```

The Vite proxy forwards both `/api` and `/socket.io` to `http://127.0.0.1:4000`; the Socket.IO proxy enables WebSocket forwarding. The frontend Socket.IO client uses the same origin by default, disables automatic connection until a view subscribes, and uses the `/socket.io` path. `VITE_SOCKET_URL` can override the default origin.

The backend creates one Node HTTP server around Express and attaches the Socket.IO server to that same HTTP server. HTTP and Socket.IO access are restricted to origins listed in `FRONTEND_ORIGINS` (or its legacy singular alias). The default development origins are localhost and 127.0.0.1 on port 5173.

## Backend layers

- `src/routes/` declares health, general API, and reception API routes.
- `src/controllers/` validates request parameters and delegates business operations; auth and owner user controllers provide login, customer registration, and staff-account management.
- `src/services/reception.service.ts` owns queue, barber, dashboard, and wait-estimation behavior.
- `src/services/auth.service.ts` validates account data, hashes passwords, issues/verifies JWTs, and manages account records.
- `src/middleware/authentication.ts` validates access tokens and applies role, customer-ownership, and barber-identity checks.
- `src/database/` opens SQLite and initializes/migrates the reception schema.
- `src/socket/` validates subscriptions and publishes queue-safe update payloads.
- `src/services/reception.service.ts` also reads and writes owner settings in `reception_settings`.
- `src/middleware/` handles authentication, authorization, request logging, JSON parsing errors, service errors, and unexpected errors.

## Authentication flow

The frontend submits credentials to `/api/auth/login` or customer details to `/api/auth/register`. The backend stores a signed 30-minute JWT in an HttpOnly, SameSite=Strict cookie. The token is not exposed to frontend JavaScript or local storage. Authenticated requests reload the active user and token version from SQLite. Logout, staff password reset, and staff deactivation invalidate sessions. The owner setup command creates the first owner from environment-provided credentials.

HTTP CORS allows credentials only from configured frontend origins. Socket.IO reads the same cookie at connection time. Public display subscriptions remain available; reception, booking, and barber rooms enforce the associated roles and identities. Logout and account security changes disconnect the user's active sockets.

## Persistence

SQLite uses write-ahead logging. Relative `DB_PATH` values resolve from the backend directory. Startup creates the schema, default service rows, and the default open queue setting; it does not create sample barbers or bookings.

## Frontend integration

The frontend keeps a shared Socket.IO client singleton. Each route attaches its own event handlers and removes them on unmount. API services use the `/api` prefix; live views subscribe to the room appropriate to their use case and refetch their relevant API data after queue updates.

The logo and theme values live in `frontend/src/config/salon.ts` and are read from Vite environment variables at build time. Salon name, address, contact number, business hours, working days, queue status, and optional queue capacity are persisted as key/value entries in `reception_settings`.

## Error behavior

Expected service errors return `{ "success": false, "message": "..." }` with the service's HTTP status. Invalid JSON returns 400, an oversized JSON body returns 413, and unexpected errors are logged and return a generic 500 response. Unknown `/api` routes return a JSON 404 response.
