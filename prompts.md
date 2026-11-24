# ✂️ Salon Queue Management System

## Complete AI Development Prompt Documentation

### From Idea → Planning → UI Design → Development → Testing → Deployment

---

# 1. Project Overview

## 1.1 Project Name
Salon Queue Management System

## 1.2 Live Project
https://salon-management-system-1-dbkv.onrender.com/

## 1.3 Project Description

The Salon Queue Management System is a web-based application designed to manage salon appointments, walk-in customers, barber assignments, and real-time queue updates.

The system provides separate dashboards for customers, receptionists, barbers, and administrators.

## 1.4 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite, TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| Database Hosting | Neon |
| Authentication | JWT |
| Real-time Updates | Socket.IO |
| Deployment | Render |
| Version Control | Git and GitHub |

## 1.5 Main Application Routes

| Route | Description |
|---|---|
| `/` | Home Page |
| `/join` | Join Queue |
| `/status/:id` | Customer Queue Status |
| `/reception` | Reception Dashboard |
| `/barber/:barberId` | Barber Dashboard |
| `/display` | Public TV Display |
| `/admin` | Admin Dashboard |

---

# 2. Table of Contents

## Phase 01: Project Planning
- Prompt 01: Analyze Project Requirements
- Prompt 02: Create Project Specification
- Prompt 03: Define Application Screens
- Prompt 04: Define Queue Management Rules

## Phase 02: Project Setup
- Prompt 05: Create AGENTS.md
- Prompt 06: Initialize Project Structure

## Phase 03: Frontend Development
- Prompt 07: Develop Home Page
- Prompt 08: Develop Join Queue Page
- Prompt 09: Develop Customer Status Page
- Prompt 10: Develop Reception Dashboard
- Prompt 11: Develop Barber Dashboard
- Prompt 12: Develop Public Display
- Prompt 13: Develop Admin Dashboard

## Phase 04: Backend Development
- Prompt 14: Develop Backend APIs
- Prompt 15: Implement Queue Management Engine
- Prompt 16: Implement Real-Time Updates
- Prompt 17: Configure PostgreSQL Database

## Phase 05: Authentication
- Prompt 18: Implement Authentication and Authorization
- Prompt 19: Fix Login Issues
- Prompt 20: Configure CORS

## Phase 06: Testing and Improvements
- Prompt 21: Test Application Features
- Prompt 22: Fix Application Bugs
- Prompt 23: Fix Queue Ordering
- Prompt 24: Improve Waiting-Time Calculation
- Prompt 25: Improve Responsive Design
- Prompt 26: Improve Accessibility and Language Support

## Phase 07: Production Preparation
- Prompt 27: Perform Production Audit
- Prompt 28: Fix Render Filesystem Error
- Prompt 29: Configure Neon PostgreSQL
- Prompt 30: Fix JWT Secret Configuration

## Phase 08: Deployment
- Prompt 31: Deploy Backend on Render
- Prompt 32: Deploy Frontend on Render
- Prompt 33: Perform Production Testing

## Phase 09: Documentation
- Prompt 34: Create README.md
- Prompt 35: Perform Final Project Audit

---

# 3. Phase 01: Project Planning

## Prompt 01: Analyze Project Requirements

```text
Act as a senior software architect.

Analyze the requirements of a Salon Queue Management System.

Identify:
- Main users and their roles.
- Required application features.
- Frontend pages.
- Backend APIs.
- Database entities.
- Queue management workflow.
- Authentication requirements.
- Security requirements.
- Real-time functionality.

Provide a complete technical plan before writing any code.

Do not start implementation until the architecture is clearly defined.
```

## Prompt 02: Create Project Specification

```text
Create a complete Software Requirements Specification (SRS) for the Salon Queue Management System.

Include:
1. Project introduction.
2. Project objectives.
3. Functional requirements.
4. Non-functional requirements.
5. User roles.
6. System architecture.
7. Database requirements.
8. API requirements.
9. Security requirements.
10. Deployment requirements.

Keep the documentation professional, clear, and suitable for a real-world software project.
```

