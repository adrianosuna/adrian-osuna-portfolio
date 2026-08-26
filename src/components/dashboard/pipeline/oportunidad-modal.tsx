'use client'

// Detalle de una oportunidad: formulario de alta/edición (datos + seguimiento
// con próxima acción y fecha) y, al editar, el timeline de actividad — los
// cambios de estado los apunta el sistema y las entradas manuales (nota,
// llamada, email, reunión) se añaden y borran desde aquí.
import { useEffect, useState, useTransition } from 'react'
import {
  ArrowRight, Mail, Phone, Plus, StickyNote, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { DateField, NumberField, SelectField, TextField, TextareaField } from '@/components/ui/fields'
import {
  addOpportunityEvent, createOpportunity, deleteOpportunityEvent,
  getOpportunityEvents, updateOpportunity,
} from '@/app/app/pipeline/actions'
import { ORIGENES, btnOutline, btnPrimary, type OpportunityRow } from './comun'

interface EventoRow {
  uuid: string
  type: string
  detail: string
  createTs: string // ISO
}

const TIPOS_EVENTO = [
  { value: 'NOTA', label: 'Nota' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'REUNION', label: 'Reunión' },
]

const ICONO_EVENTO: Record<string, typeof Mail> = {
  ESTADO: ArrowRight,
  NOTA: StickyNote,
  LLAMADA: Phone,
  EMAIL: Mail,
  REUNION: Users,
}

const fmtMomento = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

interface Borrador {
  title: string
  company: string
  contact: string
  origin: string
  amount: number | null
  notes: string
  nextAction: string
  nextActionDate: string // 'YYYY-MM-DD' o ''
}

const desdeFila = (o: OpportunityRow | null): Borrador => ({
  title: o?.title ?? '',
  company: o?.company ?? '',
  contact: o?.contact ?? '',
  origin: o?.origin ?? '',
  amount: o?.amount ?? null,
  notes: o?.notes ?? '',
  nextAction: o?.nextAction ?? '',
  nextActionDate: o?.nextActionDate ?? '',
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** oportunidad = null → alta; con fila → edición + timeline. */
export function OportunidadModal({
  oportunidad, onClose,
}: {
  oportunidad: OpportunityRow | null
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [borrador, setBorrador] = useState<Borrador>(() => desdeFila(oportunidad))

  const guardar = () => {
    if (!borrador.title.trim()) return void toast.error('El título es obligatorio')
    const datos = {
      title: borrador.title,
      company: borrador.company || null,
      contact: borrador.contact || null,
      origin: borrador.origin || null,
      amount: borrador.amount,
      notes: borrador.notes || null,
      nextAction: borrador.nextAction || null,
      nextActionDate: borrador.nextActionDate || null,
    }
    startTransition(async () => {
      const res = oportunidad
        ? await updateOpportunity(oportunidad.uuid, datos)
        : await createOpportunity(datos)
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(oportunidad ? 'Oportunidad actualizada' : 'Oportunidad creada')
      onClose()
    })
  }

  return (
    <Modal
      title={oportunidad ? 'Editar oportunidad' : 'Nueva oportunidad'}
      ancho="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btnPrimary} disabled={pending || !borrador.title.trim()} onClick={guardar}>
            {oportunidad ? 'Guardar' : 'Crear'}
          </button>
        </>
      }>
      <div className="flex flex-col gap-3">
          <Field label="Título *">
            <TextField
              ariaLabel="Título"
              value={borrador.title}
              autoFocus={!oportunidad}
              onChange={(v) => setBorrador((b) => ({ ...b, title: v }))}
            />
          </Field>
          <Field label="Empresa / cliente">
            <TextField
              ariaLabel="Empresa o cliente"
              value={borrador.company}
              onChange={(v) => setBorrador((b) => ({ ...b, company: v }))}
            />
          </Field>
          <Field label="Contacto">
            <TextField
              ariaLabel="Contacto"
              value={borrador.contact}
              onChange={(v) => setBorrador((b) => ({ ...b, contact: v }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origen">
              <SelectField
                ariaLabel="Origen"
                value={borrador.origin}
                onChange={(v) => setBorrador((b) => ({ ...b, origin: v }))}
                options={[{ value: '', label: '—' }, ...ORIGENES.map((o) => ({ value: o, label: o }))]}
              />
            </Field>
            <Field label="Importe estimado (€)">
              <NumberField
                ariaLabel="Importe estimado"
                step={50}
                value={borrador.amount}
                onChange={(v) => setBorrador((b) => ({ ...b, amount: v }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Próxima acción">
              <TextField
                ariaLabel="Próxima acción"
                value={borrador.nextAction}
                onChange={(v) => setBorrador((b) => ({ ...b, nextAction: v }))}
              />
            </Field>
            <Field label="Fecha de seguimiento">
              <DateField
                ariaLabel="Fecha de seguimiento"
                value={borrador.nextActionDate}
                onChange={(v) => setBorrador((b) => ({ ...b, nextActionDate: v }))}
              />
            </Field>
          </div>
          <Field label="Notas">
            <TextareaField
              ariaLabel="Notas"
              value={borrador.notes}
              onChange={(v) => setBorrador((b) => ({ ...b, notes: v }))}
            />
          </Field>
        </div>

      {oportunidad && <Timeline uuid={oportunidad.uuid} />}
    </Modal>
  )
}

// ─────────── Timeline de actividad ───────────

function Timeline({ uuid }: { uuid: string }) {
  const [pending, startTransition] = useTransition()
  // null = cargando (se pide al abrir el detalle, no viaja con el tablero).
  const [eventos, setEventos] = useState<EventoRow[] | null>(null)
  const [tipo, setTipo] = useState('NOTA')
  const [detalle, setDetalle] = useState('')

  const cargar = () =>
    getOpportunityEvents(uuid).then((res) => {
      if (res.ok && res.events) setEventos(res.events)
      else toast.error(res.message ?? 'Error')
    })

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  const anadir = () => {
    if (!detalle.trim()) return
    startTransition(async () => {
      const res = await addOpportunityEvent(uuid, { type: tipo, detail: detalle })
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      setDetalle('')
      await cargar()
    })
  }

  const borrar = (eventoUuid: string) =>
    startTransition(async () => {
      const res = await deleteOpportunityEvent(eventoUuid)
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      await cargar()
    })

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="mb-2.5 text-sm font-bold">Actividad</h4>

      <div className="mb-3 flex gap-2">
        <SelectField
          ariaLabel="Tipo de actividad"
          className="w-30 shrink-0"
          value={tipo}
          onChange={setTipo}
          options={TIPOS_EVENTO}
        />
        <TextField
          ariaLabel="Detalle de la actividad"
          className="flex-1"
          placeholder="Qué ha pasado..."
          value={detalle}
          onChange={setDetalle}
          onEnter={anadir}
        />
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5')}
          disabled={pending || !detalle.trim()}
          aria-label="Añadir actividad"
          onClick={anadir}>
          <Plus className="size-4" />
        </button>
      </div>

      {eventos === null && <p className="py-2 text-xs text-muted-foreground">Cargando…</p>}
      {eventos !== null && eventos.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">Sin actividad todavía.</p>
      )}
      {eventos !== null && eventos.length > 0 && (
        <ul className="flex flex-col">
          {eventos.map((e) => {
            const Icono = ICONO_EVENTO[e.type] ?? StickyNote
            const deEstado = e.type === 'ESTADO'
            return (
              <li key={e.uuid} className="group flex items-start gap-2.5 border-l-2 border-border py-1.5 pl-3">
                <Icono className={cn('mt-0.5 size-3.5 shrink-0', deEstado ? 'text-primary' : 'text-muted-foreground')} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px] leading-snug', deEstado && 'font-medium')}>{e.detail}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtMomento(e.createTs)}</p>
                </div>
                {!deEstado && (
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-danger-bg hover:text-danger"
                    aria-label="Borrar apunte"
                    disabled={pending}
                    onClick={() => borrar(e.uuid)}>
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
