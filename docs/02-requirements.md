# Implemented Requirements

This document records behavior present in the source code. It is not a proposed product specification.

## Customer queue

- Customers can register with their name, email, phone number, and password, then choose one or more active services and optionally select a preferred barber.
- Customer name, email, password, and 10-digit phone number are validated at registration. Queue enrollment uses the signed-in customer's linked record; a client-supplied customer ID is ignored.
- Queue entries are ordered by database arrival order and receive a daily sequential token.
- Duplicate active queue entries for the same phone number are rejected.
- A closed queue rejects new entries; existing bookings can still be served.
- A customer can retrieve status and estimated wait only for their own queue-entry ID and can cancel while still waiting.

## Reception operations

- Reception can view and filter active bookings, add barbers and walk-ins, change barber availability, and open or close queue intake.
- `Call Next` chooses the oldest waiting booking eligible for the selected available barber and marks that barber busy.
- Reception can start and complete service, cancel a waiting booking, and mark a waiting booking as no-show.
- Dashboard metrics include waiting count, in-service count, available barber count, and customers served during the configured business day.

## Owner settings

- `/admin` shows backend-derived current waiting customers, completed services today, active barbers, and an average wait when there are recorded call times for the business day.
- Salon name, address, contact number, opening and closing times, weekly working days, and queue intake status can be saved to the backend settings store.
- Owners can create, edit, and deactivate services using the persisted service catalogue.
- Owners can create and edit barber profiles, activate/deactivate barbers, and change availability.
- Owners can set an optional maximum number of waiting queue entries. The default is unlimited; called and in-service entries do not count toward the cap.
- Weekly hours are informational schedule settings; queue intake remains manually controlled by the existing Open/Closed setting.
- Owners can create and update receptionist and barber login accounts, reset their passwords, and deactivate/reactivate accounts. Barber accounts are linked to one barber profile.

## Authentication and authorization

- Login accepts an email address or staff username and password. Invalid credentials use one generic error response.
- Passwords are stored as bcrypt hashes; they are never returned by API responses.
- A 30-minute JWT access token is stored in an HttpOnly, SameSite=Strict cookie. The frontend does not persist access tokens in local storage.
- The backend validates active account status and token version on every authenticated HTTP request. Logout, password reset, and account deactivation invalidate existing tokens.
- Only the one initially seeded Owner account can have the `OWNER` role. Owner-created staff accounts are `RECEPTIONIST` or `BARBER`; customer registration always assigns `CUSTOMER`.
- Frontend route protection improves navigation UX; backend middleware is the security boundary.

## Barber view

- The barber dashboard returns that barber's current assignment and next eligible waiting booking.
- A barber can be marked available or on break and can start or complete their assigned service.
- Service timers use the persisted start timestamp.

## Waiting-area display

- `/display` renders queue-safe booking information and updates from Socket.IO queue events.
- It excludes customer phone numbers and exposes token, barber, service, and status information as appropriate.
- The browser may play the call notification only when its audio context is permitted by browser policy.
- API data is refreshed on connection and queue updates; disconnected state and API errors are visible.

## Estimated wait

For each waiting booking, the backend schedules waiting customers in FIFO order onto the earliest available eligible barber slot. A called booking occupies its barber for the selected service duration; an in-service booking uses its start time and service duration to estimate remaining availability. A booking with no eligible non-break barber has `estimatedWaitMinutes: null`. Called and in-service entries report zero; terminal bookings report null.

Service durations are summed from the selected services. Legacy rows with a zero stored duration use their associated service details. This estimate does not include operational delays or uncertainty in actual service times.

## Privacy and access constraints

The waiting-area display API omits customer names and phone numbers. Reception-oriented endpoints include customer names and are role-protected. Customers can access only their linked bookings, and barbers can access only their linked barber dashboard and assigned services.
