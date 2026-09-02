'use client'

// Acciones rápidas GLOBALES del dashboard, disponibles desde cualquier página:
//
//   · Paleta de comandos (⌘K / Ctrl+K): navegar, lanzar acciones y BUSCAR en
//     todo (movimientos, oportunidades y notas) sin salir del teclado.
//   · Alta rápida de movimiento: apuntar un gasto/ingreso sin ir a Finanzas —
//     la fricción de registrarlo es lo que hace que se deje de registrar.
//   · Atajos globales: `g` + letra para saltar de módulo, `n` para apuntar un
//     movimiento, `/` para la paleta y `?` para ver la lista.
//
// Todo cuelga del layout (envuelve top-nav y contenido) y se dispara desde los
// botones de la barra superior (`useAcciones`) o el teclado. Personales del
// admin: a un invitado la paleta solo le ofrece Inicio y el portfolio.
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Briefcase, CornerDownLeft, Euro, ExternalLink, Gauge, Home, Keyboard, PiggyBank,
  Plus, Receipt, Search, Settings, StickyNote, TrendingUp, Users, Wrench,
} from 'lucide-react'
import { cn, sinAcentos } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import {
  DateField, Field, NumberField, SelectField, TextareaField, TextField,
} from '@/components/ui/fields'
import { useCarga } from '@/components/dashboard/barra-carga'
import { btnOutline, btnPrimary, TIPOS } from '@/components/dashboard/savings/comun'
import { categoriasParaAlta, createGasto } from '@/app/app/finance/gastos-actions'
import { buscarGlobal } from '@/app/app/buscar-actions'
import { MINIMO_BUSQUEDA, type ResultadoGlobal } from '@/lib/buscar'
import type { CategoriaRow, TipoMovimiento } from '@/lib/gastos'
import { MESES } from '@/lib/fechas'
import { eur } from '@/lib/euros'

interface Acciones {
  isAdmin: boolean
  /** Abre la alta rápida de movimiento (por defecto un gasto). */
  abrirAlta: (tipo?: TipoMovimiento) => void
  /** Abre la paleta de comandos. */
  abrirPaleta: () => void
  /** Abre la chuleta de atajos de teclado. */
  abrirAtajos: () => void
}

const Ctx = createContext<Acciones>({
  isAdmin: false, abrirAlta: () => {}, abrirPaleta: () => {}, abrirAtajos: () => {},
})

/** Botones de la barra superior que disparan la paleta y la alta rápida. */
export const useAcciones = () => useContext(Ctx)

/** ¿El foco está escribiendo? (entonces las teclas sueltas no son atajos) */
const escribiendo = () => {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

export function AccionesRapidasProvider({
  isAdmin, hoy, children,
}: {
  isAdmin: boolean
  hoy: string // 'YYYY-MM-DD' (Madrid), para la fecha por defecto del alta
  children: React.ReactNode
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const [paleta, setPaleta] = useState(false)
  const [atajos, setAtajos] = useState(false)
  const [alta, setAlta] = useState<TipoMovimiento | null>(null)
  // Primera tecla de una secuencia tipo `g` + letra (vive en un ref: no pinta nada).
  const prefijo = useRef<string | null>(null)
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null)

  const abrirAlta = useCallback(
    (tipo: TipoMovimiento = 'GASTO') => {
      if (isAdmin) setAlta(tipo)
    },
    [isAdmin],
  )

  const ir = useCallback(
    (url: string) => {
      iniciar()
      router.push(url)
    },
    [iniciar, router],
  )

  // Atajos globales. Se ignoran mientras se escribe (salvo ⌘K, que es la vía de
  // entrada desde cualquier campo) para no secuestrar teclas de un formulario.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaleta((o) => !o)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || escribiendo()) return

      // Segunda tecla de una secuencia `g` + letra.
      if (prefijo.current === 'g') {
        prefijo.current = null
        const destinos: Record<string, string> = {
          i: '/app',
          f: '/app/finance',
          a: '/app/finance?s=ahorro',
          g: `/app/finance?s=gastos&mes=${hoy.slice(0, 7)}`,
          o: '/app/pipeline',
          p: '/app/panel',
          n: '/app/panel?tab=notas',
          m: '/app/panel?tab=mantenimiento',
        }
        const destino = destinos[e.key.toLowerCase()]
        if (destino && (isAdmin || destino === '/app')) {
          e.preventDefault()
          ir(destino)
        }
        return
      }

      if (e.key === 'g') {
        prefijo.current = 'g'
        // La secuencia caduca: una `g` suelta no debe capturar la tecla siguiente.
        if (tempo.current) clearTimeout(tempo.current)
        tempo.current = setTimeout(() => {
          prefijo.current = null
        }, 1200)
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        setPaleta(true)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setAtajos(true)
        return
      }
      if (e.key === 'n' && isAdmin) {
        e.preventDefault()
        setAlta('GASTO')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (tempo.current) clearTimeout(tempo.current)
    }
  }, [hoy, isAdmin, ir])

  return (
    <Ctx.Provider
      value={{
        isAdmin,
        abrirAlta,
        abrirPaleta: () => setPaleta(true),
        abrirAtajos: () => setAtajos(true),
      }}>
      {children}
      {paleta && (
        <PaletaComandos
          isAdmin={isAdmin}
          hoy={hoy}
          onCerrar={() => setPaleta(false)}
          onAlta={abrirAlta}
          onAtajos={() => {
            setPaleta(false)
            setAtajos(true)
          }}
        />
      )}
      {atajos && <ChuletaAtajos isAdmin={isAdmin} onCerrar={() => setAtajos(false)} />}
      {alta && <AltaRapida tipoInicial={alta} hoy={hoy} onCerrar={() => setAlta(null)} />}
    </Ctx.Provider>
  )
}

