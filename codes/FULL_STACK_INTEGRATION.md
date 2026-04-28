# OrthoFlow Full-Stack Integration Guide

This document reflects the current repository state as of April 26, 2026.

## 1. Current Stack

- Backend: Node.js + Express + MySQL
- Frontend: React + Vite
- Authentication: email/password plus Google Sign-In using Google ID tokens
- Session model: JWT access token + refresh token with inactivity timeout enforcement
- File handling: Multer uploads, document download endpoints, dental-chart PDF export with Playwright fallback support
- Startup helper: `codes/start.sh` auto-installs missing dependencies, bootstraps the database, ensures an admin, starts both services, and opens the frontend

## 2. Repository Layout

```text
e23-co2060-Orthodontics-Workflow-Automation-System/
├── README.md
├── docs/
└── codes/
    ├── start.sh
    ├── QUICK_DEPLOY.md
    ├── FULL_STACK_INTEGRATION.md
    ├── Backend/
    │   ├── server.js
    │   ├── .env
    │   ├── database-schema.sql
    │   ├── scripts/
    │   │   ├── bootstrap-database.js
    │   │   ├── ensure-admin.js
    │   │   ├── migrate.js
    │   │   └── seed.js
    │   └── src/
    │       ├── config/
    │       ├── controllers/
    │       ├── middleware/
    │       ├── routes/
    │       └── services/
    └── Frontend/
        ├── .env
        └── src/app/
```

## 3. Startup Flow

The current new-device startup path is `codes/start.sh`.

Line by line, the helper performs this flow:

1. Moves into the script directory and resolves `Backend` and `Frontend` under `codes`.
2. Verifies `node` and `npm`.
3. Checks for the MySQL CLI, but only warns if it is missing because Node handles database bootstrap.
4. Requires `Backend/.env`.
5. Reads `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `GOOGLE_CLIENT_ID` from `Backend/.env`.
6. Requires `DB_NAME` and `DB_USER`; defaults host to `localhost` and port to `3306`.
7. Creates `Frontend/.env` if missing.
8. Adds `VITE_GOOGLE_CLIENT_ID` to `Frontend/.env` from backend `GOOGLE_CLIENT_ID` when available.
9. Installs backend dependencies only when `Backend/node_modules` is missing.
10. Runs `npm run bootstrap-db`.
11. Runs `npm run ensure-admin`.
12. Starts backend with `npm run dev` unless port `3000` is already listening.
13. Waits for `http://localhost:3000/health`.
14. Installs frontend dependencies only when `Frontend/node_modules` is missing.
15. Starts frontend with `npm run dev` unless port `5173` is already listening.
16. Waits for `http://localhost:5173`.
17. Opens `http://localhost:5173`.
18. Keeps the script alive and stops managed backend/frontend child processes on `Ctrl+C`.

## 4. Backend Integration Surface

`Backend/server.js` starts the API, validates the DB connection, ensures access-control schema updates exist, and starts two background jobs:

- audit log retention cleanup
- automatic appointment reminder processing

Current API roots:

- `/api/auth`
- `/api/patients`
- `/api/visits`
- `/api/documents`
- `/api/clinical-notes`
- `/api/payment-records`
- `/api/patient-materials`
- `/api/queue`
- `/api/cases`
- `/api/inventory`
- `/api/users`
- `/api/reports`

Operational endpoints:

- `GET /health`
- `GET /api`
- static uploads at `/uploads`

## 5. Frontend Integration Surface

The active application router is in `Frontend/src/app/App.tsx`.

Current authenticated pages:

- `/` dashboard
- `/patients`
- `/patients/:id`
- `/queue`
- `/cases`
- `/reports`
- `/materials`
- `/requests/approvals`
- `/settings`
- `/admin/users`
- `/admin/audit-logs`

Role-gated navigation and routes currently match the shipped UI:

- All signed-in users: dashboard, patients, settings
- Admin, orthodontist, dental surgeon, student, nurse, reception: clinic queue
- Admin, orthodontist, dental surgeon, student: student cases
- Admin only: reports, user management, audit log
- Admin and nurse: materials/inventory
- Orthodontist and dental surgeon: request approvals

Important current implementation detail:

- The frontend API base URL is hardcoded to `http://localhost:3000` in `Frontend/src/app/config/api.ts`
- The frontend reads `Frontend/.env` for `VITE_GOOGLE_CLIENT_ID`
- `codes/start.sh` creates `Frontend/.env` when missing and copies backend `GOOGLE_CLIENT_ID` into it when available
- For any non-localhost deployment, the frontend API base must be changed in code unless a reverse proxy preserves that backend origin

## 6. Core Implemented Domains

Current end-to-end domains in the codebase:

