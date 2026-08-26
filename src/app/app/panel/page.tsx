// Panel de control (solo administrador): todo lo del servidor en un sitio.
// Tres pestañas por URL (?tab=): "Monitor" (salud del despliegue), "Servidor"
// (estado en vivo de la máquina) y "Visitas" (GA4, con rango ?dias=). Cada
// pestaña ejecuta solo sus mediciones, dentro de un Suspense: el cambio de
// pestaña pinta al instante y los datos llegan en streaming.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { snapshotInfra, snapshotServidor } from '@/lib/infra'
import { snapshotVisitas, type RangoDias } from '@/lib/ga'
import { ServidorTab } from '@/components/dashboard/panel/servidor'
import { VisitasTab } from '@/components/dashboard/panel/visitas'
import { UsersTable, type UserRow } from '@/components/dashboard/users/users-table'
import { SessionsList, type SessionRow } from '@/components/dashboard/users/sessions-list'
import { MantenimientoTab, type MaintenanceRow } from '@/components/dashboard/panel/mantenimiento'
import { cn } from '@/lib/utils'
import { dispositivoDe } from '@/lib/dispositivo'
import { correoConfigurado } from '@/lib/correo'
import { hoyMadrid } from '@/lib/mantenimiento'

export const metadata: Metadata = { title: 'Panel de control' }

const TABS = [
  { id: 'servidor', label: 'Servidor', href: '/app/panel' },
  { id: 'visitas', label: 'Visitas', href: '/app/panel?tab=visitas' },
  { id: 'usuarios', label: 'Usuarios', href: '/app/panel?tab=usuarios' },
  { id: 'mantenimiento', label: 'Mantenimiento', href: '/app/panel?tab=mantenimiento' },
] as const

// Componentes async separados: es lo que permite al Suspense pintar el
// esqueleto mientras cada pestaña ejecuta sus comprobaciones.
async function Servidor() {
  const [infra, maquina] = await Promise.all([snapshotInfra(), snapshotServidor()])
  return <ServidorTab infra={infra} maquina={maquina} />
}

// Purga oportunista de sesiones caducadas (el JWT vive 7 días desde el login)
// y lectura de las vivas. Fuera del componente: trabajo impuro (reloj + BD).
async function cargarSesiones() {
  const limite = new Date(Date.now() - 7 * 86_400_000)
  await prisma.userSession.deleteMany({ where: { createTs: { lt: limite } } })
  const sesiones = await prisma.userSession.findMany({ orderBy: { lastSeen: 'desc' } })
  return { sesiones, ahora: new Date().toISOString() }
}

async function Usuarios({ meUuid, meSessionUuid }: { meUuid: string; meSessionUuid?: string }) {
  const [users, { sesiones, ahora }] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    cargarSesiones(),
  ])
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

  // Sin FK físico (colaciones dispares local/prod): el cruce se hace aquí.
  const porUuid = new Map(users.map((u) => [u.uuid, u]))
  const sessionRows: SessionRow[] = sesiones.map((s) => {
    const u = porUuid.get(s.userUuid)
    return {
      uuid: s.uuid,
      userName: u?.name ?? null,
      userEmail: u?.email ?? 'Usuario eliminado',
      userPicture: u?.picture ?? null,
      dispositivo: dispositivoDe(s.userAgent),
      inicioTs: s.createTs.toISOString(),
      lastSeenTs: s.lastSeen.toISOString(),
      esActual: s.uuid === meSessionUuid,
    }
  })

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Acceso por lista de invitados: solo los correos dados de alta pueden entrar con Google.
      </p>
      <UsersTable rows={rows} meUuid={meUuid} />
      <SessionsList rows={sessionRows} ahora={ahora} />
    </div>
  )
}

async function Mantenimiento() {
  const tareas = await prisma.maintenanceTask.findMany({ orderBy: { nextDue: 'asc' } })
  const rows: MaintenanceRow[] = tareas.map((t) => ({
    uuid: t.uuid,
    title: t.title,
    notes: t.notes,
    intervalMonths: t.intervalMonths,
    nextDue: t.nextDue.toISOString().slice(0, 10),
    lastDone: t.lastDone ? t.lastDone.toISOString().slice(0, 10) : null,
  }))
  return <MantenimientoTab rows={rows} hoy={hoyMadrid()} smtpListo={correoConfigurado()} />
}
async function Visitas({ dias }: { dias: RangoDias }) {
  return <VisitasTab snapshot={await snapshotVisitas(dias)} />
}

function Esqueleto() {
  return (
    <div aria-hidden="true">
      <div className="mb-3 flex justify-end">
        <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    </div>
  )
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dias?: string }>
}) {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma. Módulo solo admin.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  const { tab, dias: diasParam } = await searchParams
  const activa =
    tab === 'visitas' || tab === 'usuarios' || tab === 'mantenimiento' ? tab : 'servidor'
  const dias: RangoDias = diasParam === '7' ? 7 : diasParam === '90' ? 90 : 30

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Gauge className="size-5 text-primary" />
        Panel de control
      </h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Salud del despliegue, visitas, usuarios y mantenimiento del servidor.
      </p>

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors',
              activa === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {t.label}
          </Link>
        ))}
      </div>

      <Suspense key={`${activa}-${dias}`} fallback={<Esqueleto />}>
        {activa === 'servidor' && <Servidor />}
        {activa === 'visitas' && <Visitas dias={dias} />}
        {activa === 'usuarios' && (
          <Usuarios meUuid={session.user.uuid} meSessionUuid={session.sessionUuid} />
        )}
        {activa === 'mantenimiento' && <Mantenimiento />}
      </Suspense>
    </div>
  )
}
