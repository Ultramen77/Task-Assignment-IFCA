import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { PostgresDialect } from 'kysely'
import nodemailer from 'nodemailer'
import pg from 'pg'
import { allowedOrigins, databaseUrlWithoutSsl, requiredEnv } from './env.mjs'

const { Pool } = pg
const pool = new Pool({
  connectionString: databaseUrlWithoutSsl(),
  ssl: false,
  max: Number(process.env.AUTH_DB_POOL_MAX || 5),
})

const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : null

export const auth = betterAuth({
  database: {
    dialect: new PostgresDialect({ pool }),
    type: 'postgres',
    schemaName: 'auth',
  },
  secret: requiredEnv('BETTER_AUTH_SECRET'),
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  basePath: '/api/auth',
  trustedOrigins: allowedOrigins(),
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by the office/server administrator, not by a public signup page.
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (!mailer) {
        throw new Error('Password reset email is not configured. Set SMTP_* environment variables.')
      }

      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: 'Reset password Task Assignment',
        text: `Halo ${user.name},\n\nBuka link berikut untuk membuat password baru:\n${url}\n\nLink ini berlaku selama 1 jam.`,
      })
    },
  },
  plugins: [admin()],
})
