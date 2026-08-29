import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// On Vercel (production), the DATABASE_URL is set via environment variables
// and the schema uses PostgreSQL (Supabase). In local dev, the .env file
// contains the SQLite URL. Prisma reads the URL from env("DATABASE_URL")
// in schema.prisma automatically — no manual override needed here.

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
