// Singleton de PrismaClient (Prisma 7 con driver adapter de MariaDB/MySQL).
// El patrón globalThis evita agotar conexiones con el hot-reload de desarrollo.
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const crearCliente = () => {
  const url = new URL(process.env.DATABASE_URL as string)
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
  })
  return new PrismaClient({ adapter })
}

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalParaPrisma.prisma ?? crearCliente()

if (process.env.NODE_ENV !== 'production') globalParaPrisma.prisma = prisma
