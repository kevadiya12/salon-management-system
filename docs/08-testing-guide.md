# Testing Guide

## Automated checks

Run from the relevant project directory:

```powershell
cd backend
npm run typecheck
npm test
npm run build
```

```powershell
cd frontend
npm run build
```

The frontend build runs `tsc -b` before Vite's production build. There is currently no frontend unit-test script. Backend tests use Node's test runner through `tsx` and cover authentication, role boundaries, customer/barber ownership, session invalidation, reception service behavior, API flows, schema migration, estimated waits, and Socket.IO event payloads.

## Manual integration checks

1. Start backend and frontend using [the setup guide](07-setup-and-running.md).
2. Verify unauthenticated visits to `/admin`, `/reception`, `/barber/:barberId`, `/join`, and `/status/:id` redirect to `/login`.
3. Sign in as Owner, Receptionist, Barber, and Customer. Confirm Owner reaches `/admin`, Receptionist reaches `/reception`, Barber reaches their linked `/barber/:barberId`, and Customer reaches their active queue or `/join`.
4. Confirm Receptionist is denied `/admin`, a Barber is denied another Barber's dashboard, and Customers are denied another Customer's queue ID. Repeat with direct API requests, not only page navigation.
5. Open browser developer tools and verify authenticated Socket.IO connections receive only permitted room updates. Leave the tab connected for at least 60 seconds and confirm no repeated upgrade errors.
6. Add a barber and a walk-in through Reception. Confirm the public display updates without a page reload, then call the customer and confirm the token highlight.
7. Verify an empty queue is presented without errors. Stop the backend and verify the display reports unavailable API data and reconnecting socket state; restart the backend and confirm recovery.
8. Confirm customer names and phone numbers do not appear in `/api/queue/display` or the display UI. Verify customers can see only their own queue status.
9. In `/admin`, add and edit a service, deactivate and reactivate it, add and edit a barber, manage staff accounts, and change availability. Update salon information and business hours, configure and clear a queue capacity, then refresh the page and verify each saved value persists.
10. Configure a capacity of one, join one waiting customer, and verify another queue join is rejected. Clear the capacity afterward.

Automated backend tests use an isolated PostgreSQL-compatible in-memory database. Manual queue mutations persist in the PostgreSQL database configured by `DATABASE_URL`; do not use production customer data for test queue entries.

## Current verification scope

Backend tests and frontend production typecheck/build are automated. Cross-route and sustained Socket.IO checks are browser/integration checks, not part of the automated test suite.
