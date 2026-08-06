import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida. Copie server/.env.example para server/.env.')
}

export const client = postgres(databaseUrl, { max: 10, prepare: false })
export const db = drizzle(client, { schema })