// ─────────── paleta de comandos (⌘K) ───────────

interface Comando {
  id: string
  /** Etiqueta corta del grupo, a la derecha ("Ir a" / "Crear" / "Nota"…). */
  grupo: string
  label: string
  /** Segunda línea (importe y fecha de un movimiento, empresa…). */
  detalle?: string
  /** Sinónimos para que la búsqueda lo encuentre (no se muestran). */
  keywords?: string
  icon: React.ReactNode
  run: () => void
}

/**
 * Interpreta un mes escrito a mano: '2026-03', 'marzo', 'marzo 2026', 'mar'.
 * Devuelve 'YYYY-MM' o null. Sin año, el del "hoy" que se le pase.
 */
export function mesEscrito(texto: string, hoyIso: string): string | null {
  const t = sinAcentos(texto.trim())
  if (!t) return null
  const iso = t.match(/^(\d{4})-(\d{1,2})$/)
  if (iso) {
    const m = Number(iso[2])
    return m >= 1 && m <= 12 ? `${iso[1]}-${String(m).padStart(2, '0')}` : null
  }
  // Nombre de mes (o sus tres primeras letras) con año opcional.
  const partes = t.match(/^([a-z]+)\s*(\d{4})?$/)
  if (!partes) return null
  const nombre = partes[1]
  if (nombre.length < 3) return null
  const i = MESES.findIndex((m) => sinAcentos(m).startsWith(nombre))
  if (i < 0) return null
  const año = partes[2] ?? hoyIso.slice(0, 4)
  return `${año}-${String(i + 1).padStart(2, '0')}`
}

