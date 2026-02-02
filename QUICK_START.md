# Quick Start (ExamScan)

## 1) Database

- Run `database/schema_updates.sql` on your Neon/Postgres database.

## 2) Environment variables

Set these (Netlify UI or local `.env`):

- `NEON_DATABASE_URL`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `COOKIE_DOMAIN` (use `localhost` for local dev)
- `NODE_ENV` (`development` locally, `production` on Netlify)
- Optional (rate limiting): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

See `ENVIRONMENT_VARIABLES.md` for details.

## 3) Run locally

- `npm run netlify:dev`

## 4) Use the UI

- **Register (OTP)**: `/register`
- **Login (Password or OTP)**: `/login`
- **Forgot password (OTP)**: `/forgot-password`
- **Dashboard**: `/dashboard`

## Notes

- Auth uses **HttpOnly cookies**. CORS is handled in each function (`functions/utils/cors-headers.ts`).