## Prompt 03: Define Application Screens

```text
Design the complete screen structure for the Salon Queue Management System.

Required screens:

1. Home Page
2. Join Queue Page
3. Customer Status Page
4. Reception Dashboard
5. Barber Dashboard
6. Public TV Display
7. Admin Dashboard

For every screen, define:
- Purpose.
- Layout.
- Components.
- Buttons.
- Input fields.
- User interactions.
- Responsive behavior.

Maintain a consistent design system throughout the application.
```

## Prompt 04: Define Queue Management Rules

```text
Design a reliable queue management system for a salon.

Queue statuses:

- Waiting
- Called
- In Chair
- Done
- Cancelled
- No-show

Business rules:

1. Customers should be served according to queue order.
2. Customers can select a preferred barber.
3. A specific barber preference must never be overridden.
4. Customers without a preference can be assigned to eligible available barbers.
5. One barber can serve only one active customer at a time.
6. A customer should have only one active queue entry per phone number.
7. A customer who does not arrive within 10 minutes after being called may be marked No-show.
8. A customer rejoining after No-show receives a new token at the end of the queue.
9. Online queue registration closes 30 minutes before salon closing.
10. Receptionists can still add walk-in customers.
11. Barber breaks must be handled without silently changing customer assignments.
12. Waiting-time estimates should consider available barbers and services ahead.

Explain the complete queue workflow and implement these rules consistently.
```

---

# 4. Phase 02: Project Setup

## Prompt 05: Create AGENTS.md

```text
Create an AGENTS.md file for the Salon Queue Management System.

The project uses:

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS

Backend:
- Node.js
- Express
- TypeScript

Database:
- PostgreSQL

Other technologies:
- Socket.IO
- JWT Authentication

Define:
- Project architecture.
- Coding standards.
- Folder structure.
- Naming conventions.
- API conventions.
- Database conventions.
- Authentication rules.
- Security requirements.
- Testing guidelines.

Important:
Always inspect existing files before modifying them.
Do not unnecessarily rewrite working code.
Do not introduce duplicate implementations.
Do not expose secrets.
```

## Prompt 06: Initialize Project Structure

```text
Initialize the Salon Queue Management System using the approved architecture.

Create a clean and maintainable project structure.

Separate frontend and backend.

Configure:
- React with Vite.
- TypeScript.
- Tailwind CSS.
- Express backend.
- PostgreSQL connection.
- Environment variables.
- Development scripts.

Ensure frontend and backend can run independently.

Provide all commands required to install dependencies and start the application locally.
```

---

# 5. Phase 03: Frontend Development

## Prompt 07: Develop Home Page

```text
Build a premium home page for the Salon Queue Management System.

Design requirements:

- Premium charcoal and dark background.
- Gold accent color: #D4A017.
- Cream-colored text and surfaces.
- Modern typography.
- Professional salon branding.
- Responsive layout.
- Smooth transitions.
- Clean navigation.

Include:

1. Navigation bar.
2. Hero section.
3. Join Queue button.
4. Salon services section.
5. How It Works section.
6. Barber information.
7. Contact information.
8. Footer.

Use reusable React components.

Make the interface professional and mobile-friendly.
```

## Prompt 08: Develop Join Queue Page

```text
Develop the Join Queue page.

Required fields:

- Customer name.
- Phone number.
- Selected service.
- Preferred barber.
- Additional notes.

Features:

1. Validate all required fields.
2. Validate phone number.
3. Display available services.
4. Display available barbers.
5. Allow customers to select a preferred barber.
6. Submit queue registration to the backend.
7. Display the generated token.
8. Redirect to the customer status page.

Show clear loading, success, and error messages.

Use responsive design and proper form validation.
```