function PaletaComandos({
  isAdmin, hoy, onCerrar, onAlta, onAtajos,
}: {
  isAdmin: boolean
  hoy: string
  onCerrar: () => void
  onAlta: (tipo?: TipoMovimiento) => void
  onAtajos: () => void
}) {
  const router = useRouter()
  const iniciar = useCarga()
  const [q, setQ] = useState('')
  // Resultados de la búsqueda global, con la consulta a la que corresponden
  // (así "buscando" se DERIVA en vez de vivir en otro estado, que obligaría a
  // un setState síncrono dentro del efecto).
  const [resultados, setResultados] = useState<{ q: string; datos: ResultadoGlobal } | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Navegar cierra la paleta y enciende la barra de carga (los comandos usan
  // router.push, no <a>).
  const nav = (url: string) => () => {
    onCerrar()
    iniciar()
    router.push(url)
  }
  const mes = hoy.slice(0, 7)
  const texto = q.trim()

  // Búsqueda global con freno: no se consulta en cada tecla ni con una letra.
  useEffect(() => {
    if (texto.length < MINIMO_BUSQUEDA) return
    const id = setTimeout(() => {
      buscarGlobal(texto).then((datos) => setResultados({ q: texto, datos }))
    }, 250)
    return () => clearTimeout(id)
  }, [texto])

  const buscando = texto.length >= MINIMO_BUSQUEDA && resultados?.q !== texto
  const encontrado = resultados?.q === texto ? resultados.datos : null

  const comandos: Comando[] = [
    { id: 'inicio', grupo: 'Ir a', label: 'Inicio', icon: <Home />, run: nav('/app') },
    ...(isAdmin
      ? [
          { id: 'nuevo-gasto', grupo: 'Crear', label: 'Nuevo gasto', keywords: 'añadir apuntar movimiento', icon: <Plus />, run: () => { onCerrar(); onAlta('GASTO') } },
          { id: 'nuevo-ingreso', grupo: 'Crear', label: 'Nuevo ingreso', keywords: 'añadir apuntar movimiento', icon: <Plus />, run: () => { onCerrar(); onAlta('INGRESO') } },
          { id: 'nueva-nota', grupo: 'Crear', label: 'Nueva nota', keywords: 'apunte', icon: <StickyNote />, run: nav('/app/panel?tab=notas&nueva=1') },
          { id: 'nueva-oportunidad', grupo: 'Crear', label: 'Nueva oportunidad', keywords: 'pipeline cliente', icon: <Briefcase />, run: nav('/app/pipeline?nueva=1') },
          { id: 'fin-panel', grupo: 'Ir a', label: 'Finanzas · Panel', keywords: 'dinero ahorro', icon: <Euro />, run: nav('/app/finance') },
          { id: 'fin-ahorro', grupo: 'Ir a', label: 'Finanzas · Ahorro', keywords: 'anual objetivo', icon: <PiggyBank />, run: nav('/app/finance?s=ahorro') },
          { id: 'fin-gastos', grupo: 'Ir a', label: 'Finanzas · Gastos', keywords: 'movimientos ingresos control', icon: <Receipt />, run: nav(`/app/finance?s=gastos&mes=${mes}`) },
          { id: 'fin-buscar', grupo: 'Ir a', label: 'Buscar movimientos', keywords: 'gastos ingresos histórico filtro', icon: <Search />, run: nav('/app/finance?s=gastos&buscar=1') },
          { id: 'fin-ajustes', grupo: 'Ir a', label: 'Finanzas · Ajustes', keywords: 'categorias recurrentes años topes', icon: <Settings />, run: nav('/app/finance?s=ajustes') },
          { id: 'pipeline', grupo: 'Ir a', label: 'Oportunidades', keywords: 'pipeline seguimientos clientes', icon: <Briefcase />, run: nav('/app/pipeline') },
          { id: 'panel', grupo: 'Ir a', label: 'Panel · Servidor', keywords: 'monitor infraestructura salud', icon: <Gauge />, run: nav('/app/panel') },
          { id: 'panel-visitas', grupo: 'Ir a', label: 'Panel · Visitas', keywords: 'analitica ga', icon: <TrendingUp />, run: nav('/app/panel?tab=visitas') },
          { id: 'panel-usuarios', grupo: 'Ir a', label: 'Panel · Usuarios', keywords: 'sesiones cuentas accesos', icon: <Users />, run: nav('/app/panel?tab=usuarios') },
          { id: 'panel-mant', grupo: 'Ir a', label: 'Panel · Mantenimiento', keywords: 'itv seguro caldera tareas', icon: <Wrench />, run: nav('/app/panel?tab=mantenimiento') },
          { id: 'panel-notas', grupo: 'Ir a', label: 'Panel · Notas', keywords: 'apuntes', icon: <StickyNote />, run: nav('/app/panel?tab=notas') },
        ]
      : []),
    { id: 'portfolio', grupo: 'Ir a', label: 'Ver portfolio público', keywords: 'landing web inicio', icon: <ExternalLink />, run: nav('/') },
    { id: 'atajos', grupo: 'Ayuda', label: 'Atajos de teclado', keywords: 'teclas ayuda', icon: <Keyboard />, run: onAtajos },
  ]

  const filtro = sinAcentos(texto)
  const estaticos = filtro
    ? comandos.filter((c) => sinAcentos(`${c.label} ${c.grupo} ${c.keywords ?? ''}`).includes(filtro))
    : comandos

  // Un mes escrito a mano ("marzo", "2026-03") abre sus gastos directamente.
  const mesPedido = isAdmin ? mesEscrito(texto, hoy) : null
  const dinamicos: Comando[] = []
  if (mesPedido) {
    const [y, m] = mesPedido.split('-')
    dinamicos.push({
      id: `mes-${mesPedido}`,
      grupo: 'Ir a',
      label: `Gastos de ${MESES[Number(m) - 1]} ${y}`,
      icon: <Receipt />,
      run: nav(`/app/finance?s=gastos&mes=${mesPedido}`),
    })
  }

  // Resultados de la búsqueda global, ya como comandos.
  const deBusqueda: Comando[] = encontrado
    ? [
        ...encontrado.movimientos.map((m) => ({
          id: `mov-${m.uuid}`,
          grupo: 'Movimiento',
          label: m.concepto,
          detalle: `${m.esGasto ? '−' : '+'}${eur(m.importe)} · ${m.fecha.split('-').reverse().join('/')}`,
          icon: <Receipt />,
          run: nav(`/app/finance?s=gastos&mes=${m.fecha.slice(0, 7)}`),
        })),
        ...encontrado.oportunidades.map((o) => ({
          id: `opo-${o.uuid}`,
          grupo: 'Oportunidad',
          label: o.titulo,
          detalle: o.empresa ?? undefined,
          icon: <Briefcase />,
          // Se abre su ficha directamente (el pipeline entiende `?abrir=`).
          run: nav(`/app/pipeline?abrir=${o.uuid}`),
        })),
        ...encontrado.notas.map((n) => ({
          id: `nota-${n.uuid}`,
          grupo: 'Nota',
          label: n.titulo,
          icon: <StickyNote />,
          run: nav(`/app/panel?tab=notas&abrir=${n.uuid}`),
        })),
      ]
    : []

  const visibles = [...dinamicos, ...estaticos, ...deBusqueda]

  const [activo, setActivo] = useState(0)
  // Reinicia la selección al cambiar lo que se ve (patrón valor-previo en render).
  const clave = `${filtro}|${visibles.length}`
  const [prevClave, setPrevClave] = useState(clave)
  if (prevClave !== clave) {
    setPrevClave(clave)
    setActivo(0)
  }
  // Índice efectivo, acotado por si la lista encoge sin haber cambiado `activo`.
  const idx = Math.min(activo, Math.max(0, visibles.length - 1))

  // Mantener a la vista el elemento activo al moverse con el teclado.
  useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  // Escape a nivel de documento: el `onKeyDown` del campo solo cierra mientras
  // el foco siga ahí, y en cuanto se pulsa un resultado con el ratón deja de
  // estar. En captura, para adelantarse a cualquier otro manejador.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
      }
    }
    document.addEventListener('keydown', onEsc, true)
    return () => document.removeEventListener('keydown', onEsc, true)
  }, [onCerrar])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      visibles[idx]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCerrar()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="relative flex max-h-[70dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar o ir a…"
            aria-label="Buscar comando, sección o contenido"
            className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">
            Esc
          </kbd>
        </div>
        <div ref={listaRef} className="overflow-y-auto p-1.5">
          {visibles.length === 0 && !buscando ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada coincide</p>
          ) : (
            visibles.map((c, i) => (
              <button
                key={c.id}
                type="button"
                data-idx={i}
                // El ratón resalta lo que sobrevuela; el teclado, lo que recorre.
                onMouseMove={() => setActivo(i)}
                onClick={() => c.run()}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  i === idx ? 'bg-primary/10' : 'hover:bg-muted/60',
                )}>
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4',
                    i === idx ? 'text-primary' : 'text-muted-foreground',
                  )}>
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.label}</span>
                  {c.detalle && (
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {c.detalle}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{c.grupo}</span>
                {i === idx && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            ))
          )}
          {buscando && (
            <p className="px-3 py-3 text-center text-[12.5px] text-muted-foreground">
              Buscando en movimientos, oportunidades y notas…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────── chuleta de atajos ───────────

/** Atajos globales, tal y como los lee el listener del provider. */
const ATAJOS: Array<{ teclas: string[]; que: string; soloAdmin?: boolean }> = [
  { teclas: ['Ctrl', 'K'], que: 'Abrir la paleta (buscar e ir a)' },
  { teclas: ['/'], que: 'Abrir la paleta' },
  { teclas: ['?'], que: 'Ver esta lista' },
  { teclas: ['n'], que: 'Apuntar un movimiento', soloAdmin: true },
  { teclas: ['g', 'i'], que: 'Ir al inicio' },
  { teclas: ['g', 'f'], que: 'Ir a Finanzas', soloAdmin: true },
  { teclas: ['g', 'a'], que: 'Ir a Ahorro', soloAdmin: true },
  { teclas: ['g', 'g'], que: 'Ir a Gastos', soloAdmin: true },
  { teclas: ['g', 'o'], que: 'Ir a Oportunidades', soloAdmin: true },
  { teclas: ['g', 'p'], que: 'Ir al Panel de control', soloAdmin: true },
  { teclas: ['g', 'm'], que: 'Ir a Mantenimiento', soloAdmin: true },
  { teclas: ['g', 'n'], que: 'Ir a Notas', soloAdmin: true },
]

function ChuletaAtajos({ isAdmin, onCerrar }: { isAdmin: boolean; onCerrar: () => void }) {
  return (
    <Modal
      title="Atajos de teclado"
      description="Las teclas sueltas no actúan mientras escribes en un campo."
      onClose={onCerrar}
      footer={
        <button type="button" className={btnPrimary} onClick={onCerrar}>
          Entendido
        </button>
      }>
      <ul className="flex flex-col gap-1.5">
        {ATAJOS.filter((a) => isAdmin || !a.soloAdmin).map((a) => (
          <li key={a.teclas.join('+')} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1">{a.que}</span>
            <span className="flex shrink-0 items-center gap-1">
              {a.teclas.map((t, i) => (
                <span key={t + i} className="flex items-center gap-1">
                  {/* `g` + letra es una SECUENCIA, no una combinación: se pulsan
                      una después de otra, y así se lee. */}
                  {i > 0 && a.teclas[0] === 'g' && (
                    <span className="text-[11px] text-muted-foreground">luego</span>
                  )}
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
                    {t}
                  </kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// ─────────── alta rápida de movimiento ───────────

function AltaRapida({
  tipoInicial, hoy, onCerrar,
}: {
  tipoInicial: TipoMovimiento
  hoy: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // null mientras cargan (se piden al abrir, no en cada render del layout).
  const [categorias, setCategorias] = useState<CategoriaRow[] | null>(null)
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial)
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(hoy)
  const [cat, setCat] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let vivo = true
    categoriasParaAlta().then((c) => {
      if (vivo) setCategorias(c)
    })
    return () => {
      vivo = false
    }
  }, [])

  // Las categorías se ofrecen según el tipo (un ingreso no lleva "Supermercado").
  const opcionesCat = (t: TipoMovimiento) => [
    { value: '', label: 'Sin categoría' },
    ...(categorias ?? []).filter((c) => c.type === t).map((c) => ({ value: c.uuid, label: c.name })),
  ]

  const crear = () => {
    if (!concept.trim() || amount === null) return
    startTransition(async () => {
      const res = await createGasto({
        type: tipo,
        concept,
        amount,
        expenseDate: date,
        categoryUuid: cat || null,
        note,
      })
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(tipo === 'GASTO' ? 'Gasto añadido' : 'Ingreso añadido')
      // Refresca la página actual para que el alta se note ya (KPI del inicio…).
      router.refresh()
      onCerrar()
    })
  }

  return (
    <Modal
      title="Nuevo movimiento"
      description="Se apunta en el control de gastos."
      onClose={onCerrar}
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={pending || !concept.trim() || amount === null}
            onClick={crear}>
            <Plus className="size-4" />
            Añadir {tipo === 'GASTO' ? 'gasto' : 'ingreso'}
          </button>
        </>
      }>
      <div className="flex flex-col gap-3">
        {/* Tipo: segmentado (es binario) */}
        <div className="flex gap-1 rounded-lg border border-border bg-card/50 p-0.5">
          {TIPOS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={cn(
                'flex-1 rounded-md py-2 text-sm font-semibold transition-colors',
                tipo === t.value
                  ? t.value === 'GASTO'
                    ? 'bg-danger-bg text-danger'
                    : 'bg-success-bg text-success'
                  : 'text-muted-foreground',
              )}
              onClick={() => {
                setTipo(t.value)
                setCat('')
              }}>
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Concepto">
          <TextField value={concept} onChange={setConcept} placeholder="Concepto" autoFocus onEnter={crear} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe">
            <NumberField value={amount} onChange={setAmount} step={5} placeholder="Importe" onEnter={crear} />
          </Field>
          <Field label="Fecha">
            <DateField value={date} onChange={setDate} ariaLabel="Fecha del movimiento" />
          </Field>
        </div>
        <Field label="Categoría">
          <SelectField value={cat} onChange={setCat} options={opcionesCat(tipo)} ariaLabel="Categoría del movimiento" />
        </Field>
        <Field label="Nota">
          <TextareaField value={note} onChange={setNote} ariaLabel="Nota del movimiento" />
        </Field>
      </div>
    </Modal>
  )
}
