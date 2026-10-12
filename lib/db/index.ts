import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDatabase = globalThis as typeof globalThis & {
  databasePool?: Pool
}

export const pool =
  globalForDatabase.databasePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.databasePool = pool
}

export const db = drizzle(pool, { schema })

export { schema }
export type Database = typeof db

export async function closeDatabasePool() {
  await pool.end()
}

export const runtimeDatabaseConfigured = Boolean(process.env.DATABASE_URL)

if (!runtimeDatabaseConfigured) {
  throw new Error('DATABASE_URL must be configured to use the marketplace database.')
}
