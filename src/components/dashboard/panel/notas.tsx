'use client'

// Pestaña "Notas" del Panel de control: apuntes propios del admin con formato.
// Se editan en un editor VISUAL (contentEditable, tipo Word: siempre se ve el
// formato) y se guardan como HTML. Ese HTML se SANEA en el servidor antes de
// guardarlo (`lib/sanitizar-html.ts`), así que pintarlo con dangerouslySetInnerHTML
// —tanto en el editor como en las tarjetas— es seguro.
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Bold, Heading, Italic, Link2, List, ListOrdered, Plus, Trash2, Underline,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { TextField } from '@/components/ui/fields'
import { createNote, deleteNote, updateNote } from '@/app/app/panel/actions'
import type { NotaRow } from '@/lib/notas'

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
const btnIcon =
  'rounded-md p-2 max-sm:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40'

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

/** Título mostrado en la tarjeta: el propio, o el primer texto del contenido. */
function tituloDe(nota: NotaRow): string {
  if (nota.title) return nota.title
  const texto = nota.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return texto.slice(0, 80) || 'Sin título'
}

export function NotasTab({ rows }: { rows: NotaRow[] }) {
  const [pending, startTransition] = useTransition()
  // null = cerrado · 'nueva' = alta · uuid = edición
  const [modal, setModal] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [hayTexto, setHayTexto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  // HTML con el que se siembra el editor al abrir. Solo cambia al abrir otra
  // nota, así que durante la edición el prop no cambia y React no repisa lo que
  // se escribe (el DOM del contentEditable diverge, pero el `__html` es el mismo).
  const [htmlInicial, setHtmlInicial] = useState('')
  // Qué formato está activo en la selección (para marcar sus botones, como Word).
  const [activos, setActivos] = useState<Record<string, boolean>>({})

  // Lee del navegador qué comandos están activos donde está el cursor. Solo si
  // la selección está dentro del editor (si no, no hay nada que marcar).
  const sincronizarActivos = () => {
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
    setActivos({
      bold: on('bold'),
      italic: on('italic'),
      underline: on('underline'),
      insertUnorderedList: on('insertUnorderedList'),
      insertOrderedList: on('insertOrderedList'),
      h3: bloque === 'h3',
    })
  }

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
  }, [modal])

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
    setHayTexto(Boolean(nota && tituloDe(nota) !== 'Sin título'))
    setActivos({}) // sin arrastrar el estado de la nota anterior
    setConfirmando(false)
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

  const editando = modal !== 'nueva' ? rows.find((n) => n.uuid === modal) : undefined

  return (
    <div>
      <div className="mb-4 flex justify-end">
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((n) => (
            // NO es un <button>: la tarjeta pinta el HTML de la nota (bloques y
            // enlaces), que dentro de un botón sería anidamiento inválido (React
            // avisa) y haría que un enlace disparara enlace + editor a la vez.
            // Div con role/teclado, y el preview con pointer-events-none para
            // que el clic —incluso sobre un enlace— siempre abra el editor.
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
              className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus:border-primary focus:outline-none">
              {n.title && <p className="mb-1 truncate font-semibold">{n.title}</p>}
              <div
                className="contenido-nota pointer-events-none line-clamp-4 text-muted-foreground"
                // Contenido ya saneado en el servidor al guardarse.
                dangerouslySetInnerHTML={{ __html: n.content }}
              />
              <p className="mt-3 text-[11px] uppercase tracking-[0.4px] text-muted-foreground/70">
                {cuando(n.updateTs)}
              </p>
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
                <button
                  type="button"
                  className={cn(btnIcon, 'mr-auto text-danger hover:bg-danger-bg hover:text-danger')}
                  aria-label="Eliminar la nota"
                  disabled={pending}
                  onClick={() => setConfirmando(true)}>
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
              onInput={() => setHayTexto(Boolean(editorRef.current?.textContent?.trim()))}
              onKeyDown={onKeyDown}
              className="editor-nota contenido-nota min-h-56 rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-primary"
              dangerouslySetInnerHTML={{ __html: htmlInicial }}
            />
          </div>
        </Modal>
      )}

      {/* Confirmación de borrado, sobre el propio modal. */}
      {modal && confirmando && editando && (
        <Modal
          title="Eliminar nota"
          onClose={() => setConfirmando(false)}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={cn(btnPrimary, 'bg-danger')}
                disabled={pending}
                onClick={() => {
                  setConfirmando(false)
                  run(deleteNote(editando.uuid), 'Nota eliminada')
                }}>
                Eliminar
              </button>
            </>
          }>
          <p className="text-sm">
            Se eliminará «{tituloDe(editando)}». No se puede deshacer.
          </p>
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
