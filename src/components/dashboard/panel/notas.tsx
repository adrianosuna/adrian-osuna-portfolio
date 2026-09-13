'use client'

// Pestaña "Notas": editor visual (contentEditable) que guarda HTML saneado en el
// servidor. Buscador, fijar notas y checklists que se marcan dentro del editor.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import {
  Bold, Heading, Italic, Link2, List, ListChecks, ListOrdered, Pin, Plus, Search,
  Trash2, Underline, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, sinAcentos } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { Modal } from '@/components/ui/modal'
import { TextField } from '@/components/ui/fields'
import {
  createNote, deleteNote, pinNote, restaurarNota, updateNote,
} from '@/app/app/panel/actions'
import { borrarConDeshacer } from '@/components/dashboard/deshacer'
import type { NotaRow } from '@/lib/notas'
import { btnIcon, btnOutline, btnPrimary } from '@/components/ui/botones'


/** Cuerpo de una tarjeta, recortado a cuatro líneas con botón para desplegar. El
 *  recorte se mide (scrollHeight/clientHeight): un umbral de caracteres fallaría. */
function CuerpoNota({ html, etiqueta }: { html: string; etiqueta: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [abierta, setAbierta] = useState(false)
  const [recortada, setRecortada] = useState(false)

  // Solo se mide CERRADA: desplegada no hay desbordamiento que medir, y
  // medirla ahí apagaría el botón con el que volver a cerrarla.
  useEffect(() => {
    const el = ref.current
    if (!el || abierta) return
    const medir = () => setRecortada(el.scrollHeight > el.clientHeight + 1)
    medir()
    // Sin ResizeObserver (jsdom) basta la medida inicial.
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [html, abierta])

  return (
    <>
      <div
        ref={ref}
        // pointer-events-none: el clic es SIEMPRE de la tarjeta (abre la nota),
        // nunca de un enlace ni de una casilla de tarea del contenido.
        className={cn(
          'contenido-nota pointer-events-none text-muted-foreground',
          !abierta && 'line-clamp-4',
        )}
        // Contenido ya saneado en el servidor al guardarse.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {(recortada || abierta) && (
        <button
          type="button"
          className="mt-1 self-start text-[11px] font-semibold uppercase tracking-[0.4px] text-primary hover:text-primary/80"
          aria-expanded={abierta}
          // Con varias tarjetas, "Ver más" a secas no dice de qué nota es.
          aria-label={`${abierta ? 'Recortar' : 'Ver entera'}: ${etiqueta || 'nota sin título'}`}
          // La tarjeta entera abre el editor: ni el clic ni el Enter de este
          // botón deben llegar hasta ella.
          onClick={(e) => {
            e.stopPropagation()
            setAbierta((v) => !v)
          }}
          onKeyDown={(e) => e.stopPropagation()}>
          {abierta ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </>
  )
}

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

/** Ancho en píxeles de la casilla de una tarea (padding-left del `li`). Dentro del
 *  editor solo se alterna pulsando ahí: el resto del clic coloca el cursor. */
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
  // HTML con el que se siembra el editor. Solo cambia al abrir otra nota: durante la
  // edición el prop es estable y React no pisa lo que se escribe.
  const [htmlInicial, setHtmlInicial] = useState(
    () => (nueva || !abrirUuid ? '' : (rows.find((n) => n.uuid === abrirUuid)?.content ?? '')),
  )
  // Qué formato está activo en la selección (para marcar sus botones, como Word).
  const [activos, setActivos] = useState<Record<string, boolean>>({})
  // Filtro de la lista
  const [busqueda, setBusqueda] = useState('')

  // La `<ul>` que contiene la selección, si está dentro del editor. En useCallback
  // para que el efecto que escucha la selección no se resuscriba en cada render.
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
    // Formato por etiquetas (`<b>`, `<i>`), no por CSS: el saneador tira `style` y el
    // formato se perdería al guardar.
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

  // Buscador: título y texto plano del contenido, no el HTML ("strong" no es una
  // palabra de la nota).
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
          {visibles.map((n) => (
            // Contenedor SIN rol: dentro va el botón de fijar, y un role="button"
            // aquí anidaría dos controles (axe: nested-interactive). Quien abre la
            // nota es el botón que cubre la tarjeta, debajo del de fijar.
            <div
              key={n.uuid}
              className={cn(
                'superficie relative flex flex-col rounded-2xl p-4 text-left transition-colors focus-within:border-primary hover:border-white/16',
                n.pinned ? 'border-primary/40' : 'border-border',
              )}>
              {/* Cubre la tarjeta y es lo que abre la nota: un botón de verdad, con
                  su nombre accesible; el contenido va debajo sin recibir el ratón. */}
              <button
                type="button"
                className="absolute inset-0 z-0 rounded-2xl focus:outline-none"
                aria-label={`Abrir la nota ${n.title || 'sin título'}`}
                onClick={() => abrir(n)}
              />
              {/* Fijar: encima de la tarjeta, y para el clic para no abrirla */}
              <Tooltip texto={n.pinned ? 'Soltar' : 'Fijar arriba'}>
                <button
                  type="button"
                  className={cn(
                    'absolute right-2 top-2 rounded-md p-1.5 transition-colors',
                    n.pinned
                      ? 'text-primary hover:bg-primary/10'
                      : 'text-muted-foreground hover:bg-white/6 hover:text-foreground',
                  )}
                  aria-label={n.pinned ? 'Soltar la nota' : 'Fijar la nota arriba'}
                  aria-pressed={n.pinned}
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
              </Tooltip>

              {n.title && <p className="mb-1 truncate pr-8 font-semibold">{n.title}</p>}
              <CuerpoNota html={n.content} etiqueta={n.title} />

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
            <div className="flex flex-wrap gap-0.5 superficie-baja rounded-lg p-1">
              <BotonFormato label="Título" icon={Heading} activo={activos.h3} onClick={() => formato('formatBlock', 'H3')} />
              <BotonFormato label="Negrita" icon={Bold} activo={activos.bold} onClick={() => formato('bold')} />
              <BotonFormato label="Cursiva" icon={Italic} activo={activos.italic} onClick={() => formato('italic')} />
              <BotonFormato label="Subrayado" icon={Underline} activo={activos.underline} onClick={() => formato('underline')} />
              <BotonFormato label="Lista" icon={List} activo={activos.insertUnorderedList} onClick={() => formato('insertUnorderedList')} />
              <BotonFormato label="Lista numerada" icon={ListOrdered} activo={activos.insertOrderedList} onClick={() => formato('insertOrderedList')} />
              <BotonFormato label="Lista de tareas" icon={ListChecks} activo={activos.tareas} onClick={listaTareas} />
              <BotonFormato label="Enlace" icon={Link2} onClick={enlazar} />
            </div>

            {/* Editor contentEditable. Se siembra una sola vez (key por nota + html estable)
                para no pisar lo que se escribe. */}
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
    <Tooltip texto={label}>
      <button
        type="button"
        className={cn(btnIcon, activo && 'bg-primary/15 text-primary')}
        aria-label={label}
        aria-pressed={activo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}>
        <Icon className="size-4" />
      </button>
    </Tooltip>
  )
}
