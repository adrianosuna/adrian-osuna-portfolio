// Gestión de usuarios (allowlist): solo administradores. Invitar por correo,
// cambiar rol, activar/deshabilitar y eliminar.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { UsersTable, type UserRow } from '@/components/dashboard/users/users-table'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  const rows: UserRow[] = users.map((u) => ({
    uuid: u.uuid,
    email: u.email,
    name: u.name,
    picture: u.picture,
    role: u.role,
    status: u.status,
    lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    createTs: u.createTs.toISOString(),
  }))

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Users className="size-5 text-primary" />
        Usuarios
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Acceso por lista de invitados: solo los correos dados de alta pueden entrar con Google.
      </p>
      <UsersTable rows={rows} meUuid={session.user.uuid} />
    </div>
  )
}
