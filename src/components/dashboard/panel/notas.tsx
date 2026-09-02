'use client'

// Pestaña "Notas" del Panel de control: apuntes propios del admin con formato.
// Se editan en un editor VISUAL (contentEditable, tipo Word: siempre se ve el
// formato) y se guardan como HTML. Ese HTML se SANEA en el servidor antes de
// guardarlo (`lib/sanitizar-html.ts`), así que pintarlo con dangerouslySetInnerHTML
// —tanto en el editor como en las tarjetas— es seguro.
//
// Sobre eso, dos cosas que aparecen cuando las notas pasan de diez: buscador
// (título y texto) y fijar las importantes para que no se hundan. Y listas de
// TAREAS marcables, que se marcan desde la propia tarjeta sin abrir el editor.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import {
  Bold, Heading, Italic, Link2, List, ListChecks, ListOrdered, Pin, Plus, Search,
  Trash2, Underline, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, sinAcentos } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { TextField } from '@/components/ui/fields'
import {
  createNote, deleteNote, pinNote, restaurarNota, toggleNotaTarea, updateNote,
} from '@/app/app/panel/actions'
import { borrarConDeshacer } from '@/components/dashboard/deshacer'
import type { NotaRow } from '@/lib/notas'
import { btnIcon, btnOutline, btnPrimary } from '@/components/ui/botones'


