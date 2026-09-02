'use client'

// Accesos directos del inicio, elegidos por quien usa la app.
//
// Antes eran tres fijos (Finanzas, Oportunidades, Panel), que es el mapa de
// módulos, no lo que uno abre a diario: al final se entra siempre a Gastos del
// mes o a Mantenimiento, y había que pasar por el módulo. Aquí el catálogo está
// completo y se marca lo que se quiere ver; la elección es de este dispositivo
// (localStorage, ver `lib/preferencias.ts`) y por defecto quedan los tres de
// siempre, así que sin tocar nada el inicio se ve igual que antes.
import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight, Briefcase, Check, Euro, Gauge, PiggyBank, Receipt, Settings,
  SlidersHorizontal, StickyNote, TrendingUp, Users, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { usePreferencia } from '@/lib/preferencias'
import { btnOutline, btnPrimary } from '@/components/ui/botones'

interface Acceso {
  id: string
  title: string
  desc: string
  icon: React.ReactNode
  chip: string
  to: string
}

/** Los tres de siempre: lo que se ve sin haber configurado nada. */
const POR_DEFECTO = ['finanzas', 'pipeline', 'panel']

/** Catálogo completo. `mes` es el mes en curso, para el acceso a Gastos. */
function catalogo(mes: string): Acceso[] {
  return [
    { id: 'finanzas', title: 'Finanzas', desc: 'Ahorro anual y gastos', icon: <Euro className="size-4" />, chip: 'bg-primary/10 text-primary', to: '/app/finance' },
    { id: 'gastos', title: 'Gastos del mes', desc: 'Movimientos de este mes', icon: <Receipt className="size-4" />, chip: 'bg-success-bg text-success', to: `/app/finance?s=gastos&mes=${mes}` },
    { id: 'ahorro', title: 'Ahorro', desc: 'El año en curso y su objetivo', icon: <PiggyBank className="size-4" />, chip: 'bg-primary/10 text-primary', to: '/app/finance?s=ahorro' },
    { id: 'ajustes-finanzas', title: 'Ajustes de finanzas', desc: 'Categorías, recurrentes y años', icon: <Settings className="size-4" />, chip: 'bg-muted text-muted-foreground', to: '/app/finance?s=ajustes' },
    { id: 'pipeline', title: 'Oportunidades', desc: 'Pipeline y seguimientos', icon: <Briefcase className="size-4" />, chip: 'bg-warning-bg text-warning', to: '/app/pipeline' },
    { id: 'panel', title: 'Panel de control', desc: 'Servidor, visitas y usuarios', icon: <Gauge className="size-4" />, chip: 'bg-success-bg text-success', to: '/app/panel' },
    { id: 'mantenimiento', title: 'Mantenimiento', desc: 'Lo que caduca cada N meses', icon: <Wrench className="size-4" />, chip: 'bg-warning-bg text-warning', to: '/app/panel?tab=mantenimiento' },
    { id: 'notas', title: 'Notas', desc: 'Apuntes con formato', icon: <StickyNote className="size-4" />, chip: 'bg-muted text-muted-foreground', to: '/app/panel?tab=notas' },
    { id: 'visitas', title: 'Visitas', desc: 'Analítica del portfolio', icon: <TrendingUp className="size-4" />, chip: 'bg-primary/10 text-primary', to: '/app/panel?tab=visitas' },
    { id: 'usuarios', title: 'Usuarios', desc: 'Cuentas, sesiones y accesos', icon: <Users className="size-4" />, chip: 'bg-muted text-muted-foreground', to: '/app/panel?tab=usuarios' },
  ]
}

export function AccesosFijados({ mes, cardClass }: { mes: string; cardClass: string }) {
  const [fijados, setFijados] = usePreferencia<string[]>('accesos-fijados', POR_DEFECTO)
  const [editando, setEditando] = useState(false)
  const todos = catalogo(mes)

  // Se respeta el ORDEN en que se fijaron, no el del catálogo: quien pone
  // "Gastos del mes" primero lo quiere primero.
  const visibles = fijados
    .map((id) => todos.find((a) => a.id === id))
    .filter((a): a is Acceso => a !== undefined)

  const alternar = (id: string) =>
    setFijados(fijados.includes(id) ? fijados.filter((x) => x !== id) : [...fijados, id])

  return (
    <div className={cn(cardClass, 'px-4 py-3')}>
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <h2 className="text-[15px] font-semibold">Accesos</h2>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:px-2.5 max-sm:py-2.5"
          onClick={() => setEditando(true)}>
          <SlidersHorizontal className="size-3.5" />
          Elegir
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="py-4 text-[13px] text-muted-foreground">
          Sin accesos fijados. Pulsa «Elegir» y marca los que uses a diario.
        </p>
      ) : (
        visibles.map((a, i) => (
          <Link
            key={a.id}
            href={a.to}
            className={cn(
              'group flex items-center gap-3 py-2.5',
              i < visibles.length - 1 && 'border-b border-border/60',
            )}>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-md', a.chip)}>
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="truncate text-[12px] text-muted-foreground">{a.desc}</p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
        ))
      )}

      {editando && (
        <Modal
          title="Accesos del inicio"
          description="Se guardan en este navegador."
          onClose={() => setEditando(false)}
          footer={
            <>
              <button
                type="button"
                className={btnOutline}
                onClick={() => setFijados(POR_DEFECTO)}>
                Por defecto
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setEditando(false)}>
                Listo
              </button>
            </>
          }>
          <div className="flex flex-col gap-1">
            {todos.map((a) => {
              const puesto = fijados.indexOf(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                    puesto >= 0 ? 'bg-primary/10' : 'hover:bg-muted/60',
                  )}
                  aria-pressed={puesto >= 0}
                  onClick={() => alternar(a.id)}>
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', a.chip)}>
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{a.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{a.desc}</span>
                  </span>
                  {puesto >= 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-primary">
                      {/* El número dice en qué orden va a salir. */}
                      <span className="text-[11px] font-bold tabular-nums">{puesto + 1}</span>
                      <Check className="size-4" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
