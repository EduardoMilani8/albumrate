import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL não definida. Copie server/.env.example para server/.env.')
}

const client = postgres(databaseUrl, { max: 1, prepare: false })
await migrate(drizzle(client), { migrationsFolder: './drizzle' })
await client.end()
console.log('Migrações aplicadas.')