## Prompt 09: Develop Customer Status Page

```text
Develop the Customer Queue Status page.

Display:

- Customer name.
- Token number.
- Queue position.
- Selected service.
- Assigned barber.
- Current queue status.
- Estimated waiting time.
- Number of customers ahead.

Use Socket.IO for real-time updates.

Automatically update queue information when the queue changes.

Do not expose sensitive customer information.
```

## Prompt 10: Develop Reception Dashboard

```text
Build a professional Reception Dashboard.

Features:

1. View all queue entries.
2. Add walk-in customers.
3. Search customers.
4. Filter by queue status.
5. Assign barbers.
6. Call the next customer.
7. Mark customers as In Chair.
8. Mark customers as Done.
9. Mark customers as No-show.
10. Cancel queue entries.
11. View estimated waiting times.

Include confirmation dialogs for important actions.

Use real-time updates and responsive tables.
```

## Prompt 11: Develop Barber Dashboard

```text
Build a Barber Dashboard.

Display:

- Barber profile.
- Current customer.
- Current service.
- Queue information.
- Upcoming customers.
- Work status.

Features:

1. Start service.
2. Complete service.
3. Update availability.
4. Start break.
5. End break.
6. View service history.

A barber must not receive another active customer while already serving someone.

Ensure all actions are synchronized with the backend.
```

## Prompt 12: Develop Public TV Display

```text
Build a full-screen Public TV Display for the salon.

Display:

- Current token being served.
- Customer token called next.
- Available barbers.
- Waiting queue.
- Salon announcements.

Design requirements:

- Large readable text.
- High contrast.
- Full-screen layout.
- Automatic updates.
- Professional appearance.

Never display customer phone numbers or sensitive personal information.
```

## Prompt 13: Develop Admin Dashboard

```text
Build an Admin Dashboard for the Salon Queue Management System.

Features:

1. Dashboard statistics.
2. Manage barbers.
3. Manage services.
4. Manage employees.
5. Manage users.
6. Manage queue settings.
7. Configure opening and closing times.
8. View completed services.
9. View cancelled entries.
10. View no-show records.

Use role-based access control.

Only authorized administrators should access administrative features.
```

---

# 6. Phase 04: Backend Development

## Prompt 14: Develop Backend APIs

```text
Develop the backend using Node.js, Express, and TypeScript.

Create REST APIs for:

- Authentication.
- Customer registration.
- Queue management.
- Barber management.
- Service management.
- Reception operations.
- Admin operations.
- Dashboard statistics.

Requirements:

1. Use proper HTTP methods.
2. Validate request data.
3. Use centralized error handling.
4. Use appropriate HTTP status codes.
5. Follow a modular folder structure.
6. Protect private routes.
7. Use environment variables.
8. Avoid duplicate business logic.

Ensure all APIs work correctly with the React frontend.
```

## Prompt 15: Implement Queue Management Engine

```text
Implement the complete queue management engine.

Requirements:

1. Generate unique queue tokens.
2. Maintain queue ordering.
3. Assign customers to eligible barbers.
4. Respect preferred barber selections.
5. Prevent double assignment.
6. Prevent multiple active queue entries for the same phone number.
7. Handle customer cancellation.
8. Handle No-show.
9. Handle barber availability.
10. Handle barber breaks.
11. Update customer status.
12. Maintain queue history.

Use database transactions where required.

Ensure concurrent requests cannot create inconsistent queue states.
```

## Prompt 16: Implement Real-Time Updates

```text
Implement Socket.IO for real-time communication.

Required events:

- queue:created
- queue:updated
- queue:called
- queue:completed
- queue:cancelled
- barber:updated
- display:updated

Requirements:

1. Update customer status automatically.
2. Update reception dashboard.
3. Update barber dashboard.
4. Update public display.
5. Handle disconnected clients.
6. Avoid duplicate event processing.
7. Ensure authorized users receive appropriate data.

Do not expose private customer information through public events.
```

