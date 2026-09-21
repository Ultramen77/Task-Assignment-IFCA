import dotenv from 'dotenv'

// Keep local secrets out of the browser bundle. The server loads .env.local first,
// then falls back to .env for deployments that inject environment variables.
dotenv.config({ path: '.env.local' })
dotenv.config()

export function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function databaseUrlWithoutSsl() {
  const rawUrl = requiredEnv('TARGET_DATABASE_URL')
  const normalizedUrl = rawUrl.replace(/([?&])sslmode=require([&]|$)/i, '$1sslmode=disable$2')
  return normalizedUrl.includes('sslmode=')
    ? normalizedUrl
    : `${normalizedUrl}${normalizedUrl.includes('?') ? '&' : '?'}sslmode=disable`
}

export function allowedOrigins() {
  return (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}
