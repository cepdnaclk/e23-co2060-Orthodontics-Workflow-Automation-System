# OrthoFlow Quick Deployment

This is the current new-device setup path for the repository.

Replace `/path/to/e23-co2060-Orthodontics-Workflow-Automation-System` with the folder where you cloned or extracted this repository.

## 1. What This Guide Covers

This guide brings up the local full-stack system from the `codes` workspace.

It assumes:

- Node.js 18+ is installed
- npm is installed
- MySQL 8+ is installed and running
- `codes/Backend/.env` exists and contains the local database, JWT, Google, email, and admin settings

The MySQL CLI is optional. The startup script uses the backend Node bootstrap script for database initialization.

## 2. Configure Backend Environment

Create or update:

```text
codes/Backend/.env
```

Minimum local values:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
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

For local-safe runs, keep `EMAIL_SIMULATION=true`. Real SMTP settings are used only when `EMAIL_SIMULATION=false`.

## 3. Start Everything

From the repository root:

```bash
./codes/start.sh
```

Or from inside `codes`:

```bash
./start.sh
```

Current startup behavior:

- checks Node.js and npm
- reads database and Google settings from `Backend/.env`
- creates `Frontend/.env` if missing
- adds `VITE_GOOGLE_CLIENT_ID` to `Frontend/.env` from backend `GOOGLE_CLIENT_ID` when available
- installs backend dependencies if `Backend/node_modules` is missing
- runs `npm run bootstrap-db`
- runs `npm run ensure-admin`
- starts the backend on `http://localhost:3000`
- waits for `http://localhost:3000/health`
- installs frontend dependencies if `Frontend/node_modules` is missing
- starts the frontend on `http://localhost:5173`
- opens the frontend in the default browser
- stops managed child processes on `Ctrl+C`

## 4. Database and Admin Behavior

The normal startup path is:

```bash
npm run bootstrap-db
npm run ensure-admin
```

`bootstrap-db` creates the configured database when it is missing or empty, applies `database-schema.sql`, and then applies runtime schema guards from `Backend/src/config/database.js`.

If the configured database already exists and contains the OrthoFlow `users` table, `bootstrap-db` keeps the data and only applies runtime schema guards. If a non-empty database exists but does not look like OrthoFlow, startup stops instead of overwriting it.

`ensure-admin` creates the configured admin only when no active admin exists. It reads:

- `SEED_ADMIN_EMAIL`, default `admin@orthoflow.edu`
- `SEED_ADMIN_NAME`, default `System Administrator`
- `SEED_ADMIN_DEPARTMENT`, default `Orthodontics`
- `SEED_ADMIN_PASSWORD`, or a generated temporary password when blank

When the password is generated, the terminal prints it and the user must change it after first login. A password email is sent or simulated depending on email configuration.

## 5. Manual Backend Commands

Use these from `codes/Backend` when you need backend-only control:

```bash
npm install
npm run bootstrap-db
npm run ensure-admin
npm run dev
```

Reset the configured admin password:

```bash
npm run reset-admin-password
```

Development reset scripts still exist:

```bash
npm run migrate
npm run seed
```

Use them carefully. `database-schema.sql` drops and recreates the configured schema during migration, and `seed` clears application tables before inserting baseline settings and the admin account.

## 6. Manual Frontend Commands

Use these from `codes/Frontend` when you need frontend-only control:

```bash
npm install
npm run dev
```

Set `Frontend/.env` manually only if the startup script cannot derive it:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

The frontend API base is currently hardcoded in `Frontend/src/app/config/api.ts` to:

```ts
BASE_URL: 'http://localhost:3000'
```

For non-localhost deployment, update that file or use infrastructure that preserves the same API origin.

## 7. Google Sign-In

Google Sign-In is optional for email/password local boot, but if you want it working:

1. Create a Google OAuth web client.
2. Add `http://localhost:5173` as an authorized JavaScript origin.
3. Put the same client ID in `Backend/.env` as `GOOGLE_CLIENT_ID`.
4. Let `start.sh` copy it into `Frontend/.env`, or set `VITE_GOOGLE_CLIENT_ID` manually.

If `VITE_GOOGLE_CLIENT_ID` is missing, the Google button will not initialize.

## 8. Optional Chromium for PDF Rendering

Playwright is already listed as a backend dependency. To enable Chromium-backed dental-chart PDF rendering:

```bash
cd "/path/to/e23-co2060-Orthodontics-Workflow-Automation-System/codes/Backend"
npx playwright install chromium
```

Without Chromium, the system falls back automatically.

## 9. Quick Verification

Check these after startup:

1. `http://localhost:3000/health`
2. `http://localhost:5173`
3. sign in with the configured or generated admin account
4. open patients, queue, or materials depending on role
5. for admin, verify reports, user management, and audit log pages load