## Prompt 17: Configure PostgreSQL Database

```text
Configure PostgreSQL as the primary database.

Create appropriate tables for:

- Users.
- Customers.
- Barbers.
- Services.
- Queue Entries.
- Appointments.
- Salon Settings.
- Queue History.

Requirements:

1. Use proper primary keys.
2. Define foreign keys.
3. Add appropriate indexes.
4. Use timestamps.
5. Add constraints.
6. Prevent duplicate active queue entries.
7. Use migrations.
8. Configure DATABASE_URL.

Ensure the database works with Neon PostgreSQL in production.
```

---

# 7. Phase 05: Authentication and Security

## Prompt 18: Implement Authentication and Authorization

```text
Implement secure JWT authentication.

Roles:

- Customer.
- Receptionist.
- Barber.
- Owner/Admin.

Requirements:

1. Secure login.
2. Password hashing.
3. JWT access tokens.
4. Protected routes.
5. Role-based authorization.
6. Token expiration.
7. Secure logout.
8. Proper validation.
9. Secure error handling.

Ensure users can access only the features permitted by their roles.

Never store plaintext passwords.
```

## Prompt 19: Fix Login Issues

```text
Perform a complete investigation of the login and authentication system.

Check:

1. Frontend login form.
2. Backend login API.
3. Database user records.
4. Password hashing.
5. Password comparison.
6. JWT generation.
7. JWT_SECRET configuration.
8. Token storage.
9. Authentication middleware.
10. Role-based authorization.
11. CORS configuration.
12. Production API URL.

Identify the actual root cause.

Fix the issue properly without bypassing authentication or weakening security.

Test login for all required roles.
```

## Prompt 20: Configure CORS

```text
Configure production-ready CORS.

Requirements:

1. Allow the local frontend during development.
2. Allow the deployed frontend in production.
3. Use exact frontend origins.
4. Support required HTTP methods.
5. Support required headers.
6. Configure credentials correctly.
7. Do not use wildcard origins with credentials.

Read allowed origins from environment variables.

Verify frontend-backend communication locally and in production.
```

---

# 8. Phase 06: Testing and Improvements

## Prompt 21: Test Application Features

```text
Perform complete functional testing of the Salon Queue Management System.

Test:

1. Customer registration.
2. Queue token generation.
3. Queue ordering.
4. Barber assignment.
5. Preferred barber selection.
6. Reception operations.
7. Barber operations.
8. Admin operations.
9. Real-time updates.
10. Authentication.
11. Authorization.
12. Database persistence.

Identify failing test cases.

Fix all critical issues and verify the results.
```

## Prompt 22: Fix Application Bugs

```text
Inspect the complete application and identify bugs.

Check:

- Frontend errors.
- Backend errors.
- API failures.
- Database errors.
- Authentication problems.
- Incorrect queue ordering.
- Real-time synchronization.
- Responsive design.
- Form validation.
- Production configuration.

For every issue:

1. Identify the root cause.
2. Explain why it happens.
3. Fix the actual problem.
4. Test the fix.
5. Avoid breaking existing features.

Do not make unnecessary changes to working code.
```

## Prompt 23: Fix Queue Ordering

```text
Audit the queue ordering implementation.

Ensure:

1. Customers are served in the correct order.
2. Preferred barber customers are assigned only to their selected barber.
3. Customers without preferences can be assigned to eligible available barbers.
4. Called customers remain in the correct state.
5. No-show customers are handled correctly.
6. Rejoined customers receive new tokens.
7. Completed customers are removed from the active queue.

Test multiple customers and multiple barbers.

Fix any race conditions or incorrect ordering.
```

## Prompt 24: Improve Waiting-Time Calculation

