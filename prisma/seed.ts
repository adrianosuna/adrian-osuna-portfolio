// Seed de la base de datos: asegura el usuario administrador (bootstrap del
// allowlist, equivalente al ensureAdmin() del Portfolio original).
// Ejecutar con: pnpm prisma db seed
import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const url = new URL(process.env.DATABASE_URL as string)
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 1,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    throw new Error('Falta ADMIN_EMAIL en el .env para crear el administrador')
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { email: adminEmail, role: 'ADMIN', status: 'ACTIVE' },
  })
  console.log(`Administrador asegurado: ${admin.email} (${admin.uuid})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
