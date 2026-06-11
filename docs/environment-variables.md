# Environment Variables

This document lists the main environment variables used by the system.

Do not commit real `.env` files or secrets to GitHub.

## Backend Variables

Backend folder:

```text
codes/Backend
```

### Server

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally, `production` on Render |
| `PORT` | API server port. Render commonly uses `10000` |
| `LOG_LEVEL` | Logging level, usually `info` |

### Database

| Variable | Purpose |
| --- | --- |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name |
| `DB_SSL` | Set `true` for Aiven |
| `DB_SSL_REJECT_UNAUTHORIZED` | Set `true` for Aiven |
| `DB_SSL_CA` | Aiven CA certificate |

### First Admin

These are used by admin setup scripts:

| Variable | Purpose |
| --- | --- |
| `SEED_ADMIN_NAME` | Initial admin display name |
| `SEED_ADMIN_EMAIL` | Initial admin email |
| `SEED_ADMIN_DEPARTMENT` | Initial admin department |
| `SEED_ADMIN_PASSWORD` | Initial admin password |

### Authentication

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Long random JWT secret |
| `JWT_REFRESH_SECRET` | Long random refresh-token secret |
| `JWT_EXPIRE` | Access token lifetime, for example `24h` |
| `JWT_REFRESH_EXPIRE` | Refresh token lifetime, for example `7d` |
| `SESSION_TIMEOUT_SECONDS` | Idle timeout, for example `3600` |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |

### Audit Log Retention

| Variable | Typical Value |
| --- | --- |
| `AUDIT_LOG_RETENTION_ENABLED` | `true` |
| `AUDIT_LOG_RETENTION_DAYS` | `180` |
| `AUDIT_LOG_CLEANUP_INTERVAL_HOURS` | `24` |
| `AUDIT_LOG_CLEANUP_BATCH_SIZE` | `5000` |
| `AUDIT_LOG_ARCHIVE_BEFORE_DELETE` | `false` |

### Uploads

| Variable | Purpose |
| --- | --- |
| `UPLOAD_DIR` | Temporary/local upload folder |
| `MAX_FILE_SIZE` | Maximum upload size in bytes |
| `ALLOWED_FILE_TYPES` | Allowed upload extensions |

Local development can use:

```env
UPLOAD_DIR=./src/uploads
```

Production with Cloudflare R2 should use:

```env
UPLOAD_DIR=/tmp/uploads
```

### Cloudflare R2

```env
FILE_STORAGE_PROVIDER=r2
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=orthoflow-documents
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_REGION=auto
R2_FORCE_PATH_STYLE=true
```

Alternative:

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
```

If `R2_ENDPOINT` is set, it is used directly.

### SMTP2GO Email

```env
EMAIL_SIMULATION=false
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your_smtp2go_smtp_username
SMTP_PASS=your_smtp2go_smtp_password
SMTP_FROM=no-reply@dental.pdn.ac.lk
```

`SMTP_USER` and `SMTP_PASS` must be SMTP2GO SMTP credentials, not the SMTP2GO web login password.

### Brevo Email

```env
EMAIL_SIMULATION=false
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
SMTP_FROM=no-reply@dental.pdn.ac.lk
```

Brevo may show port `587`. If Render times out on `587`, use `2525` with `SMTP_SECURE=false`. If needed, try:

```env
SMTP_PORT=465
SMTP_SECURE=true
```

`SMTP_PASS` must be a Brevo SMTP key, not a Brevo API key and not the Brevo web login password.

### Rate Limiting and CORS

| Variable | Purpose |
| --- | --- |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window |
| `CORS_ORIGIN` | Frontend URL allowed to call backend |

Production example:

```env
CORS_ORIGIN=https://orthoflow-frontend.onrender.com
```

## Frontend Variables

Frontend folder:

```text
codes/Frontend
```

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Local development:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

