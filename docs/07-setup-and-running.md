# Setup and Running

## Requirements

- Node.js 22.13 or newer.
- npm.
- A Neon PostgreSQL database.

## Install and run

Backend, from the repository root:

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Set `DATABASE_URL` to the Neon connection string before starting. Use the pooled connection endpoint (the Neon hostname normally includes `-pooler`) and keep `sslmode=require`. Set `JWT_SECRET` to a cryptographically random value of at least 32 bytes; never commit either value.

Set `JWT_SECRET` in `backend/.env` to a cryptographically random value of at least 32 bytes before starting the API. Example PowerShell commands (the generated value is written only to the ignored local `.env` file):

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
if (Select-String -Path .env -Pattern '^JWT_SECRET=' -Quiet) {
  (Get-Content .env) -replace '^JWT_SECRET=.*$', "JWT_SECRET=$secret" | Set-Content .env
} else {
  Add-Content .env "JWT_SECRET=$secret"
}
$rng.Dispose()
```

Create the initial owner with environment-provided credentials. The password prompt does not echo the password, and the environment variables are removed after the command:

```powershell
$env:INITIAL_OWNER_NAME = "Salon Owner"
$env:INITIAL_OWNER_EMAIL = "owner@example.com"
$securePassword = Read-Host "Initial owner password" -AsSecureString
$env:INITIAL_OWNER_PASSWORD = (New-Object System.Net.NetworkCredential("", $securePassword)).Password
npm run seed:owner
Remove-Item Env:\INITIAL_OWNER_NAME, Env:\INITIAL_OWNER_EMAIL, Env:\INITIAL_OWNER_PASSWORD
```

The owner seed requires a password with at least 12 characters. It creates only the first owner; rerunning does not create duplicates. Then start the API:

```powershell
npm run dev
```

Frontend, in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend is available at <http://localhost:5173>. The backend defaults to port 4000; check `GET http://localhost:4000/api/health`. Vite proxies `/api` and `/socket.io` to `http://127.0.0.1:4000` in development.

## Backend environment

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP and Socket.IO server port. Must be between 1 and 65535. |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed HTTP(S) origins. |
| `FRONTEND_ORIGIN` | unset | Legacy single-origin fallback if `FRONTEND_ORIGINS` is unset. |
| `DATABASE_URL` | Required | Neon PostgreSQL connection URI, preferably the pooled endpoint and with TLS required (`sslmode=require`). |
| `BUSINESS_TIME_ZONE` | `Asia/Kolkata` | IANA timezone used for business-day token sequences and daily counts. |
| `JWT_SECRET` | Required | Secret key for signing JWT access tokens; configure a random value of at least 32 bytes and keep it private. |
| `NODE_ENV` | unset | Set to `production` in deployment; controls secure authentication-cookie behavior. |

The initial owner seed also requires `INITIAL_OWNER_NAME`, `INITIAL_OWNER_EMAIL`, and `INITIAL_OWNER_PASSWORD` for the duration of `npm run seed:owner`. The password must contain at least 12 characters. These are one-time seed inputs, not runtime database settings.

To copy an existing SQLite installation into an empty Neon database, first configure `DATABASE_URL`, then set `SQLITE_SOURCE` to the path of the existing SQLite file and run `npm run migrate:sqlite`. This one-time import refuses to run when the target already contains user, customer, barber, or booking data. Back up both databases first and verify the imported records before directing production traffic.

## Frontend environment

Copy `frontend/.env.example` to `frontend/.env` to customize the optional branding values. Vite reads these values at build time; restart the dev server or rebuild after changes.

| Variable | Description |
| --- | --- |
| `VITE_SALON_NAME` | Salon name. Defaults to `Salon`. |
| `VITE_SALON_LOGO_URL` | Optional logo URL. Empty uses the initial-based mark. |
| `VITE_SALON_ADDRESS` | Optional address shown in footer/display. |
| `VITE_SALON_CONTACT_NUMBER` | Optional contact number shown as a telephone link/footer text. |
| `VITE_SALON_THEME_CHARCOAL` | Main charcoal color as 3- or 6-digit hex. |
| `VITE_SALON_THEME_CHARCOAL_DEEP` | Deep charcoal color. |
| `VITE_SALON_THEME_CHARCOAL_RAISED` | Raised charcoal color. |
| `VITE_SALON_THEME_GOLD` | Gold accent color. |
| `VITE_SALON_THEME_GOLD_LIGHT` | Light gold accent color. |
| `VITE_SALON_THEME_CREAM` | Cream text color. |
| `VITE_SOCKET_URL` | Optional Socket.IO origin override. Omit for same-origin/proxied connections. |

Invalid theme hex values fail frontend module initialization with a descriptive error.

Branding is not persisted by the backend and cannot be changed through the UI or API. In production, set the Vite variables before building and serve the frontend and backend with matching origin and CORS configuration. Use HTTPS in production; the authentication cookie is marked `Secure` when `NODE_ENV=production`.

## Single-service Render deployment

Configure the Render Web Service with the repository root as its root directory. Build both applications and start the backend from that same directory:

```text
Build command: npm run build --prefix backend && npm run build --prefix frontend
Start command: npm start --prefix backend
```

Set `DATABASE_URL` to the Neon pooled connection string and set a private `JWT_SECRET` in Render. Also configure `BUSINESS_TIME_ZONE` if the salon is outside `Asia/Kolkata`, `NODE_ENV=production`, and any additional allowed `FRONTEND_ORIGINS`. The service's own origin is allowed automatically. Leave `VITE_SOCKET_URL` unset so the frontend uses same-origin `/api` requests and `/socket.io` connections. SQLite persistent storage is no longer used.

## Other scripts

Backend: `npm run build`, `npm run start`, `npm run typecheck`, `npm test`.

Frontend: `npm run build`, `npm run preview`.
