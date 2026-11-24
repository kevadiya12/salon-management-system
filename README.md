# Salon Queue Management System

A full-stack salon queue application built with React, Vite, TypeScript, Tailwind CSS, React Router, Express, Neon PostgreSQL, and Socket.IO.

## Documentation

- [Project overview](docs/01-project-overview.md)
- [Implemented requirements](docs/02-requirements.md)
- [System architecture](docs/03-system-architecture.md)
- [Database schema](docs/04-database-schema.md)
- [HTTP API](docs/05-api-documentation.md)
- [Socket.IO events](docs/06-socket-events.md)
- [Setup and running](docs/07-setup-and-running.md)
- [Testing guide](docs/08-testing-guide.md)

## Quick start

Requirements: Node.js 22.13 or newer, npm, and a Neon PostgreSQL database.

In one terminal:

```powershell
cd backend
Copy-Item .env.example .env
npm install
# Set DATABASE_URL and JWT_SECRET in backend/.env before starting.
npm run dev
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The backend listens on port 4000 by default; the Vite development server proxies `/api` and `/socket.io` to it. The health endpoint is `GET /api/health`.

The PostgreSQL schema and three default service records are initialized at backend startup. No barbers or customers are seeded. API authentication and role checks protect customer and staff operations.

See [setup and running](docs/07-setup-and-running.md) for environment variables and deployment notes, and [testing guide](docs/08-testing-guide.md) for validation commands.

# salon-management-system
Salon Queue Management System using React, Node.js, Express and Neon PostgreSQL
