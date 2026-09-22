import pg from 'pg'
import { databaseUrlWithoutSsl } from './env.mjs'

const { Pool } = pg

export const db = new Pool({
  connectionString: databaseUrlWithoutSsl(),
  ssl: false,
  max: Number(process.env.DATA_DB_POOL_MAX || process.env.AUTH_DB_POOL_MAX || 5),
  connectionTimeoutMillis: 15000,
})
