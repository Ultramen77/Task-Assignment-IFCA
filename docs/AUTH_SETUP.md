# Authentication setup

The copied project uses Better Auth with the office PostgreSQL database. Better Auth tables live in the separate `auth` schema; task data remains in `public`.

## First admin account

Run this once from the project folder and choose the real office email/password:

```bash
npx auth@latest create-admin --config ./server/auth.mjs --email admin@office.example --name "Office Admin" --role admin
```

The password is prompted by the CLI when `--password` is omitted. Do not put it in Git, `.env.example`, or frontend code.

## Local run

Terminal 1:

```bash
npm run auth:dev
```

Terminal 2:

```bash
npm run dev
```

The frontend reads `VITE_AUTH_URL`; the auth server reads `TARGET_DATABASE_URL` and the Better Auth variables from `.env.local`.

## Password reset

- Admins can reset any user password from `/admin` without email infrastructure.
- The self-service `Lupa password?` flow requires SMTP settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.
- For production, set `CORS_ORIGIN` to the exact frontend origin(s) and `BETTER_AUTH_URL` to the deployed auth API origin.

Never commit `.env.local` or any SMTP/database credentials.
