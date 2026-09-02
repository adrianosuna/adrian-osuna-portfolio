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
import { historicoInfra } from '@/lib/infra-historico'
import { snapshotVisitas, type RangoDias } from '@/lib/ga'
import { ServidorTab } from '@/components/dashboard/panel/servidor'
import { VisitasTab } from '@/components/dashboard/panel/visitas'
import { UsersTable, type UserRow } from '@/components/dashboard/users/users-table'
import { SessionsList, type SessionRow } from '@/components/dashboard/users/sessions-list'
import { AccesosList, type AccesoRow } from '@/components/dashboard/users/accesos-list'
import { ApiTokens, type ApiTokenRow } from '@/components/dashboard/users/api-tokens'
import { SubTabs } from '@/components/dashboard/sub-tabs'
import { MantenimientoTab, type MaintenanceRow } from '@/components/dashboard/panel/mantenimiento'
import { NotasTab } from '@/components/dashboard/panel/notas'
import { PanelTabsMovil } from '@/components/dashboard/panel/tabs-movil'
import { cn } from '@/lib/utils'
import { dispositivoDe } from '@/lib/dispositivo'
import { correoConfigurado } from '@/lib/correo'
import { hoyMadrid, listAmbitos } from '@/lib/mantenimiento'
import { listNotes } from '@/lib/notas'
import { listarTokens } from '@/lib/api-token'
import { EsqueletoTarjetas } from '@/components/dashboard/esqueletos'
import { SITE_URL } from '@/lib/site'
import { limiteAbsoluto, textoCaducidad } from '@/lib/sesion-caducidad'

export const metadata: Metadata = { title: 'Panel de control' }

const TABS = [
  { id: 'servidor', label: 'Servidor', href: '/app/panel' },
  { id: 'visitas', label: 'Visitas', href: '/app/panel?tab=visitas' },
  { id: 'usuarios', label: 'Usuarios', href: '/app/panel?tab=usuarios' },
  { id: 'mantenimiento', label: 'Mantenimiento', href: '/app/panel?tab=mantenimiento' },
  { id: 'notas', label: 'Notas', href: '/app/panel?tab=notas' },
] as const

// Componentes async separados: es lo que permite al Suspense pintar el
// esqueleto mientras cada pestaña ejecuta sus comprobaciones.
async function Servidor() {
  const [infra, maquina, historico] = await Promise.all([
    snapshotInfra(),
    snapshotServidor(),
    historicoInfra(),
  ])
  return <ServidorTab infra={infra} maquina={maquina} historico={historico} />
}

// Purga oportunista de las sesiones que ya han pasado el tope absoluto, y
// lectura de las vivas. El plazo NO se repite aquí: sale de
// `sesion-caducidad.ts`, el mismo que aplica `auth.ts`.
// Fuera del componente: trabajo impuro (reloj + BD).
async function cargarSesiones() {
  await prisma.userSession.deleteMany({ where: { createTs: { lt: limiteAbsoluto() } } })
  const sesiones = await prisma.userSession.findMany({ orderBy: { lastSeen: 'desc' } })
  return { sesiones, ahora: new Date().toISOString() }
}

/** Últimos accesos del histórico (append-only) y cuántos hay en total. */
const ACCESOS_VISIBLES = 15
async function cargarAccesos() {
  const [accesos, total] = await Promise.all([
    prisma.loginEvent.findMany({
      orderBy: [{ createTs: 'desc' }, { id: 'desc' }],
      take: ACCESOS_VISIBLES,
    }),
    prisma.loginEvent.count(),
  ])
  return { accesos, total }
}

/** Sub-pestañas de Usuarios (`?u=`): cuentas, sesiones vivas, histórico y API. */
type SubUsuarios = 'cuentas' | 'sesiones' | 'accesos' | 'api'