- authentication, Google Sign-In, token refresh, logout, profile update, and password change
- user management with admin-created accounts, soft delete/reactivation, permanent delete, and password reset email flow
- patient directory with filters, inactive/reactivate flow, record export, and assignment management
- pending assignment approval workflow for orthodontists and dental surgeons
- patient profile tabs for overview, visits, patient history, dental chart, documents, diagnosis, treatment plan/notes, payment records, and material usage
- visit scheduling and manual/automatic reminder sending
- clinic queue management
- student case tracking
- inventory/materials management with stock updates and restore flow
- reports dashboard for admin
- audit log browsing for admin

## 7. Security and Access Model

Current security behavior in the running system:

- `helmet`, `cors`, `compression`, and request logging are enabled
- JWT access and refresh tokens are used
- inactivity timeout is enforced with `SESSION_TIMEOUT_SECONDS`
- users flagged with `must_change_password` are forced to `/settings`
- auth routes use stricter rate limiting
- object-level access checks are enforced through `Backend/src/middleware/accessControl.js`

Notable current access behavior:

- inventory mutation routes are restricted to `NURSE`
- admin can manage users and read reports/audit logs
- receptionist workflows focus on patient-general and appointment operations
- orthodontist and dental surgeon workflows are assignment-aware
- diagnosis and treatment access differs by role and patient assignment

## 8. Environment Configuration

Backend environment comes from `codes/Backend/.env`. This file is required before running `codes/start.sh`.

Minimum backend values:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=orthoflow

JWT_SECRET=change_this_to_a_long_random_value
JWT_REFRESH_SECRET=change_this_to_a_different_long_random_value
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
SESSION_TIMEOUT_SECONDS=3600

CORS_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

EMAIL_SIMULATION=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email
SMTP_PASS=your_app_password
SMTP_FROM=your_email

SEED_ADMIN_NAME=System Administrator
SEED_ADMIN_EMAIL=admin@orthoflow.edu
SEED_ADMIN_DEPARTMENT=Orthodontics
SEED_ADMIN_PASSWORD=
```

Other active backend settings supported today:

- `AUDIT_LOG_RETENTION_*`
- `UPLOAD_DIR`
- `MAX_FILE_SIZE`
- `ALLOWED_FILE_TYPES`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `LOG_LEVEL`

Frontend environment:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

The startup helper can create `Frontend/.env` automatically from backend `GOOGLE_CLIENT_ID`.

## 9. Database and Admin Scripts

Normal startup uses:

```bash
cd codes/Backend
npm run bootstrap-db
npm run ensure-admin
```

`bootstrap-db` behavior:

- connects using `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`
- creates the configured database from `database-schema.sql` when it is missing or empty
- runs runtime schema guards from `Backend/src/config/database.js`
- keeps existing OrthoFlow data when the `users` table already exists
- refuses to initialize a non-empty unknown database without an OrthoFlow `users` table

`ensure-admin` behavior:

- checks for an active `ADMIN`
- does nothing when one exists
- creates or promotes the `SEED_ADMIN_EMAIL` user when no active admin exists
- uses `SEED_ADMIN_PASSWORD` when provided
- generates and prints a temporary password when `SEED_ADMIN_PASSWORD` is blank
- sends or simulates the temporary password email according to email settings

Manual reset/development scripts:

```bash
npm run migrate
npm run seed
```

Use these carefully. Migration applies `database-schema.sql`, which drops and recreates the configured schema. Seeding clears application tables before inserting baseline system settings and the admin account.

## 10. Local Full-Stack Startup

From the repository root:

```bash
./codes/start.sh
```

From inside `codes`:

```bash
./start.sh
```

Backend-only startup:

```bash
cd codes/Backend
npm install
npm run bootstrap-db
npm run ensure-admin
npm run dev
```

Frontend-only startup:

```bash
cd codes/Frontend
npm install
npm run dev
```

## 11. Google Sign-In

Google login is implemented but only works when both sides use a valid client ID.

Required setup:

1. Create a Google OAuth web client.
2. Add `http://localhost:5173` to authorized JavaScript origins.
3. Put the same client ID in `Backend/.env` as `GOOGLE_CLIENT_ID`.
4. Let `start.sh` copy it to `Frontend/.env`, or manually set `VITE_GOOGLE_CLIENT_ID`.

Current backend behavior:

- validates Google ID token audience against `GOOGLE_CLIENT_ID`
- accepts comma-separated backend client IDs if needed

## 12. Operational Validation

Recommended manual validation after startup:

1. Open `http://localhost:3000/health` and confirm the backend responds.
2. Open `http://localhost:5173` and confirm the frontend loads.
3. Sign in with the configured or generated admin account.
4. Verify patients, queue, materials, reports, user management, and audit log pages according to role.
5. Confirm save, delete, restore, reset-password, and download actions show visible feedback in the UI.
