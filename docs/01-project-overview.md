# Project Overview

The Salon Queue Management System is a web application for joining and operating a salon's walk-in queue. The current implementation includes customer, reception, barber, waiting-area, and owner settings views, with JWT authentication and role-based API access.

## Technology

- Frontend: React 19, TypeScript, Vite, React Router, Tailwind CSS, Socket.IO client.
- Backend: Node.js 22.13+, TypeScript, Express 5, Socket.IO 4.
- Persistence: Neon PostgreSQL through the `pg` connection pool.
- Authentication: JWT access tokens in HttpOnly cookies and bcryptjs password hashes.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Home page and links into queue flows. |
| `/login` | Staff sign-in and customer account registration/sign-in. |
| `/join` | Select services and barber preference, then join as the signed-in customer. |
| `/status` and `/status/:id` | Follow the signed-in customer's queue entry. |
| `/barber/:barberId` | Barber-specific active and next customer view. |
| `/reception` | Reception dashboard for barbers, queue state, walk-ins, and service lifecycle actions. |
| `/display` | Read-only waiting-area display with live queue state. |
| `/admin` | Owner dashboard for overview statistics, salon settings, services, barbers, queue capacity, and weekly hours. |

`/admin`, `/reception`, `/barber/:barberId`, `/join`, and `/status/:id` require the corresponding signed-in role. Unknown frontend paths redirect to `/`.

## Roles

- `OWNER`: salon settings, services, barber profiles, staff accounts, and all operational views.
- `RECEPTIONIST`: reception queue operations and customer lookup.
- `BARBER`: their linked barber dashboard, availability, and assigned service actions.
- `CUSTOMER`: their own queue entries and customer queue enrollment.

The backend enforces these roles independently of frontend route guards. The first owner is created with the documented `npm run seed:owner` command. Staff accounts are created by the owner; customers register through `/login`.

## Queue lifecycle

Bookings move through `waiting`, `called`, `in_service`, and terminal states `completed`, `cancelled`, or `no_show`. A barber must be available to call their oldest eligible waiting booking. A preferred-barber booking is eligible only for that barber; an unassigned preference can be served by any eligible barber. Cancellation and no-show apply only while waiting.

Queue tokens have the form `S-1`, `S-2`, and so on, and restart by business day. No business records are seeded. The default service catalogue is initialized from the backend's built-in service list.

## Current limitations

- Salon name, logo, address, contact number, and theme are frontend build-time settings, not database-backed or editable through an API.
- The estimated wait is a scheduling estimate, not a guarantee. It is unavailable when no eligible barber can serve a waiting booking.
- Business hours are stored as schedule information and do not automatically open or close queue intake.
- Salon branding logo and theme remain frontend build-time settings; editable name, address, contact, and hours are persisted in backend settings.