/** Fecha de edición en relativo corto ("hace 3 h", "ayer", "12/08"). */
function cuando(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d} días`
  return iso.slice(8, 10) + '/' + iso.slice(5, 7)
}

/** Ancho en píxeles de la casilla de una tarea (padding-left del `li` en CSS).
 *  Dentro del editor solo se alterna pulsando AHÍ: en el resto del `li` el
 *  clic tiene que poder colocar el cursor para escribir. */
const ZONA_CASILLA = 26

export function NotasTab({
  rows, abrirUuid, nueva,
}: {
  rows: NotaRow[]
  /** Nota a abrir al entrar (`?abrir=`): lo usa la búsqueda de la paleta ⌘K. */
  abrirUuid?: string
  /** Abrir el editor en blanco al entrar (`?nueva=1`). */
  nueva?: boolean
}) {
  const [pending, startTransition] = useTransition()
  // null = cerrado · 'nueva' = alta · uuid = edición. Puede venir abierto desde
  // la URL: la paleta enlaza a una nota concreta o al alta.
  const [modal, setModal] = useState<string | null>(() => {
    if (nueva) return 'nueva'
    return abrirUuid && rows.some((n) => n.uuid === abrirUuid) ? abrirUuid : null
  })
  const [titulo, setTitulo] = useState(() => {
    if (nueva || !abrirUuid) return ''
    return rows.find((n) => n.uuid === abrirUuid)?.title ?? ''
  })
  const [hayTexto, setHayTexto] = useState(
    () => !nueva && Boolean(abrirUuid && rows.find((n) => n.uuid === abrirUuid)?.texto),
  )
  const editorRef = useRef<HTMLDivElement>(null)
  // HTML con el que se siembra el editor al abrir. Solo cambia al abrir otra
  // nota, así que durante la edición el prop no cambia y React no repisa lo que
  // se escribe (el DOM del contentEditable diverge, pero el `__html` es el mismo).
  const [htmlInicial, setHtmlInicial] = useState(
    () => (nueva || !abrirUuid ? '' : (rows.find((n) => n.uuid === abrirUuid)?.content ?? '')),
  )
  // Qué formato está activo en la selección (para marcar sus botones, como Word).
  const [activos, setActivos] = useState<Record<string, boolean>>({})
  // Filtro de la lista
  const [busqueda, setBusqueda] = useState('')

  // La `<ul>` que contiene la selección, si está dentro del editor.
  // En useCallback (igual que `sincronizarActivos`): las dos son estables —solo
  // tocan refs y setState— y así el efecto que escucha la selección puede
  // declararlas como dependencia sin resuscribirse en cada render.
  const ulDeSeleccion = useCallback((): HTMLUListElement | null => {
    const nodo = document.getSelection()?.anchorNode
    if (!nodo || !editorRef.current?.contains(nodo)) return null
    const el = nodo.nodeType === 1 ? (nodo as Element) : nodo.parentElement
    const ul = el?.closest('ul')
    return ul && editorRef.current.contains(ul) ? (ul as HTMLUListElement) : null
  }, [])

  // Lee del navegador qué comandos están activos donde está el cursor. Solo si
  // la selección está dentro del editor (si no, no hay nada que marcar).
  const sincronizarActivos = useCallback(() => {
    const sel = document.getSelection()
    if (!editorRef.current || !sel || !editorRef.current.contains(sel.anchorNode)) return
    const on = (c: string) => {
      try {
        return document.queryCommandState(c)
      } catch {
        return false
      }
    }
    let bloque = ''
    try {
      bloque = String(document.queryCommandValue('formatBlock')).toLowerCase()
    } catch {
      bloque = ''
    }
    const ul = ulDeSeleccion()
    const esTareas = Boolean(ul?.classList.contains('tareas'))
    setActivos({
      bold: on('bold'),
      italic: on('italic'),
      underline: on('underline'),
      // La lista de puntos no se marca si en realidad es una lista de tareas.
      insertUnorderedList: on('insertUnorderedList') && !esTareas,
      insertOrderedList: on('insertOrderedList'),
      tareas: esTareas,
      h3: bloque === 'h3',
    })
  }, [ulDeSeleccion])

  // Mientras el editor está abierto, seguir la selección para refrescar los
  // botones activos (mover el cursor, escribir o seleccionar dispara este evento).
  useEffect(() => {
    if (!modal) return
    // Formato por ETIQUETAS (`<b>`, `<i>`...), no por CSS: algunos navegadores
    // emiten `<span style="font-weight:bold">` y el saneador tira `style` (por
    // seguridad), con lo que el formato se perdería al guardar. `false` fuerza
    // la salida por etiquetas, que sí sobrevive a la allowlist.
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      // Algún navegador puede no soportarlo: el formato por etiquetas es el
      // comportamiento por defecto de todas formas.
    }
    const onSel = () => sincronizarActivos()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [modal, sincronizarActivos])

  const run = (promise: Promise<{ ok: boolean; message?: string }>, success?: string) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      if (success) toast.success(success)
      setModal(null)
    })

  const abrir = (nota?: NotaRow) => {
    setTitulo(nota?.title ?? '')
    setHtmlInicial(nota?.content ?? '')
    setHayTexto(Boolean(nota && nota.texto))
    setActivos({}) // sin arrastrar el estado de la nota anterior
    setModal(nota ? nota.uuid : 'nueva')
  }

  const guardar = () => {
    const datos = { title: titulo, content: editorRef.current?.innerHTML ?? '' }
    if (modal === 'nueva') run(createNote(datos), 'Nota creada')
    else if (modal) run(updateNote(modal, datos), 'Nota guardada')
  }

  // Aplica un comando de formato a la selección del editor. `onMouseDown` con
  // preventDefault en el botón evita que el clic robe el foco/selección.
  const formato = (comando: string, valor?: string) => {
    editorRef.current?.focus()
    document.execCommand(comando, false, valor)
    setHayTexto(Boolean(editorRef.current?.textContent?.trim()))
    sincronizarActivos()
  }
  const enlazar = () => {
    const url = window.prompt('URL del enlace:', 'https://')
    if (url) formato('createLink', url)
  }

  /** Convierte la lista de la selección en lista de TAREAS (o la devuelve a
   *  lista normal). Si no hay lista, la crea primero. */
  const listaTareas = () => {
    editorRef.current?.focus()
    let ul = ulDeSeleccion()
    if (!ul) {
      document.execCommand('insertUnorderedList')
      ul = ulDeSeleccion()
    }
    if (!ul) return
    if (ul.classList.contains('tareas')) {
      ul.classList.remove('tareas')
      ul.querySelectorAll('li[data-check]').forEach((li) => li.removeAttribute('data-check'))
    } else {
      ul.classList.add('tareas')
      marcarPendientes()
    }
    setHayTexto(Boolean(editorRef.current?.textContent?.trim()))
    sincronizarActivos()
  }

  /** Todo `li` de una lista de tareas necesita su `data-check`: al pulsar Enter
   *  el navegador crea el `li` nuevo sin él y se quedaría sin casilla. */
  const marcarPendientes = () => {
    editorRef.current?.querySelectorAll('ul.tareas > li:not([data-check])').forEach((li) => {
      li.setAttribute('data-check', '0')
    })
  }

  // Ctrl/Cmd+A: seleccionar SOLO el contenido del editor (no la página) para
  // que el formato se aplique a todo de forma fiable en cualquier navegador.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && editorRef.current) {
      e.preventDefault()
      const rango = document.createRange()
      rango.selectNodeContents(editorRef.current)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(rango)
      sincronizarActivos()
    }
  }

  // Clic en el editor: si cae en la casilla de una tarea, la alterna en el DOM
  // (se guarda con la nota). Fuera de la casilla, el clic hace lo normal.
  const onClickEditor = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest('li[data-check]')
    if (!li || !editorRef.current?.contains(li)) return
    if (e.clientX - li.getBoundingClientRect().left > ZONA_CASILLA) return
    e.preventDefault()
    li.setAttribute('data-check', li.getAttribute('data-check') === '1' ? '0' : '1')
  }

  const editando = modal !== 'nueva' ? rows.find((n) => n.uuid === modal) : undefined

  // ── Filtrado (buscador) ──
  // Busca en el título y en el TEXTO plano del contenido, no en el HTML
  // ("strong" no es una palabra de la nota).
  const q = sinAcentos(busqueda.trim())
  const visibles = q
    ? rows.filter((n) => sinAcentos(`${n.title ?? ''} ${n.texto}`).includes(q))
    : rows

  return (
    <div>
      {/* Buscador + alta */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 transition-colors focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar en las notas"
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          {busqueda && (
            <button
              type="button"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpiar la búsqueda"
              onClick={() => setBusqueda('')}>
              <X className="size-4" />
            </button>
          )}
        </div>
        <button type="button" className={cn(btnPrimary, 'max-sm:w-full')} onClick={() => abrir()}>
          <Plus className="size-4" />
          Nueva nota
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-semibold">Aún no hay notas</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            Un sitio para apuntar lo que no cabe en una tarea de mantenimiento: ideas, comandos,
            recordatorios.
          </p>
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Ninguna nota coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((n) => (
            // NO es un <button>: la tarjeta pinta el HTML de la nota (bloques y
            // enlaces), que dentro de un botón sería anidamiento inválido (React
            // avisa) y haría que un enlace disparara enlace + editor a la vez.
            // Div con role/teclado, y el preview con pointer-events-none para
            // que el clic —salvo en las casillas— siempre abra el editor.
            <div
              key={n.uuid}
              role="button"
              tabIndex={0}
              onClick={() => abrir(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  abrir(n)
                }
              }}
              className={cn(
                'relative flex cursor-pointer flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 focus:border-primary focus:outline-none',
                n.pinned ? 'border-primary/40' : 'border-border',
              )}>
              {/* Fijar: encima de la tarjeta, y para el clic para no abrirla */}
              <button
                type="button"
                className={cn(
                  'absolute right-2 top-2 rounded-md p-1.5 transition-colors',
                  n.pinned
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label={n.pinned ? 'Soltar la nota' : 'Fijar la nota arriba'}
                aria-pressed={n.pinned}
                title={n.pinned ? 'Soltar' : 'Fijar arriba'}
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation()
                  startTransition(async () => {
                    const res = await pinNote(n.uuid, !n.pinned)
                    if (!res.ok) toast.error(res.message ?? 'Error')
                  })
                }}>
                <Pin className={cn('size-3.5', n.pinned && 'fill-current')} />
              </button>

              {n.title && <p className="mb-1 truncate pr-8 font-semibold">{n.title}</p>}
              <div
                // `tareas-pulsables` reactiva el puntero SOLO en los ítems de
                // tarea: se marcan desde aquí, sin abrir el editor.
                className="contenido-nota tareas-pulsables pointer-events-none line-clamp-4 text-muted-foreground"
                onClick={(e) => {
                  const li = (e.target as HTMLElement).closest('li[data-check]')
                  if (!li) return
                  // No abrir el editor: este clic era para marcar la tarea.
                  e.stopPropagation()
                  const items = [...e.currentTarget.querySelectorAll('li[data-check]')]
                  const indice = items.indexOf(li)
                  if (indice < 0) return
                  startTransition(async () => {
                    const res = await toggleNotaTarea(n.uuid, indice)
                    if (!res.ok) toast.error(res.message ?? 'Error')
                  })
                }}
                // Contenido ya saneado en el servidor al guardarse.
                dangerouslySetInnerHTML={{ __html: n.content }}
              />

              {/* Pie: progreso de tareas y cuándo se editó */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {n.tareas.total > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      n.tareas.hechas === n.tareas.total
                        ? 'bg-success-bg text-success'
                        : 'bg-muted text-muted-foreground',
                    )}>
                    <ListChecks className="size-3" />
                    {n.tareas.hechas}/{n.tareas.total}
                  </span>
                )}
                <span className="ml-auto text-[11px] uppercase tracking-[0.4px] text-muted-foreground">
                  {cuando(n.updateTs)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={editando ? 'Editar nota' : 'Nueva nota'}
          ancho="lg"
          onClose={() => setModal(null)}
          footer={
            <>
              {editando && (
                // Sin "¿seguro?": borra, cierra y el aviso ofrece deshacer.
                <button
                  type="button"
                  className={cn(btnIcon, 'mr-auto text-danger hover:bg-danger-bg hover:text-danger')}
                  aria-label="Eliminar la nota"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await borrarConDeshacer({
                        borrar: () => deleteNote(editando.uuid),
                        restaurar: restaurarNota,
                        mensaje: 'Nota eliminada',
                        alTerminar: () => setModal(null),
                      })
                    })
                  }>
                  <Trash2 className="size-4" />
                </button>
              )}
              <button type="button" className={btnOutline} onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !hayTexto}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <div className="flex flex-col gap-3">
            <TextField
              ariaLabel="Título de la nota (opcional)"
              placeholder="Título (opcional)"
              value={titulo}
              onChange={setTitulo}
            />
            {/* Barra de formato del editor visual. El botón se marca cuando su
                formato está activo donde está el cursor. */}
            <div className="flex flex-wrap gap-0.5 rounded-md border border-border bg-card/50 p-1">
              <BotonFormato label="Título" icon={Heading} activo={activos.h3} onClick={() => formato('formatBlock', 'H3')} />
              <BotonFormato label="Negrita" icon={Bold} activo={activos.bold} onClick={() => formato('bold')} />
              <BotonFormato label="Cursiva" icon={Italic} activo={activos.italic} onClick={() => formato('italic')} />
              <BotonFormato label="Subrayado" icon={Underline} activo={activos.underline} onClick={() => formato('underline')} />
              <BotonFormato label="Lista" icon={List} activo={activos.insertUnorderedList} onClick={() => formato('insertUnorderedList')} />
              <BotonFormato label="Lista numerada" icon={ListOrdered} activo={activos.insertOrderedList} onClick={() => formato('insertOrderedList')} />
              <BotonFormato label="Lista de tareas" icon={ListChecks} activo={activos.tareas} onClick={listaTareas} />
              <BotonFormato label="Enlace" icon={Link2} onClick={enlazar} />
            </div>

            {/* Editor: contentEditable, siempre con el formato a la vista. Se
                siembra una sola vez (key por nota + html estable) para no pisar
                lo que se escribe. */}
            <div
              key={modal}
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Contenido de la nota"
              data-placeholder="Escribe aquí…"
              onInput={() => {
                // El `li` que crea Enter dentro de una lista de tareas nace sin
                // `data-check`: se le pone aquí para que salga con su casilla.
                marcarPendientes()
                setHayTexto(Boolean(editorRef.current?.textContent?.trim()))
              }}
              onKeyDown={onKeyDown}
              onClick={onClickEditor}
              className="editor-nota contenido-nota tareas-pulsables min-h-56 rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-primary"
              dangerouslySetInnerHTML={{ __html: htmlInicial }}
            />
            <p className="text-[12px] text-muted-foreground">
              En una lista de tareas, pulsa la casilla para marcarla.
            </p>
          </div>
        </Modal>
      )}

    </div>
  )
}

/** Botón de la barra de formato: mousedown con preventDefault para no perder la
 *  selección del editor al pulsarlo. */
function BotonFormato({
  label, icon: Icon, onClick, activo = false,
}: {
  label: string
  icon: typeof Bold
  onClick: () => void
  /** Formato activo donde está el cursor: el botón se marca. */
  activo?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(btnIcon, activo && 'bg-primary/15 text-primary')}
      aria-label={label}
      aria-pressed={activo}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}>
      <Icon className="size-4" />
    </button>
  )
}
