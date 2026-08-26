// Pipeline de oportunidades (personal del administrador): kanban de ofertas,
// encargos y contactos con su estado en el embudo, seguimientos con aviso por
// correo, historial de actividad por tarjeta, métricas y vista de archivo.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hoyMadrid } from '@/lib/mantenimiento'
import { metricasPipeline } from '@/lib/pipeline'
import { PipelineBoard, type OpportunityRow } from '@/components/dashboard/pipeline/pipeline-board'

export const metadata: Metadata = { title: 'Oportunidades' }

export default async function PipelinePage() {
  // El layout ya redirige sin sesión, pero layout y página renderizan en
  // paralelo: la página debe protegerse por sí misma. Módulo personal: solo admin.
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/app')

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
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Briefcase className="size-5 text-primary" />
        Oportunidades
      </h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        Pipeline de ofertas, encargos y contactos: de la primera toma de contacto al cierre.
      </p>
      <PipelineBoard
        rows={filas.filter((f) => !f.archived)}
        archivadas={filas.filter((f) => f.archived)}
        metricas={metricas}
        hoy={hoyMadrid()}
      />
    </div>
  )
}