async function Usuarios({
  meUuid, meSessionUuid, sub,
}: {
  meUuid: string
  meSessionUuid?: string
  sub: SubUsuarios
}) {
  // Se consulta SOLO lo de la sub-pestaña abierta (y las cuentas, que hacen
  // falta en las tres para cruzar el usuario de cada fila). Antes se traían las
  // tres cosas siempre para pintarlas juntas.
  const [users, sesionesData, accesosData, tokens] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    sub === 'sesiones' ? cargarSesiones() : null,
    sub === 'accesos' ? cargarAccesos() : null,
    sub === 'api' ? listarTokens(meUuid) : null,
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

  const sessionRows: SessionRow[] = (sesionesData?.sesiones ?? []).map((s) => {
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

  // El correo va guardado en la propia fila del acceso: el registro sigue
  // siendo legible aunque el usuario se haya borrado después.
  const accesoRows: AccesoRow[] = (accesosData?.accesos ?? []).map((a) => ({
    uuid: a.uuid,
    userName: porUuid.get(a.userUuid)?.name ?? null,
    userEmail: a.userEmail,
    userPicture: porUuid.get(a.userUuid)?.picture ?? null,
    dispositivo: dispositivoDe(a.userAgent),
    ts: a.createTs.toISOString(),
  }))

  const base = '/app/panel?tab=usuarios'
  return (
    <div>
      <SubTabs
        ariaLabel="Secciones de usuarios"
        activa={sub}
        tabs={[
          { id: 'cuentas', label: 'Cuentas', href: base, cuenta: users.length },
          { id: 'sesiones', label: 'Sesiones', href: `${base}&u=sesiones` },
          { id: 'accesos', label: 'Accesos', href: `${base}&u=accesos` },
          { id: 'api', label: 'API', href: `${base}&u=api` },
        ]}
        repartir={false}
      />
      {sub === 'sesiones' ? (
        <SessionsList
          rows={sessionRows}
          ahora={sesionesData?.ahora ?? ''}
          politica={textoCaducidad()}
        />
      ) : sub === 'accesos' ? (
        <AccesosList rows={accesoRows} total={accesosData?.total ?? 0} />
      ) : sub === 'api' ? (
        <ApiTokens rows={(tokens ?? []) as ApiTokenRow[]} base={SITE_URL} />
      ) : (
        <UsersTable rows={rows} meUuid={meUuid} />
      )}
    </div>
  )
}

async function Mantenimiento({ vista }: { vista: 'lista' | 'calendario' }) {
  const [tareas, ambitos] = await Promise.all([
    prisma.maintenanceTask.findMany({ orderBy: { nextDue: 'asc' }, include: { scope: true } }),
    listAmbitos(),
  ])
  const rows: MaintenanceRow[] = tareas.map((t) => ({
    uuid: t.uuid,
    title: t.title,
    scopeUuid: t.scopeUuid,
    scopeName: t.scope?.name ?? null,
    notes: t.notes,
    intervalMonths: t.intervalMonths,
    nextDue: t.nextDue.toISOString().slice(0, 10),
    lastDone: t.lastDone ? t.lastDone.toISOString().slice(0, 10) : null,
  }))
  return (
    <MantenimientoTab
      rows={rows}
      ambitos={ambitos}
      hoy={hoyMadrid()}
      smtpListo={correoConfigurado()}
      vista={vista}
    />
  )
}
async function Visitas({ dias }: { dias: RangoDias }) {
  return <VisitasTab snapshot={await snapshotVisitas(dias)} />
}

async function Notas({ abrir, nueva }: { abrir?: string; nueva?: boolean }) {
  return <NotasTab rows={await listNotes()} abrirUuid={abrir} nueva={nueva} />
}


export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string; dias?: string; u?: string; abrir?: string; nueva?: string; vista?: string
  }>
}) {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma. Módulo solo admin.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  const { tab, dias: diasParam, u, abrir, nueva, vista } = await searchParams
  const vistaMant = vista === 'calendario' ? 'calendario' : 'lista'
  const activa =
    tab === 'visitas' || tab === 'usuarios' || tab === 'mantenimiento' || tab === 'notas'
      ? tab
      : 'servidor'
  const dias: RangoDias = diasParam === '7' ? 7 : diasParam === '90' ? 90 : 30
  const sub: SubUsuarios =
    u === 'sesiones' || u === 'accesos' || u === 'api' ? u : 'cuentas'

  return (
    <div>
      {/* mb-5: separa el título de la barra (antes lo hacía el subtítulo, ya retirado). */}
      <h1 className="mb-5 flex items-center gap-2 text-xl font-bold">
        <Gauge className="size-5 text-primary" />
        Panel de control
      </h1>

      {/* Móvil: las cinco pestañas no caben en 375px (ni compactas), y el scroll
          o las dos filas no quedaban bien, así que va un desplegable. Desde sm,
          las pestañas normales con su línea inferior. */}
      <div className="mb-5 sm:hidden">
        <PanelTabsMovil tabs={TABS} activa={activa} />
      </div>
      <div className="mb-5 hidden border-b border-border sm:block">
        <div className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={cn(
                'shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors',
                activa === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* La sub-pestaña entra en el key: cambiar de Cuentas a Sesiones vuelve a
          mostrar el esqueleto mientras se consulta lo suyo. */}
      <Suspense key={`${activa}-${dias}-${sub}`} fallback={<EsqueletoTarjetas />}>
        {activa === 'servidor' && <Servidor />}
        {activa === 'visitas' && <Visitas dias={dias} />}
        {activa === 'usuarios' && (
          <Usuarios meUuid={session.user.uuid} meSessionUuid={session.sessionUuid} sub={sub} />
        )}
        {activa === 'mantenimiento' && <Mantenimiento vista={vistaMant} />}
        {activa === 'notas' && <Notas abrir={abrir} nueva={nueva !== undefined} />}
      </Suspense>
    </div>
  )
}
