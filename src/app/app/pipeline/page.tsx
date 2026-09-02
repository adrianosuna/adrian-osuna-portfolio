// Pipeline de oportunidades (personal del administrador): kanban de ofertas,
// encargos y contactos con su estado en el embudo, seguimientos con aviso por
// correo, historial de actividad por tarjeta, métricas y vista de archivo.
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hoyMadrid } from '@/lib/mantenimiento'
import { metricasPipeline } from '@/lib/pipeline'
import { PipelineBoard, type OpportunityRow } from '@/components/dashboard/pipeline/pipeline-board'
import { EsqueletoTablero } from '@/components/dashboard/esqueletos'

export const metadata: Metadata = { title: 'Oportunidades' }

type Vista = 'tablero' | 'tabla' | 'historico'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; abrir?: string; nueva?: string }>
}) {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma. Módulo personal: solo admin.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

  // La vista y lo que hay abierto viven en la URL: así un enlace (o la paleta
  // ⌘K, que busca por nombre) abre directamente el histórico o una ficha, y
  // volver atrás devuelve a donde estabas.
  const { vista: vistaParam, abrir, nueva } = await searchParams
  const vista: Vista =
    vistaParam === 'tabla' || vistaParam === 'historico' ? vistaParam : 'tablero'

  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Briefcase className="size-5 text-primary" />
        Oportunidades
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Pipeline de ofertas, encargos y contactos: de la primera toma de contacto al cierre.
      </p>
      {/* En Suspense: la consulta trae TODAS las oportunidades (las métricas
          miran el histórico completo), así que el título y el subtítulo salen
          antes en vez de esperarla. La `key` es la vista para que al cambiar de
          pestaña salga el esqueleto en vez de congelarse la anterior. */}
      <Suspense key={vista} fallback={<EsqueletoTablero />}>
        <Tablero vista={vista} abrir={abrir} nueva={nueva !== undefined} />
      </Suspense>
    </div>
  )
}

/** La consulta y el tablero. Separado para que el Suspense tenga qué esperar. */
async function Tablero({
  vista,
  abrir,
  nueva,
}: {
  vista: Vista
  abrir?: string
  nueva: boolean
}) {
  const registros = await prisma.opportunity.findMany({ orderBy: { updateTs: 'desc' } })
  // Props planas para el componente cliente: Decimal → number, Date → ISO.
  const filas: OpportunityRow[] = registros.map((o) => ({
    uuid: o.uuid,
    title: o.title,
    company: o.company,
    contact: o.contact,
    origin: o.origin,
    amount: o.amount === null ? null : Number(o.amount),
    notes: o.notes,
    status: o.status,
    nextAction: o.nextAction,
    nextActionDate: o.nextActionDate === null ? null : o.nextActionDate.toISOString().slice(0, 10),
    closedAt: o.closedAt === null ? null : o.closedAt.toISOString(),
    archived: o.archived,
    createTs: o.createTs.toISOString(),
    updateTs: o.updateTs.toISOString(),
  }))

  // Las métricas miran TODO el histórico; el tablero solo lo no archivado.
  const metricas = metricasPipeline(
    registros.map((o) => ({
      status: o.status,
      amount: o.amount === null ? null : Number(o.amount),
      createTs: o.createTs,
      closedAt: o.closedAt,
    })),
  )

  return (
    <PipelineBoard
      rows={filas.filter((f) => !f.archived)}
      archivadas={filas.filter((f) => f.archived)}
      metricas={metricas}
      hoy={hoyMadrid()}
      vista={vista}
      abrirUuid={abrir}
      nueva={nueva}
    />
  )
}