```text
Improve the estimated waiting-time calculation.

Consider:

- Number of customers ahead.
- Service duration.
- Available barbers.
- Current barber workload.
- Preferred barber restrictions.
- Barber breaks.
- Current service in progress.

Handle situations where no barbers are available.

Display realistic estimated waiting times.

Keep the calculation consistent between the customer page and reception dashboard.
```

## Prompt 25: Improve Responsive Design

```text
Perform a complete responsive design audit.

Test the application on:

- Mobile phones.
- Tablets.
- Laptops.
- Desktop screens.
- Large displays.

Check:

1. Navigation.
2. Forms.
3. Tables.
4. Dashboards.
5. Buttons.
6. Cards.
7. Typography.
8. Spacing.
9. Scrolling.
10. Public TV display.

Fix layout issues without changing the existing visual identity.
```

## Prompt 26: Improve Accessibility and Language Support

```text
Improve application accessibility and language support.

Requirements:

1. Support English and Gujarati.
2. Use readable typography.
3. Add appropriate labels.
4. Support keyboard navigation.
5. Provide visible focus states.
6. Maintain sufficient color contrast.
7. Add meaningful error messages.
8. Avoid inaccessible interactions.

Ensure translations are consistent across all application screens.
```

---

# 9. Phase 07: Production Preparation

## Prompt 27: Perform Production Audit

```text
Perform a complete production-readiness audit.

Inspect:

1. Frontend build.
2. Backend build.
3. Database connection.
4. Environment variables.
5. Authentication.
6. CORS.
7. API endpoints.
8. Socket.IO.
9. Error handling.
10. Security.
11. Deployment configuration.

Identify all issues that could prevent production deployment.

Fix them without introducing unnecessary dependencies or changing the architecture.
```

## Prompt 28: Fix Render Filesystem Error

```text
The application is failing on Render with the following error:

EACCES: permission denied, mkdir '/var/data'

Investigate the root cause.

Inspect the database connection and filesystem usage.

The production application must use hosted PostgreSQL instead of relying on a local SQLite database or an unavailable filesystem directory.

Remove inappropriate production filesystem dependencies.

Preserve local development functionality where possible.

Do not use unsafe permission workarounds.
```

## Prompt 29: Configure Neon PostgreSQL

```text
Configure Neon PostgreSQL for production.

Requirements:

1. Use DATABASE_URL.
2. Configure the PostgreSQL connection pool.
3. Support SSL when required.
4. Handle connection errors.
5. Run database migrations.
6. Verify schema creation.
7. Verify database persistence.
8. Test production queries.

Ensure the application does not depend on a local database file in production.

Never hardcode database credentials.
```

## Prompt 30: Fix JWT Secret Configuration

```text
Render deployment is failing with:

JWT_SECRET must be configured with at least 32 bytes.

Investigate the authentication configuration.

Requirements:

1. Configure JWT_SECRET through Render environment variables.
2. Use a strong random secret of at least 32 bytes.
3. Validate the secret during application startup.
4. Never hardcode the secret.
5. Never expose the secret in frontend code.
6. Never commit secrets to GitHub.
7. Keep production and development secrets separate.

Do not remove or weaken the security validation.

Verify that the backend starts successfully after configuration.
```

---

# 10. Phase 08: Deployment on Render

## Prompt 31: Deploy Backend on Render

```text
Prepare and deploy the backend separately on Render.

Backend technology:

- Node.js.
- Express.
- TypeScript.
- PostgreSQL.
- Socket.IO.

Requirements:

1. Configure the correct root directory.
2. Configure the build command.
3. Configure the start command.
4. Configure environment variables.
5. Configure DATABASE_URL.
6. Configure JWT_SECRET.
7. Configure FRONTEND_ORIGINS.
8. Verify the health endpoint.
9. Check deployment logs.
10. Verify database connectivity.

Do not expose secrets.

Ensure the backend is production-ready.
```

## Prompt 32: Deploy Frontend on Render

