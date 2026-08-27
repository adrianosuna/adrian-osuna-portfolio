'use client'

// Pestañas del módulo de finanzas (Resumen + un tab por año) y el modal
// "Gestionar años": el ÚNICO sitio desde el que se crean años, se cambian
// sus objetivos, se renombran o se eliminan — lista con edición inline
// (patrón de ConceptList) y alta al pie.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileDown, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { NumberField } from '@/components/ui/fields'
import type { YearSummary } from '@/lib/finance'
import { createYear, deleteYear, updateYear } from '@/app/app/finance/actions'
import { BotonPrivado, MASCARA, useOculto } from './privado'
import { btnIcon, btnOutline, btnPrimary, eur } from './comun'

export function FinanzasTabs({ years, selected }: {
  years: YearSummary[]
  /** Año activo, o null si está abierta la pestaña Resumen. */
  selected: number | null
}) {
  const router = useRouter()
  const oculto = useOculto()
  const [pending, startTransition] = useTransition()
  const [abierto, setAbierto] = useState(false)
  // Fila en edición (uuid), confirmación de borrado (uuid) y borradores.
  const [editando, setEditando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [fila, setFila] = useState<{ year: number; goal: number | null }>({ year: 0, goal: null })
  const [nuevo, setNuevo] = useState<{ year: number | null; goal: number | null }>({ year: null, goal: null })

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const abrir = () => {
    setEditando(null)
    setConfirmando(null)
    setNuevo({ year: (years[years.length - 1]?.year ?? new Date().getFullYear() - 1) + 1, goal: null })
    setAbierto(true)
  }

  const guardarFila = (y: YearSummary) => {
    if (fila.year === null) return
    run(updateYear(y.uuid, { year: fila.year, goal: fila.goal }), 'Año actualizado', () => {
      setEditando(null)
      // Si se renombró el año activo, la URL vieja ya no existe: se sigue al nuevo.
      if (selected === y.year && fila.year !== y.year) router.push(`/app/finance?year=${fila.year}`)
    })
  }

  const eliminarFila = (y: YearSummary) => {
    setConfirmando(null)
    run(deleteYear(y.uuid), `Año ${y.year} eliminado`, () => {
      // Si era el año activo, su pestaña desaparece: al Resumen.
      if (selected === y.year) router.push('/app/finance')
    })
  }

  const crear = () => {
    if (nuevo.year === null) return
    run(createYear({ year: nuevo.year, goal: nuevo.goal }), `Año ${nuevo.year} creado`, () =>
      setNuevo((n) => ({ year: (n.year ?? new Date().getFullYear()) + 1, goal: null })),
    )
  }

  const tabClass = (activo: boolean) =>
    cn(
      'shrink-0 rounded-md px-3 py-1 text-sm font-semibold transition-colors',
      activo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Pestañas: Resumen + años (scroll horizontal si no caben) */}
      {/* overflow-y-hidden: que un píxel de más nunca haga scrollear en vertical */}
      <div className="flex max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-card/50 p-0.5">
        <button type="button" className={tabClass(selected === null)} onClick={() => router.push('/app/finance')}>
          Resumen
        </button>
        {years.map((y) => (
          <button
            key={y.uuid}
            type="button"
            className={tabClass(selected === y.year)}
            onClick={() => router.push(`/app/finance?year=${y.year}`)}>
            {y.year}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 gap-2">
        <BotonPrivado />
        <button type="button" className={cn(btnOutline, 'flex-1 sm:flex-none')} onClick={abrir}>
          <Settings2 className="size-4" /> Gestionar años
        </button>
      </div>

      {abierto && (
        <Modal
          title="Gestionar años"
          description="Los años, sus objetivos de ahorro y su borrado se gestionan solo desde aquí."
          onClose={() => setAbierto(false)}
          footer={
            <button type="button" className={btnOutline} onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          }>
          {years.length === 0 && (
            <p className="pb-2 text-sm text-muted-foreground">Todavía no hay años: crea el primero abajo.</p>
          )}

          {years.map((y) => (
            <div key={y.uuid} className="flex items-center justify-between gap-2 border-b border-border/60 py-2">
              {editando === y.uuid ? (
                <>
                  <div className="w-24 flex-none">
                    <NumberField
                      step={1}
                      compact
                      ariaLabel="Año"
                      value={fila.year}
                      onChange={(v) => setFila((f) => ({ ...f, year: v ?? f.year }))}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <NumberField
                      step={50}
                      compact
                      ariaLabel="Objetivo anual"
                      placeholder="Sin objetivo"
                      value={fila.goal}
                      onChange={(v) => setFila((f) => ({ ...f, goal: v }))}
                    />
                  </div>
                  <span className="flex flex-none gap-0.5">
                    <button type="button" className={btnIcon} disabled={pending} aria-label="Guardar" onClick={() => guardarFila(y)}>
                      <Check className="size-4 text-success" />
                    </button>
                    <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setEditando(null)}>
                      <X className="size-4" />
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-semibold">{y.year}</span>
                    <span className="ml-2.5 text-[13px] text-muted-foreground">
                      {/* El modal queda fuera del difuminado: se enmascara aquí */}
                      {y.goal !== null ? `Objetivo ${oculto ? MASCARA : eur(y.goal)}` : 'Sin objetivo'}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-0.5">
                    {/* Descarga del Excel del año (route handler protegido) */}
                    <a
                      className={btnIcon}
                      href={`/app/finance/exportar?year=${y.year}`}
                      title="Descargar Excel"
                      aria-label={`Descargar Excel de ${y.year}`}>
                      <FileDown className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      className={btnIcon}
                      aria-label={`Editar ${y.year}`}
                      onClick={() => {
                        setConfirmando(null)
                        setFila({ year: y.year, goal: y.goal })
                        setEditando(y.uuid)
                      }}>
                      <Pencil className="size-3.5" />
                    </button>
                    {confirmando === y.uuid ? (
                      <>
                        <button
                          type="button"
                          className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
                          disabled={pending}
                          onClick={() => eliminarFila(y)}>
                          Sí
                        </button>
                        <button type="button" className={btnIcon} aria-label="Cancelar" onClick={() => setConfirmando(null)}>
                          <X className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                        aria-label={`Eliminar ${y.year}`}
                        title="Eliminar el año con todo su detalle"
                        onClick={() => setConfirmando(y.uuid)}>
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Alta de un año nuevo */}
          <div className="mt-3">
            <p className="mb-1.5 text-[13px] text-muted-foreground">
              Nuevo año y su objetivo de ahorro (opcional)
            </p>
            <div className="flex gap-2">
              <div className="w-24 flex-none">
                <NumberField step={1} ariaLabel="Año nuevo" value={nuevo.year} onChange={(v) => setNuevo((n) => ({ ...n, year: v }))} />
              </div>
              <div className="min-w-0 flex-1">
                <NumberField
                  step={50}
                  ariaLabel="Objetivo del año nuevo"
                  placeholder="Sin objetivo"
                  value={nuevo.goal}
                  onChange={(v) => setNuevo((n) => ({ ...n, goal: v }))}
                  onEnter={crear}
                />
              </div>
              <button
                type="button"
                className={cn(btnPrimary, 'px-2.5')}
                disabled={pending || nuevo.year === null}
                aria-label="Añadir año"
                onClick={crear}>
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
