'use client'

// Sub-pestaña API de Usuarios: los tokens con los que un Atajo del iPhone (o
// cualquier automatización) apunta gastos y notas sin sesión de Google.
//
// La regla que manda el diseño de esta pantalla: **el token se ve UNA vez**. En
// la base de datos solo queda su SHA-256, así que no hay "volver a mostrarlo" —
// y por eso al crearlo aparece en un aviso destacado con botón de copiar, y no
// como una fila más de la lista. Si se pierde, se revoca y se crea otro.
import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { btnIcon, btnOutline, btnPrimary } from '@/components/ui/botones'
import { Modal } from '@/components/ui/modal'
import { Field, TextField } from '@/components/ui/fields'
import { Celda, Fila, FilaVacia, Tabla, TarjetaTabla, type Columna } from '@/components/ui/tabla'
import { useConfirmar } from '@/components/dashboard/confirmar'
import { createApiToken, revokeApiToken } from '@/app/app/panel/actions'

export interface ApiTokenRow {
  uuid: string
  name: string
  /** Primeros caracteres, para reconocerlo sin poder usarlo. */
  prefix: string
  lastUsed: string | null // ISO
  createTs: string // ISO
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })

const COLUMNAS: Columna[] = [
  { label: 'Nombre' },
  { label: 'Token' },
  { label: 'Creado' },
  { label: 'Último uso' },
  { label: 'Acciones', alineado: 'derecha', oculta: true },
]

export function ApiTokens({ rows, base }: { rows: ApiTokenRow[]; base: string }) {
  const confirmar = useConfirmar()
  const [pending, startTransition] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  // El token recién creado, que solo existe en esta pantalla y en este momento.
  const [nuevo, setNuevo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const crear = () =>
    startTransition(async () => {
      const res = await createApiToken({ name: nombre })
      if (!res.ok || !('token' in res) || !res.token) {
        toast.error(res.message ?? 'No se pudo crear el token')
        return
      }
      setNuevo(res.token)
      setNombre('')
      setAbierto(false)
    })

  const revocar = (t: ApiTokenRow) =>
    startTransition(async () => {
      const res = await revokeApiToken(t.uuid)
      if (!res.ok) toast.error(res.message ?? 'Error')
      else toast.success('Token revocado: deja de valer al instante')
    })

  const copiar = async () => {
    if (!nuevo) return
    try {
      await navigator.clipboard.writeText(nuevo)
      setCopiado(true)
      toast.success('Token copiado')
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): el token está a la vista,
      // así que siempre queda seleccionarlo a mano.
      toast.error('No se pudo copiar: selecciónalo y cópialo a mano')
    }
  }

  return (
    <div>


      {nuevo && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Copia el token ahora</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Es la única vez que se muestra: solo se guarda su huella, así que no hay forma de
            volver a verlo. Si se pierde, revócalo y crea otro.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-[12.5px] break-all">
              {nuevo}
            </code>
            <button type="button" className={btnOutline} onClick={copiar}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <button
            type="button"
            className="mt-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              setNuevo(null)
              setCopiado(false)
            }}>
            Ya lo tengo, ocultar
          </button>
        </div>
      )}

      <TarjetaTabla
        titulo="Tokens de la API"
        icono={<KeyRound className="size-4 text-primary" />}
        cuenta={rows.length}
        acciones={
          <button type="button" className={btnPrimary} onClick={() => setAbierto(true)}>
            <Plus className="size-4" />
            Nuevo token
          </button>
        }>
        <Tabla columnas={COLUMNAS} minAncho="min-w-140">
          {rows.length === 0 ? (
            <FilaVacia columnas={COLUMNAS.length}>No hay tokens creados</FilaVacia>
          ) : (
            rows.map((t) => (
              <Fila key={t.uuid}>
                <Celda className="font-semibold">{t.name}</Celda>
                <Celda className="text-muted-foreground">
                  <code className="text-[12.5px]">{t.prefix}…</code>
                </Celda>
                <Celda className="tabular-nums text-muted-foreground">{fmt(t.createTs)}</Celda>
                <Celda className="tabular-nums text-muted-foreground">
                  {t.lastUsed ? fmt(t.lastUsed) : 'Sin usar todavía'}
                </Celda>
                <Celda alineado="derecha">
                  <button
                    type="button"
                    className={btnIcon}
                    disabled={pending}
                    title="Revocar"
                    aria-label={`Revocar el token ${t.name}`}
                    onClick={async () => {
                      if (
                        await confirmar({
                          clave: 'revocar-token-api',
                          titulo: 'Revocar el token',
                          texto: `Lo que use "${t.name}" dejará de funcionar al instante.`,
                          etiqueta: 'Revocar',
                        })
                      ) {
                        revocar(t)
                      }
                    }}>
                    <Trash2 className="size-4" />
                  </button>
                </Celda>
              </Fila>
            ))
          )}
        </Tabla>
      </TarjetaTabla>

      <ComoUsarla base={base} />

      {abierto && (
        <Modal
          title="Nuevo token"
          description="Un token por cada sitio que use la API: así revocar uno no rompe los demás."
          onClose={() => setAbierto(false)}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={() => setAbierto(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !nombre.trim()}
                onClick={crear}>
                Crear token
              </button>
            </>
          }>
          <Field label="Nombre">
            <TextField value={nombre} onChange={setNombre} maxLength={80} onEnter={crear} />
          </Field>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Sirve para reconocerlo en la lista y para saber qué dejas de romper al revocarlo.
          </p>
        </Modal>
      )}
    </div>
  )
}

