# OrthoFlow Backend

Express + MySQL backend for the current Orthodontics Workflow Automation System.

## Stack

- Node.js
- Express
- MySQL via `mysql2`
- JWT access and refresh tokens
- Joi validation
- Multer uploads
- Nodemailer email delivery or simulation

## Run Locally

Recommended full-system startup is handled by `codes/start.sh`; see `codes/QUICK_DEPLOY.md`.

For backend-only work:

```bash
cd codes/Backend
npm install
npm run bootstrap-db
npm run ensure-admin
npm run dev
```

`Backend/.env` must exist before running these commands. There is no current `.env.example`; use the environment section below as the setup checklist for a new device.

Health check:

```bash
curl http://localhost:3000/health
```

Important:

- `npm run bootstrap-db` creates the configured database when it is missing or empty, applies `database-schema.sql`, and then applies runtime schema guards
- `npm run bootstrap-db` refuses to initialize a non-empty unknown database that does not contain the OrthoFlow `users` table
- `npm run ensure-admin` creates the configured admin account only when no active admin exists, unless run through `npm run reset-admin-password`
- `npm run dev` currently runs `node server.js`
- `npm run migrate` and `npm run seed` are manual reset/development scripts; `seed` clears application tables and should not be used as the normal new-device startup step

## Environment

Create or update `codes/Backend/.env` with the active local settings.

Important variables:

- `PORT`, `NODE_ENV`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`
- `SESSION_TIMEOUT_SECONDS`
- `GOOGLE_CLIENT_ID`
- `EMAIL_SIMULATION`, `SMTP_*`
- `AUDIT_LOG_RETENTION_*`
- `UPLOAD_DIR`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`
- `CORS_ORIGIN`
- `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_DEPARTMENT`, `SEED_ADMIN_PASSWORD`

## API Roots

- API index: `GET /api`
- health: `GET /health`
- auth: `/api/auth`
- patients: `/api/patients`
- visits: `/api/visits`
- documents: `/api/documents`
- clinical notes: `/api/clinical-notes`
- queue: `/api/queue`
- cases: `/api/cases`
- inventory: `/api/inventory`
- users: `/api/users`
- reports: `/api/reports`

## Current Behavior Highlights

- DB connection test runs on startup
- access-control schema checks run on startup
- audit retention job starts with the server
- automatic reminder job starts with the server
- session inactivity timeout is enforced
- Google Sign-In uses backend audience validation against `GOOGLE_CLIENT_ID`
- inventory supports restore flow and transaction-safe deletion behavior
- dental-chart version workflows support download and orthodontist-managed bin actions

## Scripts

```bash
npm run dev
npm start
npm run bootstrap-db
npm run ensure-admin
npm run reset-admin-password
npm run migrate
npm run seed
```

## Admin Account

Admin setup is controlled by `SEED_ADMIN_*` values in `Backend/.env`.

- `SEED_ADMIN_EMAIL` defaults to `admin@orthoflow.edu`
- `SEED_ADMIN_NAME` defaults to `System Administrator`
- `SEED_ADMIN_DEPARTMENT` defaults to `Orthodontics`
- `SEED_ADMIN_PASSWORD` is used when provided
- when `SEED_ADMIN_PASSWORD` is blank, a temporary password is generated, printed in the terminal, and emailed if SMTP/simulation settings allow it

## Notes

Playwright is listed as a backend dependency for visual dental-chart PDF exports. After dependency install, Chromium can be installed when full browser-backed rendering is needed:

```bash
cd codes/Backend
npx playwright install chromium
```

Fallback PDF behavior is used automatically if Chromium is unavailable.
