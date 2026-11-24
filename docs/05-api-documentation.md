# HTTP API

All endpoints are served under `/api`. JSON request bodies are limited to 32 KB. Successful responses use a `success: true` envelope; data-producing routes generally place their response under `data`. Errors use `{ "success": false, "message": "..." }`.

## Authentication

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Accepts `{ "identifier": "email-or-username", "password": "..." }`; sets the HttpOnly access cookie and returns a safe user profile. |
| POST | `/auth/register` | Public | Registers and signs in a `CUSTOMER` using `{ name, email, phoneNumber, password }`. Client-supplied roles are ignored. |
| POST | `/auth/logout` | Public | Clears the cookie and invalidates the current user's access-token version when authenticated. |
| GET | `/auth/me` | Authenticated | Returns the current safe user profile, including the customer's active queue ID when applicable. |

The 30-minute JWT is stored in the `salon_queue_access` HttpOnly, SameSite=Strict cookie. The browser does not receive the token in JSON or store it in local storage. Requests may also use an `Authorization: Bearer <token>` header. Passwords must be at least 12 characters and no more than 72 UTF-8 bytes.

Roles are `OWNER`, `RECEPTIONIST`, `BARBER`, and `CUSTOMER`. Owner settings/account routes require `OWNER`; reception operations require `OWNER` or `RECEPTIONIST`; barber operations require `OWNER` or the matching linked barber; customer queue access requires the matching linked customer. Invalid or expired credentials return 401, and authenticated users without the required role return 403.

## Health

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/health` | API health check. |

## Services and customers

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/services` | List active services. |
| GET | `/services/:id` | Get a service by ID. |
| POST | `/customers` | Create a customer (Owner or Receptionist). |
| GET | `/customers/:id` | Get a customer (Owner/Receptionist, or that customer's account). |

## Barbers

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/barbers` | List barber records. |
| POST | `/barbers` | Add a barber (Owner). |
| GET | `/barbers/:id` | Get a barber (Owner/Receptionist or that Barber). |
| PATCH | `/barbers/:id/status` | Change barber availability (Owner or that Barber). |

## Customer queue

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/queue/join` | Create a booking for the authenticated Customer's linked profile. The server ignores a supplied `customerId`. |
| POST | `/queue/walk-in` | Create a walk-in booking (Owner or Receptionist). |
| GET | `/queue` | Without filters, return public queue overview counts only. With `status`, `barberId`, or `search`, return filtered entries to Owner or Receptionist. |
| GET | `/queue/display` | Public, customer-safe display data: current token(s), barber, service names, waiting tokens, and queue state. No customer name or phone. |
| GET | `/queue/:id` | Get queue-entry status (Owner/Receptionist, assigned Barber, or owning Customer). |
| GET | `/queue/:id/status` | Alias for queue-entry status with the same ownership checks. |
| POST | `/queue/:id/cancel` | Cancel a waiting entry (Owner/Receptionist, or the owning Customer). |
| PATCH | `/queue/:id/no-show` | Mark a waiting entry as no-show (Owner or Receptionist). |
| POST | `/queue/:id/call` | Call the next eligible entry for `barberId` (Owner or Receptionist). |
| POST | `/queue/:id/start` | Start the assigned entry; body includes `barberId` (Owner or that Barber). |
| POST | `/queue/:id/complete` | Complete the assigned entry; body includes `barberId` (Owner or that Barber). |

Queue creation accepts `serviceIds` and optional `preferredBarberId` (or `barberId` compatibility field); the linked customer's name and phone number are loaded from the authenticated account. Queue status includes position, customers ahead, service details, and `estimatedWaitMinutes`.

## Reception

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/reception/dashboard` | Reception dashboard (Owner/Receptionist). Optional filters: `search`, `status`, and `barberId`. |
| GET | `/reception/barbers/:barberId/dashboard` | Barber-specific dashboard (Owner/Receptionist or the matching Barber). |
| POST | `/reception/walk-ins` | Add a walk-in customer (Owner/Receptionist). |
| POST | `/reception/barbers` | Add a barber (Owner/Receptionist). |
| PATCH | `/reception/barbers/:barberId/status` | Set availability (Owner/Receptionist or that Barber). |
| POST | `/reception/barbers/:barberId/call-next` | Call the next eligible waiting customer (Owner/Receptionist or that Barber). |
| PATCH | `/reception/queue` | Set queue intake state using `{ "open": boolean }` (Owner/Receptionist). |
| POST | `/reception/bookings/:bookingId/start` | Start service; body includes the assigned `barberId` (Owner or that Barber). |
| POST | `/reception/bookings/:bookingId/complete` | Complete service; body includes the assigned `barberId` (Owner or that Barber). |
| POST | `/reception/bookings/:bookingId/cancel` | Cancel a waiting booking (Owner/Receptionist). |
| POST | `/reception/bookings/:bookingId/no-show` | Mark a waiting booking as no-show (Owner/Receptionist). |

The reception dashboard response contains queue state, generation timestamp, overview counts, services, barbers, and active bookings. Each waiting booking includes `estimatedWaitMinutes` as a number or `null`. Only authenticated owners, receptionists, and assigned barbers can access operational booking details.

## Owner API routes

These routes require the `OWNER` role.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/owner/services` | List services; `includeInactive=true` includes inactive rows. |
| POST | `/owner/services` | Create a service. |
| PATCH | `/owner/services/:id` | Update a service. |
| GET | `/owner/barbers` | List barbers. |
| POST | `/owner/barbers` | Add a barber. |
| PATCH | `/owner/barbers/:id` | Update barber name, optional photo URL, and active state. A barber with an active customer cannot be deactivated. |
| PATCH | `/owner/barbers/:id/status` | Change barber status. |
| PATCH | `/owner/queue` | Change queue intake state. |
| GET | `/owner/statistics` | Daily statistics; optional `day` uses `YYYY-MM-DD`. |
| GET | `/owner/settings` | Read salon settings, weekly schedule, queue state, and optional maximum queue capacity. |
| PATCH | `/owner/settings` | Update salon identity/contact, opening and closing times, working days, queue state, and optional queue capacity. |
| GET | `/owner/users` | List receptionist and barber accounts without password hashes. |
| POST | `/owner/users` | Create a receptionist or barber account; barber accounts require an existing active `barberId`. |
| PATCH | `/owner/users/:id` | Update a staff member's name/email, reset password, or change active status. Role and barber linkage cannot be changed here. |

Owner service CRUD uses `GET /owner/services?includeInactive=true`, `POST /owner/services`, and `PATCH /owner/services/:id`. The maximum queue capacity is optional and limits waiting entries only; called and in-service bookings do not count. Queue capacity defaults to unlimited. Owner statistics include current waiting count, completed customer bookings, individual completed service lines, active barbers, and `averageWaitMinutes`, which is `null` until there are recorded call times during the requested business day.

Salon settings store business hours and working days but do not automatically toggle queue intake. Logo and theme are still configured through frontend build-time environment variables.

## Initial owner account

The first owner is created by the backend-only `npm run seed:owner` command. It reads `INITIAL_OWNER_NAME`, `INITIAL_OWNER_EMAIL`, and `INITIAL_OWNER_PASSWORD` from the process environment and refuses to create another owner if one already exists.