/**
 * La documentación, junto al botón que crea el token.
 *
 * Está aquí y no solo en `docs/` a propósito: cuando alguien viene a crear un
 * token es justo cuando necesita saber a qué URL apuntar y qué cabecera poner.
 */
function ComoUsarla({ base }: { base: string }) {
  const ejemplo = [
    `POST ${base}/api/v1/movimientos`,
    'Authorization: Bearer ao_...',
    'Content-Type: application/json',
    '',
    '{ "concepto": "Mercadona", "importe": "12,50", "categoria": "Supermercado" }',
  ].join('\n')

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      {/* `h3`: va bajo el `h2` de la tarjeta, sin saltarse un nivel. */}
      <h3 className="text-sm font-semibold">Cómo usarla desde un Atajo</h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Acción <strong>Obtener contenido de la URL</strong>, método <strong>POST</strong>, cuerpo{' '}
        <strong>JSON</strong>, y una cabecera <code>Authorization</code> con{' '}
        <code>Bearer</code> y el token.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background p-3 text-[12px] leading-relaxed">
        {ejemplo}
      </pre>
      <ul className="mt-3 flex flex-col gap-1 text-[12.5px] text-muted-foreground">
        <li>
          <code>POST /api/v1/movimientos</code> — apunta un gasto o un ingreso. Solo{' '}
          <code>concepto</code> e <code>importe</code> son obligatorios; la fecha cae a hoy y el
          tipo a gasto. La <code>categoria</code> admite el nombre.
        </li>
        <li>
          <code>POST /api/v1/notas</code> — guarda una nota (<code>titulo</code> y{' '}
          <code>texto</code>).
        </li>
        <li>
          <code>GET /api/v1/resumen</code> — ingresos, gastos y balance del mes, con los topes
          pasados y los avisos.
        </li>
        <li>
          <code>GET /api/v1/categorias</code> — la lista, para que el Atajo la ofrezca en un menú.
        </li>
      </ul>
      <p className="mt-3 text-[12.5px] text-muted-foreground">
        Todas responden JSON con <code>ok</code>, y devuelven un <code>mensaje</code> listo para
        que el Atajo lo lea en voz alta. Receta completa en <code>docs/API.md</code>.
      </p>
    </div>
  )
}