```text
Prepare and deploy the frontend separately on Render.

Frontend technology:

- React.
- Vite.
- TypeScript.
- Tailwind CSS.

Requirements:

1. Configure the correct root directory.
2. Configure the build command.
3. Configure the publish directory.
4. Configure the production backend API URL.
5. Configure frontend environment variables.
6. Support client-side routing.
7. Verify all application routes.
8. Test frontend-backend communication.

Ensure the deployed frontend works correctly with the deployed backend.
```

## Prompt 33: Perform Production Testing

```text
Perform complete end-to-end testing of the deployed application.

Test:

1. Home page.
2. Customer registration.
3. Queue token generation.
4. Customer status.
5. Reception dashboard.
6. Barber dashboard.
7. Admin dashboard.
8. Public display.
9. Login and logout.
10. Real-time updates.
11. Database persistence.
12. Mobile responsiveness.

Check browser console errors and Render backend logs.

Fix all critical production issues.

Confirm that the application works correctly after refreshing pages and restarting services.
```

---

# 11. Phase 09: Documentation

## Prompt 34: Create README.md

```text
Create a professional README.md file for the Salon Queue Management System.

Include:

1. Project title.
2. Project description.
3. Features.
4. Technology stack.
5. Screenshots section.
6. Application architecture.
7. Project folder structure.
8. Installation instructions.
9. Environment variable setup.
10. Local development commands.
11. Database setup.
12. Deployment instructions.
13. Live application URL.
14. Future improvements.

Use proper Markdown headings, tables, lists, and code blocks.

Make the README suitable for a professional GitHub repository.
```

## Prompt 35: Perform Final Project Audit

```text
Act as a senior software engineer performing a final project review.

Inspect the complete Salon Queue Management System.

Verify:

1. Frontend functionality.
2. Backend functionality.
3. Database integration.
4. Authentication.
5. Authorization.
6. Queue management logic.
7. Real-time updates.
8. Responsive design.
9. Error handling.
10. Security.
11. Production deployment.
12. GitHub documentation.

Identify incomplete features and technical weaknesses.

Fix critical issues.

Provide a final report containing:

- Completed features.
- Fixed issues.
- Remaining limitations.
- Security improvements.
- Deployment status.
- Recommended future enhancements.

Do not claim a feature is working unless it has been tested.
```

---

# 12. Project Folder Structure

```text
salon_site/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── App.tsx
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── socket/
│   │   ├── utils/
│   │   └── server.ts
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── AGENTS.md
├── README.md
├── prompts.md
└── .gitignore
```

---

# 13. Security Checklist

## Authentication
- [ ] Passwords are hashed.
- [ ] JWT authentication is implemented.
- [ ] JWT_SECRET is configured securely.
- [ ] Protected routes are working.
- [ ] Role-based access control is implemented.

## Database
- [ ] PostgreSQL is used in production.
- [ ] DATABASE_URL is stored securely.
- [ ] Database migrations are configured.
- [ ] Database constraints are implemented.

## Deployment
- [ ] Backend is deployed on Render.
- [ ] Frontend is deployed on Render.
- [ ] Production API URL is configured.
- [ ] CORS is configured correctly.
- [ ] Socket.IO works in production.
- [ ] Application works after refresh.

## GitHub
- [ ] `.env` is not committed.
- [ ] Database credentials are not committed.
- [ ] JWT secrets are not committed.
- [ ] `.gitignore` is configured.
- [ ] README.md is updated.
- [ ] prompts.md is updated.

---

# 14. Live Project

## Salon Queue Management System

**Live Application:**

https://salon-management-system-1-dbkv.onrender.com/

---

# 15. Documentation Information

| Field | Details |
|---|---|
| Project | Salon Queue Management System |
| Documentation | AI Development Prompts |
| File Name | prompts.md |
| Format | Markdown |
| Total Prompts | 35 |
| Development Approach | AI-Assisted Development |
| Deployment Platform | Render |
| Database | Neon PostgreSQL |

---

**End of Documentation**
