#here
Salon Queue Management System
All-in-One Prompt Book — From Initial Planning to Live Deployment
All-in-One Prompt Book — From Initial Planning to Live Deployment

Prepared from the salon project brief, the original vibe-coding guide available in the project history, and the later implementation/debugging/deployment conversations.

Important accuracy note: the original starter guide and several later prompts were available. Where an exact historical message was not retrievable word-for-word, the prompt is clearly presented as a consolidated/reconstructed version based on the recorded requirement—not as a verbatim transcript.
Project snapshot
- Project: Salon Queue Management System.
- Original planned stack: React + Vite + TypeScript + Tailwind CSS frontend; Node.js + Express + TypeScript backend; SQLite initially; Socket.IO for real-time updates; JWT authentication and role-based access control.
- Deployment direction used later: separate frontend and backend deployments on Render, with hosted PostgreSQL (Neon) through DATABASE_URL. Do not use a local SQLite file path such as /var/data on an ephemeral/free deployment.
- Main routes: /, /join, /status/:id, /reception, /barber/:barberId, /display, /admin.
- Visual direction: premium salon interface; charcoal/dark surfaces, gold accent (#D4A017), cream text/surfaces, responsive/mobile-first layouts.
- Roles: Customer, Receptionist, Barber, Owner/Admin, and public waiting-area display.
Contents / recommended order
1. A. Product scope and requirements
2. B. Screen and workflow specification
3. C. Agent instructions and project setup
4. D. Frontend build prompts
5. E. Backend, database and real-time prompts
6. F. Authentication and role permissions
7. G. Testing, bug fixing and UI refinement
8. H. Deployment preparation
9. I. Render backend deployment and PostgreSQL migration
10. J. Render frontend deployment and connection
11. K. Final verification and handover
A. Product scope and requirements
Prompt 0 — Understand the project before coding
Read the project brief and all files in docs/. Explain the Salon Queue Management System in 8 clear bullets. Identify the user roles, all screens, the main customer journey, queue rules, technical stack, and anything ambiguous or contradictory. Do not write code, install packages, or modify files yet. Ask only essential questions and wait for approval.
Prompt 1 — Create the project brief (docs/01-brief.md)
Create docs/01-brief.md for a Salon Queue Management System.
Problem: customers currently wait without knowing their turn, and staff need a reliable first-come-first-served queue.
Users: customers, receptionist, barbers, and salon owner/admin.
Must-have features:
1. Customers join the live queue from their phone.
2. Customers select one or more services (maximum 3) and choose a specific barber or Any barber.
3. Customers see a token, queue position, estimated wait, and live status.
4. Reception can add walk-ins, call the next eligible customer, cancel a spot, and mark no-shows.
5. Barbers can view their current/next customers and mark Start and Done; they can set Available or On break.
6. A public TV display shows barber activity and the next tokens.
7. Owner/admin manages services, prices, durations, barber availability, queue open/closed state, and daily statistics.
Do not build online payments, future-date appointments, SMS/WhatsApp messaging, loyalty points, or multiple branches unless already explicitly required by the existing project.
Use a premium, mobile-first charcoal-and-gold design. Support English and Gujarati labels. Keep the brief concise and use it as the source of truth.
Prompt 2 — Create the screen specification (docs/02-screens.md)
Create docs/02-screens.md. For every screen document its route, user, purpose, layout from top to bottom, controls and exact button behaviour, responsive behaviour, loading/empty/error states, and access requirements.
Screens:
1. Home (/): salon branding, open/closed status, live queue summary, barber availability, Join Queue CTA.
2. Join Queue (/join): customer name, validated 10-digit phone, service cards (maximum 3), barber preference, live total duration/price/wait summary, confirmation.
3. My Status (/status/:id): large token, position, estimated wait, Start coming message when near turn, prominent It's your turn state, cancel with confirmation.
4. Reception (/reception): tablet-first barber cards, waiting list, Call next, Add walk-in, No-show and Cancel.
5. Barber (/barber/:barberId): current customer, selected services, service timer, Start/Done, next eligible customer, Available/On break toggle.
6. Public display (/display): large readable barber rows, current token and next five tokens, clear called-token highlight and optional chime.
7. Admin (/admin): service CRUD, barber duty toggles, online queue open/close, business hours and today's stats.
Use realistic Indian sample names and rupee prices, but keep all data configurable. Do not invent extra screens.
Prompt 3 — Create flows, queue rules and test checklist (docs/03-flows-rules.md)
Create docs/03-flows-rules.md with customer-online and receptionist-walk-in flows, state transitions, barber assignment rules, wait-time calculation, no-show/cancel behaviour, and at least 10 acceptance tests.
Rules:
- Normal lifecycle: Waiting -> Called -> In chair -> Done. Waiting may become Cancelled. Called may become No-show. Never silently move a customer backwards.
- First come, first served among customers eligible for the selected barber.
- Call next for barber X chooses the earliest Waiting customer who selected X or Any.
- A customer who selected a specific barber must never be assigned to a different barber.
- A barber may have only one active In chair customer.
- Estimate wait using service durations ahead and currently working/available barbers; document the exact formula and handle zero available barbers.
- A phone number may have only one active queue entry.
- If a Called customer does not arrive within 10 minutes, reception may mark No-show. If they return, add them at the end with a new token.
- Online joining closes 30 minutes before closing; reception can still add walk-ins.
- Customers assigned to a barber on break must see a clear explanation and must not be silently reassigned.
Include tests for duplicate phone, service total, barber preference, no-show/re-add, live updates, queue closure, Gujarati labels, and wait-time recalculation.
Prompt 4 — Create AGENTS.md
Create a concise AGENTS.md in the repository root. It must instruct Antigravity/Codex to read docs/01-brief.md, docs/02-screens.md and docs/03-flows-rules.md before changing code. State the approved stack, run/build commands, charcoal-and-gold theme, English/Gujarati translation requirement, centralized queue rules, role-based access, and deployment direction. Work on one feature at a time; do not remove existing working features; inspect existing code before replacing anything. After each task list changed files, commands run, test results, and any remaining issues. Never place secrets in source control.
B. Screen and workflow prompts
Prompt 5 — Project initialization and seven route shells
Read AGENTS.md and all docs/. Inspect the existing repository first. Set up or complete the React + Vite + TypeScript + Tailwind frontend and Node + Express + TypeScript backend using the simplest architecture consistent with the current code. Configure routing for /, /join, /status/:id, /reception, /barber/:barberId, /display and /admin. Add shared layout, theme tokens, English/Gujarati language switching, environment configuration, and a basic GET /api/health endpoint. Do not implement fake production queue behaviour. Run frontend and backend, build/type-check both, and report exact commands and results.
Prompt 6 — Premium home page
Build only the Home screen (/) according to docs/02-screens.md. Create a polished, premium salon landing page with responsive navigation, salon name/logo area, Open/Closed badge, live queue count and estimated wait, barber availability chips, service highlights, a clear gold Join Queue button, how-it-works section, and footer. Use realistic placeholder content only where backend data is not ready, and label it as demo data. Match the charcoal/gold design. Do not modify other screens. Test desktop and mobile layouts.
Prompt 7 — Join Queue screen
Build /join from docs/02-screens.md. Include customer name, 10-digit Indian phone validation, service selection with a maximum of 3 active services, barber preference (Any or a specific barber), and a live summary of total service duration, price, and estimated wait. Disable confirmation until inputs are valid. Submit to the backend; do not create a fake successful booking. Handle duplicate active phone numbers, closed online queue, unavailable services, API errors, loading state, and success navigation to /status/:id. Keep the UI mobile-first.
Prompt 8 — My Queue Status
Build /status/:id using real backend queue data. Show the token prominently, current status, position, estimated wait, selected services and barber. Add the Start coming state when the customer is close to the front, and an accessible full-screen/high-emphasis It's your turn state when called. Provide Cancel my spot with a confirmation dialog. Subscribe to real-time updates and recover gracefully after refresh or lost connection. Never display fabricated queue values.
Prompt 9 — Reception dashboard
Build /reception for a 10-inch tablet in landscape and make it responsive. Show barber cards with current customer, elapsed/service time and Call next action. Show the ordered waiting list with token, customer, services, preferred barber, wait and status. Add + Add walk-in form, No-show and Cancel actions with confirmation where destructive. Highlight long waits. All actions must call the backend and update other connected screens. Use sample data only in an explicitly marked demo mode.
Prompt 10 — Barber dashboard
Build /barber/:barberId. Show the authenticated barber's current customer, token, services, timer, and next eligible customer. Implement Start and Done with correct state transitions. Include Available/On break control. Prevent starting a second customer while one is In chair. Enforce barber identity and permissions on the server, not only in the UI. Synchronize changes with reception, customer status and public display.
Prompt 11 — Waiting-area TV display
Build /display as a full-screen public display readable from at least 5 metres. Show each barber, current token/customer-safe display information, and the next five tokens with clear hierarchy. Newly called tokens should be highlighted clearly with a subtle animation and optional chime. Do not expose phone numbers or private customer details. Keep the screen continuously synchronized through the backend and Socket.IO.
Prompt 12 — Owner/Admin settings
Build /admin for authorized owner/admin users. Add service management (English/Gujarati name, duration, price, active toggle), barber duty/availability controls, online queue Open/Closed switch, business opening/closing time, and daily statistics (served customers, average wait, no-shows). Turning off a service must remove it from new customer selection without corrupting existing queue entries. Closing online joining must disable the customer Join action but preserve receptionist walk-ins. Validate all changes on the backend.
C. Backend, database and real-time prompts
Prompt 13 — Backend API and data model
Audit the existing backend before coding. Implement or complete a clean Express + TypeScript API for services, barbers, queue entries, customer status, reception actions, barber actions, admin settings and statistics. Define validated request/response types, centralized error handling, input validation, consistent HTTP status codes, and database constraints. Preserve the existing project structure and features where possible. Document endpoints and required environment variables. Do not hard-code credentials.
Prompt 14 — Queue engine and business rules
Implement the queue engine in one centralized service/module and make every route use it. Enforce first-come-first-served among barber-eligible entries, Any-barber eligibility, specific-barber restrictions, one active customer per barber, allowed status transitions, duplicate active phone prevention, no-show/re-add at the end with a new token, online closure rules and correct wait estimates. Add unit/integration tests for edge cases. Explain the wait-time formula and how it behaves when no barber is available.
Prompt 15 — Socket.IO live synchronization
Integrate Socket.IO so customer Join/Status, Reception, Barber and TV Display remain synchronized across separate browsers/devices. Broadcast only the minimum safe event payloads after successful database commits. Cover queue-created, queue-called, started, completed, cancelled, no-show, barber availability and admin settings changes. Reconnect and refetch authoritative state after network interruption. Target visible updates within 5 seconds. Add tests or a manual multi-window verification procedure.
Prompt 16 — Database migration and persistence audit
Inspect the current database implementation and all queries before making changes. Ensure the production database is persistent and supports the deployed multi-user application. If migrating from SQLite to hosted PostgreSQL, create a safe schema/migration plan, preserve users, services, barbers, queue records and relationships, use parameterized queries, indexes and transactions, and verify the migration with counts and sample reads. Do not use a local filesystem database for a horizontally deployed or ephemeral service. Never print or commit database credentials.
D. Authentication, authorization and security
Prompt 17 — Complete authentication and RBAC
Audit authentication end to end. Implement secure login/logout and JWT session handling with a strong JWT_SECRET supplied only through environment variables. Enforce role-based access for Owner/Admin, Receptionist and Barber routes and APIs; customer/public status endpoints must expose only the information needed for that customer/public display. Verify barber identity against the authenticated account and route parameter. Hash passwords with a modern password-hashing library, validate inputs, protect privileged operations, configure CORS for the actual frontend origin, and avoid leaking secrets or stack traces. Do not create a public default admin account. Provide a secure documented owner-seeding procedure and test every role.
Prompt 18 — Authentication bug investigation
The login/authentication flow is not working reliably. Trace the complete flow from frontend form submission through API route, validation, database lookup, password verification, JWT creation, token storage/cookie handling, protected route middleware and role checks. Reproduce the failure, identify the root cause, and fix it without weakening security or bypassing authentication. Check whether an initial Owner account exists and provide a secure one-time setup/seed process if it does not. Verify JWT_SECRET is configured locally and in production, is at least 32 bytes, and is never committed. Test successful login, wrong password, missing token, expired token and unauthorized role.
Prompt 19 — CORS and frontend/backend connection
Inspect the frontend API base URL, backend CORS configuration, credentials/cookie settings, and production environment variables. Configure the backend to allow the exact deployed frontend origin(s), while retaining localhost origins for local development through environment configuration. Remove hard-coded localhost URLs from production code. Confirm preflight requests, login, authenticated API requests and Socket.IO connections work from the deployed frontend. Do not use wildcard CORS with credentials.
E. Quality assurance and refinement
Prompt 20 — Full acceptance test
Read docs/03-flows-rules.md and execute every acceptance test against the real application. Test the complete customer journey, walk-in journey, barber-specific assignment, Any-barber assignment, duplicate phone, service totals, call/start/done, cancellation, no-show/re-add, queue closure, barber break, live synchronization, Gujarati translation, mobile layout, tablet reception and TV display. For each test report PASS/FAIL, exact steps, observed result and evidence. Fix failures one by one without breaking passing functionality. Do not claim a test passed unless it was actually run.
Prompt 21 — Bug-fix template (use for each issue)
Bug location/route: [enter route or screen].
Steps to reproduce: [exact clicks/actions].
Actual result: [what currently happens].
Expected result: [what should happen].
Console/server error: [paste relevant error].
Inspect the root cause first. Explain it briefly, make the smallest safe fix, and do not redesign unrelated screens or remove existing features. Add a regression test. Run the relevant test, build and type-check, then list changed files and results.
Prompt 22 — Specific no-show ordering bug
When a customer is marked No-show and later added again, the new entry must go to the END of the queue with a NEW token. Inspect token generation, queue ordering, timestamps and status filtering. Explain why the current implementation places the customer incorrectly, fix it transactionally, and add a regression test proving the re-added customer is behind all currently waiting eligible customers.
Prompt 23 — Specific wait-time bug
The estimated wait displays 0 minutes even though multiple customers are ahead. Trace the backend calculation and frontend display. Compare the implementation with docs/03-flows-rules.md. Correct the calculation for service durations, barber eligibility, active barbers, current in-chair work and rounding. Handle zero available barbers and missing service durations safely. Add tests for 0, 1 and multiple customers ahead.
Prompt 24 — Reception tablet UI refinement
On the Reception Dashboard, barber cards are too small on a tablet. Refine only this screen: use a clear 3-column barber-card row at the target tablet landscape width, make the time-left indicator a progress bar, preserve readable queue details and touch-friendly actions, and keep the layout responsive at smaller widths. Do not change queue logic or other screens.
Prompt 25 — Accessibility, responsive and translation audit
Audit every route on phone, tablet and desktop. Ensure tap targets are at least 44px, text contrast is readable, keyboard focus is visible, dialogs are accessible, forms have labels, loading/error/empty states are clear, and no content overflows. Switch the entire app to Gujarati and inspect every label, validation message, button and status. Fix missing translations through the shared language files; do not hard-code one-off labels.
F. Deployment preparation
Prompt 26 — Pre-deployment audit
Prepare the existing application for separate frontend and backend deployment on Render. Inspect package.json files, scripts, TypeScript build output, start commands, port binding, health endpoint, CORS, Socket.IO, environment variables, database connection, migrations, static asset paths and frontend API URL. Ensure the backend listens on process.env.PORT and 0.0.0.0 where required. Ensure production frontend uses the deployed backend URL, not localhost. Provide exact Render service settings and a checklist. Do not deploy or change providers without explaining the required configuration.
Prompt 27 — Fix Render filesystem database error (/var/data)
Render logs show: EACCES: permission denied, mkdir '/var/data'. Trace why the application tries to create or write to /var/data and identify whether the current database is SQLite or another local-file store. Do not blindly change permissions or write to an arbitrary directory. The production target is hosted PostgreSQL, so prioritize migrating the backend to PostgreSQL using DATABASE_URL and remove the local-file dependency. Preserve all queue, user, authentication and admin functionality. Update schema/migrations and queries safely, add connection pooling where appropriate, and verify the backend build and startup. Do not modify the frontend unnecessarily. Never expose credentials. Report changed files, required environment variable names, migration steps and Git commands.
Prompt 28 — Neon PostgreSQL migration
Migrate the backend database from local SQLite/file storage to hosted PostgreSQL (Neon). Use DATABASE_URL from the environment; do not hard-code the connection string. Audit all schema definitions, SQL syntax, data types, ID generation, transactions, date/time handling and queries for PostgreSQL compatibility. Create repeatable migrations and a safe initial schema/seed procedure. Preserve authentication, users/roles, services, barbers, queue entries, settings and statistics. Remove all production references to /var/data and local database files. Add connection error handling and a health check that verifies database connectivity without leaking secrets. Build, type-check and test every major API flow. Provide exact Render environment variable names and deployment steps.
Prompt 29 — Fix JWT_SECRET startup failure
Render deployment crashes with: JWT_SECRET must be configured with at least 32 bytes. Inspect the code to confirm the expected environment variable name and validation. Do not weaken or remove the security check. Explain how to generate a cryptographically random secret of at least 32 bytes and set it in the Render backend service environment settings. Ensure .env files and secret values are not committed or printed. Verify the service starts after the variable is configured and authentication still works.
Prompt 30 — Render backend service configuration
Configure the backend as a Render Web Service connected to the GitHub repository. Use the correct backend root directory (or repository root with the appropriate prefix), install/build command and start command based on the actual package scripts. Set required environment variables such as NODE_ENV, DATABASE_URL, JWT_SECRET, FRONTEND_ORIGINS and any other variables discovered in the code. Bind to Render's PORT. Add /api/health as the health check path. Confirm PostgreSQL connectivity, CORS, authentication and Socket.IO. Do not include secret values in documentation or Git.
Prompt 31 — Render frontend service configuration
Deploy the frontend separately on Render as a Static Site connected to the same GitHub repository. Inspect the actual repository structure and package scripts before choosing the root directory, build command and publish directory. Configure the frontend's production API base URL to the deployed backend URL using the framework's supported build-time environment variable. Add SPA fallback/rewrite rules so refreshing /join, /status/:id, /reception, /barber/:barberId, /display and /admin does not return 404. Confirm the deployed frontend can call the backend and open Socket.IO connections. Do not put backend secrets in frontend environment variables.
Prompt 32 — Final production smoke test
After deployment, test the actual public frontend URL and backend health URL. Verify Home loads, direct route refresh works, Join Queue submits to production PostgreSQL, status updates live, reception actions work, barber Start/Done works, display updates, admin settings persist, login and role permissions work, CORS is correct, and no localhost URLs or secrets appear in browser assets/logs. Check Render logs for startup/runtime errors. Report exact PASS/FAIL results and any remaining issue. Do not claim deployment is complete until the live end-to-end flow works.
Prompt 33 — README and handover
Update README.md with the project overview, feature list, technology stack, local setup, required environment variable NAMES (never values), database migration/setup, test commands, deployment architecture and live demo links. Put the live demo link immediately below the project title. Document safe test accounts only if they are intentionally created and safe to share. Add a short architecture explanation and known limitations. Ensure prompts.md contains the prompts actually used in chronological order; mark reconstructed prompts clearly rather than presenting them as exact historical messages.
G. Operational notes and safe deployment checklist
- Keep secrets such as DATABASE_URL and JWT_SECRET only in local ignored .env files or the hosting provider's secret/environment settings. Never paste real credentials into prompts, README, screenshots or Git commits.
- Do not use /var/data unless a correctly configured persistent disk is explicitly attached and the application is intentionally designed for file persistence. For this project, the chosen production direction is hosted PostgreSQL.
- Backend must use the hosting provider's PORT and expose a health endpoint. Frontend must use the deployed backend URL and must not contain localhost production endpoints.
- Configure FRONTEND_ORIGINS with the exact frontend origin(s). Configure SPA fallback for all client-side routes.
- After each meaningful change: run install if needed, build, type-check, tests, inspect git diff, commit, push, and verify the deployed result.
- Keep queue business rules centralized. Never fix a UI issue by bypassing backend authorization or changing queue semantics.
- Test using separate browser windows/devices to confirm real-time synchronization.
Historical prompt coverage and limitations
The source project guide recovered from the user's file library contains the original brief/screen/flow/AGENTS examples, eight-step build plan, queue-rule examples, bug prompts, deployment examples and submission checklist. The later project history confirms additional prompts for the Barber Dashboard, full completion/audit, /var/data permission failure, Neon PostgreSQL migration, JWT_SECRET startup failure, and separate frontend/backend deployment.

This document organizes those requirements into a chronological prompt book. Some later prompts are consolidated reconstructions because the full verbatim text of every prior chat message was not available. Use this as the single master prompt document, and keep an actual prompts.md in the repository that records the exact prompts submitted during future work.
