'use client'

// Sección "Ajustes" de Finanzas (`?s=ajustes`): TODA la configuración del
// módulo, un bloque por cosa — CATEGORÍAS (con su tope), RECURRENTES y AÑOS de
// ahorro.
//
// Antes cada una vivía en un modal dentro de su vista, con scroll y sin sitio:
// con 19 categorías había que buscar a ojo. Ahora las LISTAS son una sección de
// verdad (buscador, filtros, fusión, usos) y lo que sí va en modal son los
// FORMULARIOS —alta y edición, los mismos campos— porque son cinco o seis
// campos que en una fila no se leen.
import { useState, useTransition } from 'react'
import {
  CalendarRange, Check, ChevronDown, Copy, FileDown, FolderMinus, FolderTree, Merge, Pause, Pencil,
  PlayCircle, Plus, Repeat, Tag, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, sinAcentos } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useConfirmar } from '@/components/dashboard/confirmar'
import { DateField, Field, NumberField, SelectField, TextField, TreeSelectField } from '@/components/ui/fields'
import { Tooltip } from '@/components/ui/tooltip'
import type { CategoriaRow, TipoMovimiento } from '@/lib/gastos'
import { arbolDeCategoria, esGrupo, etiquetaCategoria } from '@/lib/categorias'
import type { YearSummary } from '@/lib/finance'
import { createYear, deleteYear, updateYear } from '@/app/app/finance/actions'
import {
  apuntarRecurrenteAhora, createCategoria, createRecurrente, deleteCategoria,
  deleteRecurrente, fusionarCategorias, leerMovimientosDeRecurrente, updateCategoria,
  updateRecurrente,
} from '@/app/app/finance/gastos-actions'
import type { MovimientoRow } from '@/lib/gastos'
import {
  etiquetaPeriodo, PERIODICIDADES, resumenRecurrentes, type RecurrenteRow,
} from '@/lib/recurrentes'
import {
  btnIcon, btnOutline, btnPrimary, cardClass, chipFiltro, eur, fmtDiaAnio, SIN_CATEGORIA, TIPOS,
} from './comun'
import { MenuAcciones } from '@/components/dashboard/menu-acciones'
import { barraTabs, claseTab } from '@/components/dashboard/sub-tabs'

type Accion = Promise<{ ok: boolean; message?: string }>

// Normaliza para buscar (sin tildes ni mayúsculas): el mismo criterio que el
// buscador de los selects, en `lib/utils.ts`.
const clave = sinAcentos

export function AjustesTab({ categorias, recurrentes, years, hoy }: {
  categorias: CategoriaRow[]
  recurrentes: RecurrenteRow[]
  years: YearSummary[]
  hoy: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <PanelCategorias categorias={categorias} />
      <PanelRecurrentes filas={recurrentes} categorias={categorias} hoy={hoy} />
      <PanelAnios years={years} />
    </div>
  )
}

/** Cabecera común de los bloques: título, resumen y (si se pide) buscador. */
function Cabecera({ icono, titulo, resumen, busqueda, onBuscar, children }: {
  icono: React.ReactNode
  titulo: string
  resumen: string
  /** Sin `onBuscar` no se pinta el buscador (los años son cuatro, no 19). */
  busqueda?: string
  onBuscar?: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3">
      <h2 className="flex items-center gap-2 font-semibold">
        {icono}
        {titulo}
      </h2>
      <p className="text-[12.5px] text-muted-foreground">{resumen}</p>
      {/* En móvil las tres piezas se APILAN (columna), no se reparten por
          wrapping: buscador, filtros y botón de alta, cada uno en su fila y a
          lo ancho. Compartiendo fila se pisaban entre ellas. */}
      <div className="ml-auto flex items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch">
        {/* Sin icono de lupa dentro del campo: se montaba encima del
            placeholder, y "Buscar..." ya dice lo que hace. */}
        {onBuscar && (
          <TextField
            className="w-44 max-sm:w-full"
            ariaLabel={`Buscar en ${titulo.toLowerCase()}`}
            placeholder="Buscar..."
            value={busqueda ?? ''}
            onChange={onBuscar}
          />
        )}
        {children}
      </div>
    </div>
  )
}

/** Filtros en línea (chips): uno activo a la vez. */
function Filtros<T extends string>({ valor, onCambio, opciones, etiqueta }: {
  valor: T
  onCambio: (v: T) => void
  opciones: Array<{ value: T; label: string }>
  etiqueta: string
}) {
  return (
    <div
      className="flex rounded-lg border border-border bg-card/50 p-0.5"
      role="group"
      aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn(
            // whitespace-nowrap: en móvil el chip se estrecha y "En pausa" se
            // partía en dos líneas, subiendo la fila entera a 54px.
            chipFiltro,
            valor === o.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onCambio(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─────────── categorías ───────────

// Gasto e ingreso son DOS listas independientes (un movimiento es de un tipo o
// del otro, nunca de los dos), así que se enseñan como dos pestañas y no como
// una lista con cabeceras de bloque: hubo dos versiones de esas cabeceras el
// 05/09/2026 y ninguna separaba de verdad. La pestaña, además, es funcional:
// fija el tipo al crear y decide qué filtros tienen sentido.
const TABS_CAT: Array<{ id: TipoMovimiento; label: string }> = [
  { id: 'GASTO', label: 'Gasto' },
  { id: 'INGRESO', label: 'Ingreso' },
]

/** Filtro de la pestaña de gasto: el tope solo existe ahí. */
type FiltroTope = 'todas' | 'tope'
const FILTROS_TOPE: Array<{ value: FiltroTope; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'tope', label: 'Con tope' },
]

interface BorradorCat {
  name: string
  type: TipoMovimiento
  /** Un GRUPO en vez de una categoría (se decide al crear, no se cambia). */
  isGroup: boolean
  /** Grupo al que se asigna ('' = suelta). */
  parentUuid: string
  budget: number | null
}

const CAT_VACIA: BorradorCat = {
  name: '', type: 'GASTO', isGroup: false, parentUuid: '', budget: null,
}

function PanelCategorias({ categorias }: { categorias: CategoriaRow[] }) {
  const [pending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [tipoActivo, setTipoActivo] = useState<TipoMovimiento>('GASTO')
  const [filtro, setFiltro] = useState<FiltroTope>('todas')
  const [fusionando, setFusionando] = useState<string | null>(null)
  const [destino, setDestino] = useState('')
  const confirmar = useConfirmar()
  // Alta y edición comparten formulario y modal: `editando` es la categoría en
  // curso, o null cuando se está creando una nueva.
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<CategoriaRow | null>(null)
  const [borrador, setBorrador] = useState<BorradorCat>(CAT_VACIA)
  /**
   * Grupos a los que se puede asignar lo que se está editando: los de su
   * mismo tipo, y nada más. Sin filtros por uso, porque asignar una categoría
   * con historial a un grupo no tiene ningún problema — se mueve la
   * categoría, sus movimientos siguen colgando de ella.
   */
  const gruposPosibles = (b: BorradorCat) =>
    categorias.filter((c) => c.type === b.type && esGrupo(c))

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(res.message ?? success)
      luego?.()
    })

  const conTope = categorias.filter((c) => c.budget !== null).length
  const grupos = categorias.filter(esGrupo)
  const q = clave(busqueda.trim())
  const visibles = categorias.filter((c) => {
    if (q && !clave(c.name).includes(q)) return false
    // El filtro de tope solo actúa en la pestaña de gasto.
    if (tipoActivo === 'GASTO' && filtro === 'tope') return c.budget !== null
    return true
  })

  const porTipo = (tipo: TipoMovimiento) => visibles.filter((c) => c.type === tipo)
  /** Cuenta por pestaña: categorías del tipo (los grupos no cuentan). */
  const cuentaDe = (tipo: TipoMovimiento) =>
    categorias.filter((c) => c.type === tipo && !esGrupo(c)).length

  const listar = (tipo: TipoMovimiento) => {
    const grupo = porTipo(tipo)
    return (
      <div key={tipo}>
        {grupo.length === 0 && (
          <p className="py-2 text-[13px] text-muted-foreground">
            {busqueda.trim() || (tipo === 'GASTO' && filtro === 'tope')
              ? 'Ninguna con ese criterio.'
              : tipo === 'GASTO'
                ? 'Ninguna categoría de gasto todavía. Con «Nueva» das de alta la primera.'
                : 'Ninguna categoría de ingreso todavía. Con «Nueva» das de alta la primera.'}
          </p>
        )}
        {grupo.map((c) => (
          // Las categorías de un grupo van sangradas: la lista llega ya en
          // orden de árbol (cada grupo seguido de las suyas, ver
          // `listCategorias`).
          <div
            key={c.uuid}
            className={cn('border-b border-border/60 py-2', c.parentUuid && 'pl-4 sm:pl-6')}>
            {fusionando === c.uuid ? (
              <FusionarFila
                origen={c}
                // Sin grupos: no se les pueden colgar movimientos, así que
                // fusionar en uno dejaría el dato que la interfaz no crea.
                candidatas={categorias.filter(
                  (o) => o.type === c.type && o.uuid !== c.uuid && !esGrupo(o),
                )}
                destino={destino}
                onDestino={setDestino}
                pending={pending}
                onCancelar={() => setFusionando(null)}
                onFusionar={() =>
                  run(fusionarCategorias(c.uuid, destino), 'Categorías fusionadas', () => {
                    setFusionando(null)
                    setDestino('')
                  })
                }
              />
            ) : (
              // En móvil, DOS líneas fijas (nombre y tope arriba; usos y
              // acciones abajo) en vez de dejar que el wrapping reparta cinco
              // piezas: con `sm:contents` los envoltorios desaparecen en
              // escritorio y todo vuelve a una sola fila.
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:contents">
                  {/* Un grupo lleva icono de carpeta en vez del punto de
                      color: es un contenedor, no algo que se apunte. */}
                  {esGrupo(c) ? (
                    <FolderTree className="size-3.5 shrink-0" style={{ color: c.color }} />
                  ) : (
                    <span className="inline-block size-3 shrink-0 rounded" style={{ background: c.color }} />
                  )}
                  {/* Con el buscador puesto puede salir una categoría sin su
                      grupo al lado, así que la ruta completa va en el tooltip
                      (solo si tiene grupo: repetir el nombre no aporta). */}
                  <Tooltip texto={c.parentName ? etiquetaCategoria(c) : undefined}>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  </Tooltip>
                  {esGrupo(c) && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
                      {c.hijas === 0
                        ? 'Grupo vacío'
                        : `Grupo · ${c.hijas}`}
                    </span>
                  )}
                  {c.budget !== null && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                      {eur(c.budget)}/mes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 max-sm:ml-5 sm:contents">
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:flex-none sm:shrink-0">
                    {/* Un grupo no tiene movimientos propios: contar "sin uso"
                        ahí sería decir algo que no significa nada. */}
                    {esGrupo(c) ? '' : usosTexto(c)}
                  </span>
                  <MenuAcciones
                    className="shrink-0"
                    etiqueta={c.name}
                    acciones={[
                      {
                        id: 'fusionar',
                        label: 'Fusionar con otra categoría',
                        icon: <Merge className="size-3.5" />,
                        // Un grupo no tiene movimientos propios que llevarse:
                        // lo que se fusiona son sus subcategorías.
                        disabled: esGrupo(c),
                        motivo: 'Es un grupo: fusiona las categorías que tiene dentro.',
                        onClick: () => {
                          setEditando(null)
                          setDestino('')
                          setFusionando(c.uuid)
                        },
                      },
                      {
                        // Sacar de un grupo en un clic. Meter en uno se hace
                        // desde el formulario, donde hay que ELEGIR cuál; esto
                        // no tiene nada que elegir, así que no merece un modal.
                        id: 'desagrupar',
                        label: 'Sacar del grupo',
                        icon: <FolderMinus className="size-3.5" />,
                        disabled: c.parentUuid === null,
                        motivo: esGrupo(c) ? 'Es un grupo.' : 'No está en ningún grupo.',
                        onClick: () =>
                          run(updateCategoria(c.uuid, { parentUuid: '' }), `${c.name} fuera del grupo`),
                      },
                      {
                        id: 'editar',
                        label: 'Editar',
                        icon: <Pencil className="size-3.5" />,
                        onClick: () => {
                          setFusionando(null)
                          setBorrador({
                            name: c.name,
                            type: c.type,
                            isGroup: c.isGroup,
                            parentUuid: c.parentUuid ?? '',
                            budget: c.budget,
                          })
                          setEditando(c)
                          setAbierto(true)
                        },
                      },
                      {
                        // Una categoría en uso NO se borra: perder la
                        // clasificación de todo su historial en un clic no es
                        // una opción. Para quitarla de en medio está fusionar.
                        id: 'eliminar',
                        label: 'Eliminar',
                        icon: <Trash2 className="size-3.5" />,
                        destructiva: true,
                        // Un grupo VACÍO sí se borra: no arrastra nada.
                        disabled: enUso(c) || c.hijas > 0,
                        motivo: c.hijas > 0
                          ? `Tiene ${c.hijas} ${c.hijas === 1 ? 'categoría' : 'categorías'} dentro. Sácalas del grupo o bórralas primero.`
                          : `La usan ${usosTexto(c, ' y ')}. Fusiónala en otra.`,
                        onClick: async () => {
                          // Solo llega aquí lo que no arrastra nada: una
                          // categoría sin uso, o un grupo vacío.
                          if (
                            await confirmar({
                              clave: 'borrar-categoria',
                              titulo: esGrupo(c) ? 'Eliminar el grupo' : 'Eliminar la categoría',
                              texto: esGrupo(c)
                                ? `Se eliminará el grupo «${c.name}». No tiene ninguna categoría dentro.`
                                : `Se eliminará «${c.name}». No la usa ningún movimiento ni recurrente.`,
                            })
                          ) {
                            run(
                              deleteCategoria(c.uuid),
                              esGrupo(c) ? `Grupo ${c.name} eliminado` : `Categoría ${c.name} eliminada`,
                            )
                          }
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            )}

          </div>
        ))}
      </div>
    )
  }

  /** Alta de una categoría, o de un GRUPO si se pide (`isGroup`). Nace del
   *  tipo de la pestaña activa: si estás en Ingreso, lo que creas es de
   *  ingreso (el campo sigue ahí para cambiarlo). */
  const abrirAlta = (isGroup = false) => {
    setBorrador({ ...CAT_VACIA, type: tipoActivo, isGroup })
    setEditando(null)
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const guardar = () => {
    if (!borrador.name.trim()) return
    // Grupo y categoría comparten formulario, así que también los avisos:
    // decir "categoría creada" al crear un grupo es contarle otra cosa.
    const grupo = editando ? esGrupo(editando) : borrador.isGroup
    if (editando) {
      run(
        updateCategoria(editando.uuid, {
          name: borrador.name,
          // Un grupo no puede meterse dentro de otro, así que ni se manda: el
          // formulario tampoco ofrece el campo.
          ...(esGrupo(editando) ? {} : { parentUuid: borrador.parentUuid }),
          budget: borrador.budget,
        }),
        grupo ? 'Grupo actualizado' : 'Categoría actualizada',
        cerrar,
      )
      return
    }
    run(createCategoria(borrador), grupo ? 'Grupo creado' : 'Categoría creada', cerrar)
  }

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<Tag className="size-4 text-primary" />}
        titulo="Categorías"
        resumen={[
          `${categorias.length - grupos.length} en total`,
          grupos.length > 0 ? `${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}` : '',
          `${conTope} con tope`,
        ]
          .filter(Boolean)
          .join(' · ')}
        busqueda={busqueda}
        onBuscar={setBusqueda}>
        {/* El tope solo existe en las de gasto: en Ingreso el filtro no se
            pinta, en vez de pintarse sin efecto. */}
        {tipoActivo === 'GASTO' && (
          <Filtros valor={filtro} onCambio={setFiltro} opciones={FILTROS_TOPE} etiqueta="Filtrar categorías de gasto" />
        )}
        {/* Dos altas y no un desplegable con el tipo dentro: crear un grupo y
            crear una categoría son dos gestos distintos, y el grupo es lo que
            se crea PRIMERO cuando se va a ordenar la lista. */}
        <button
          type="button"
          className={cn(btnOutline, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={() => abrirAlta(true)}>
          <FolderTree className="size-3.5" /> Nuevo grupo
        </button>
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={() => abrirAlta()}>
          <Plus className="size-3.5" /> Nueva
        </button>
      </Cabecera>

      <div className="px-5 pb-3 pt-4">
        {/* Misma píldora que las secciones de Finanzas y el Panel de control
            (clases de `sub-tabs`), pero con estado local: aquí no hay ruta que
            navegar. Los grupos no cuentan en la cifra: son contenedores. */}
        <div className={cn(barraTabs, 'mb-3')} role="tablist" aria-label="Tipo de categoría">
          {TABS_CAT.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tipoActivo === t.id}
              className={cn(claseTab(tipoActivo === t.id), 'flex-1 sm:flex-none')}
              onClick={() => setTipoActivo(t.id)}>
              {t.label}
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                  tipoActivo === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                {cuentaDe(t.id)}
              </span>
            </button>
          ))}
        </div>
        {listar(tipoActivo)}
      </div>

      {/* Alta y edición, en el mismo modal: los campos son los mismos y el
          tipo, que no se puede cambiar después, solo se ofrece al crear. */}
      {abierto && (
        <Modal
          title={
            editando
              ? `Editar «${editando.name}»`
              : borrador.isGroup
                ? 'Nuevo grupo'
                : 'Nueva categoría'
          }
          description={
            editando
              ? 'El tipo no se cambia: una categoría de gasto y una de ingreso son listas distintas.'
              : borrador.isGroup
                ? 'Un grupo agrupa categorías y no se apunta nunca: se crea vacío y luego le asignas las que quieras.'
                : 'El color lo elige la aplicación, siempre distinto de los que ya hay.'
          }
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !borrador.name.trim()}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <div className="flex flex-col gap-3">
            {!editando && (
              <Field label="Tipo">
                <SelectField
                  className="w-32"
                  ariaLabel="Tipo de la categoría"
                  value={borrador.type}
                  onChange={(v) =>
                    // Al cambiar de tipo, el grupo elegido ya no vale: los dos
                    // niveles tienen que ser del mismo tipo.
                    setBorrador((b) => ({ ...b, type: v as TipoMovimiento, parentUuid: '' }))
                  }
                  options={TIPOS}
                />
              </Field>
            )}
            {/* Toda categoría ofrece su grupo: es donde se elige y donde se
                cambia. El campo NO se esconde cuando aún no hay ningún grupo
                —sale apagado con su aviso—, porque escondiéndolo la opción no
                se descubre: al editar parecía que agrupar no era posible.
                Solo desaparece si lo que se edita ES un grupo, que no puede
                entrar en otro. */}
            {!borrador.isGroup && !(editando && esGrupo(editando)) && (
              <div className="flex flex-col gap-1">
                <Field label="Grupo">
                  <SelectField
                    ariaLabel="Grupo de la categoría"
                    disabled={gruposPosibles(borrador).length === 0}
                    value={borrador.parentUuid}
                    onChange={(v) => setBorrador((b) => ({ ...b, parentUuid: v }))}
                    options={[
                      { value: '', label: 'Sin grupo' },
                      ...gruposPosibles(borrador).map((c) => ({ value: c.uuid, label: c.name })),
                    ]}
                  />
                </Field>
                {gruposPosibles(borrador).length === 0 && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Todavía no hay ningún grupo de {borrador.type === 'GASTO' ? 'gasto' : 'ingreso'}:
                    créalo con «Nuevo grupo» y vuelve aquí para asignarla.
                  </p>
                )}
              </div>
            )}
            <Field label="Nombre">
              <TextField
                autoFocus
                ariaLabel={borrador.isGroup ? 'Nombre del grupo' : 'Nombre de la categoría'}
                placeholder="Nombre"
                value={borrador.name}
                onChange={(v) => setBorrador((b) => ({ ...b, name: v }))}
                onEnter={guardar}
              />
            </Field>
            {borrador.type === 'GASTO' && (
              <div className="flex flex-col gap-1">
                <Field label="Tope al mes">
                  <NumberField
                    className="w-32"
                    step={10}
                    placeholder="Sin tope"
                    ariaLabel="Tope mensual"
                    value={borrador.budget}
                    onChange={(v) => setBorrador((b) => ({ ...b, budget: v }))}
                  />
                </Field>
                {/* El tope de un grupo cuenta la suma de sus categorías, y eso
                    hay que decirlo donde se pone. Fuera del <label> del campo
                    para no alargar su nombre accesible. */}
                {(borrador.isGroup || (editando && esGrupo(editando))) && (
                  <p className="text-[12.5px] text-muted-foreground">
                    Cuenta la suma de las categorías del grupo.
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

/** "27 movimientos · 2 recurrentes" (o "sin uso"). Dentro de una frase se pide
 *  con `union = ' y '`, que es como se lee en español. */
function usosTexto(c: CategoriaRow, union = ' · ') {
  const partes = [
    c.usos > 0 ? `${c.usos} ${c.usos === 1 ? 'movimiento' : 'movimientos'}` : '',
    c.usosRecurrentes > 0
      ? `${c.usosRecurrentes} ${c.usosRecurrentes === 1 ? 'recurrente' : 'recurrentes'}`
      : '',
  ].filter(Boolean)
  return partes.length ? partes.join(union) : 'sin uso'
}

/** Si algo la usa, no se puede borrar (hay que fusionarla). */
const enUso = (c: CategoriaRow) => c.usos > 0 || c.usosRecurrentes > 0

/** Fila desplegada para fusionar una categoría en otra del mismo tipo. */
function FusionarFila({ origen, candidatas, destino, onDestino, pending, onCancelar, onFusionar }: {
  origen: CategoriaRow
  candidatas: CategoriaRow[]
  destino: string
  onDestino: (v: string) => void
  pending: boolean
  onCancelar: () => void
  onFusionar: () => void
}) {
  const elegida = candidatas.find((c) => c.uuid === destino)
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-[13px]">
        Fusionar <strong>{origen.name}</strong> en:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          className="min-w-0 flex-1 max-sm:basis-full"
          ariaLabel={`Categoría de destino para ${origen.name}`}
          placeholder="Elige una categoría"
          value={destino}
          onChange={onDestino}
          options={candidatas.map((c) => ({ value: c.uuid, label: c.name }))}
        />
        <button type="button" className={btnOutline} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={btnPrimary} disabled={pending || !destino} onClick={onFusionar}>
          Fusionar
        </button>
      </div>
      {elegida && (
        <p className="text-[12.5px] text-muted-foreground">
          {usosTexto(origen, ' y ')} de «{origen.name}»{' '}
          {origen.usos + origen.usosRecurrentes === 1 ? 'pasará' : 'pasarán'}{' '}
          a «{elegida.name}», y «{origen.name}» desaparecerá.
        </p>
      )}
    </div>
  )
}

// ─────────── recurrentes ───────────

interface BorradorRec {
  type: TipoMovimiento
  concept: string
  amount: number | null
  intervalMonths: number
  nextDate: string
  cat: string
}

const MESES_FIJOS: number[] = PERIODICIDADES.map((p) => p.meses)
const OPCIONES_PERIODO = [
  ...PERIODICIDADES.map((p) => ({ value: String(p.meses), label: p.label })),
  { value: 'otro', label: 'Personalizado' },
]
const UNIDADES_PERIODO = [
  { value: 'meses', label: 'Meses' },
  { value: 'anios', label: 'Años' },
]
// Cota de sensatez, la misma que valida el servidor (`periodoValido`): hasta
// 120 meses = 10 años.
const MAX_MESES = 120

type FiltroRec = 'todos' | 'activos' | 'pausados'

const FILTROS_REC: Array<{ value: FiltroRec; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'pausados', label: 'En pausa' },
]

/**
 * Campos de un recurrente, los mismos para el alta y la edición: seis campos
 * son demasiados para mantener dos copias, que es la forma segura de que
 * acaben distintas. Los botones los pone el pie del modal.
 */
function FormRecurrente({ valor, onChange, categorias, onGuardar }: {
  valor: BorradorRec
  onChange: (v: BorradorRec) => void
  categorias: CategoriaRow[]
  /** Se dispara con Enter en el concepto. */
  onGuardar: () => void
}) {
  // Sin los grupos y con la etiqueta completa (ver `lib/categorias.ts`): un
  // recurrente apunta un movimiento, así que necesita una hoja.
  const opcionesCat = arbolDeCategoria(categorias, valor.type)

  // Periodicidad: si el intervalo es una de las comunes, el select la muestra;
  // si no, se editan número + unidad. Que el panel esté abierto es estado
  // PROPIO —sembrado del valor inicial al montar (el modal remonta este
  // formulario en cada apertura)—, no derivado del intervalo: derivarlo hacía
  // que teclear "18" colapsara el panel al pasar por "1" (un valor común).
  // Solo el select lo cierra, al elegir una periodicidad común.
  const [personalizado, setPersonalizado] = useState(!MESES_FIJOS.includes(valor.intervalMonths))
  // Los múltiplos de 12 se leen en años; el resto, en meses.
  const enAnios = valor.intervalMonths % 12 === 0
  const numCustom = enAnios ? valor.intervalMonths / 12 : valor.intervalMonths
  const unidadCustom = enAnios ? 'anios' : 'meses'
  const setIntervalo = (meses: number) => onChange({ ...valor, intervalMonths: meses })
  // Recompone y TOPA para que número × unidad nunca pase del límite (12 años
  // se quedarían en 10).
  const recomponer = (num: number, unidad: string) => {
    const tope = unidad === 'anios' ? MAX_MESES / 12 : MAX_MESES
    const n = Math.min(tope, Math.max(1, Math.floor(num || 1)))
    setIntervalo(unidad === 'anios' ? n * 12 : n)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <SelectField
            ariaLabel="Tipo del recurrente"
            value={valor.type}
            onChange={(v) => onChange({ ...valor, type: v as TipoMovimiento, cat: '' })}
            options={TIPOS}
          />
        </Field>
        <Field label="Importe">
          <NumberField
            ariaLabel="Importe del recurrente"
            placeholder="Importe"
            step={10}
            value={valor.amount}
            onChange={(v) => onChange({ ...valor, amount: v })}
          />
        </Field>
      </div>
      <Field label="Concepto">
        <TextField
          autoFocus
          ariaLabel="Concepto del recurrente"
          placeholder="Concepto"
          value={valor.concept}
          onChange={(v) => onChange({ ...valor, concept: v })}
          onEnter={onGuardar}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cada cuánto">
          <SelectField
            ariaLabel="Cada cuánto se repite"
            value={personalizado ? 'otro' : String(valor.intervalMonths)}
            onChange={(v) => {
              if (v === 'otro') {
                setPersonalizado(true)
              } else {
                setPersonalizado(false)
                setIntervalo(Number(v))
              }
            }}
            options={OPCIONES_PERIODO}
          />
        </Field>
        <Field label="Próximo cargo">
          <DateField
            ariaLabel="Fecha del próximo cargo"
            value={valor.nextDate}
            onChange={(v) => onChange({ ...valor, nextDate: v })}
          />
        </Field>
      </div>
      {personalizado && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Repetir cada">
            <NumberField
              ariaLabel="Número de la periodicidad personalizada"
              step={1}
              value={numCustom}
              onChange={(v) => recomponer(v ?? 1, unidadCustom)}
            />
          </Field>
          <Field label="Unidad">
            <SelectField
              ariaLabel="Unidad de la periodicidad"
              value={unidadCustom}
              onChange={(u) => recomponer(numCustom, u)}
              options={UNIDADES_PERIODO}
            />
          </Field>
        </div>
      )}
      <Field label="Categoría">
        <TreeSelectField
          ariaLabel="Categoría del recurrente"
          value={valor.cat}
          onChange={(v) => onChange({ ...valor, cat: v })}
          opciones={opcionesCat}
        />
      </Field>
    </div>
  )
}

function PanelRecurrentes({ filas, categorias, hoy }: {
  filas: RecurrenteRow[]
  categorias: CategoriaRow[]
  hoy: string
}) {
  const [pending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroRec>('todos')
  const confirmar = useConfirmar()
  const vacio: BorradorRec = {
    type: 'GASTO', concept: '', amount: null, intervalMonths: 1, nextDate: hoy, cat: '',
  }
  // Alta y edición, mismo formulario y mismo modal (ver PanelCategorias).
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<RecurrenteRow | null>(null)
  const [borrador, setBorrador] = useState<BorradorRec>(vacio)
  // Detalle desplegado de una fila y lo que ha apuntado: null mientras se pide,
  // 'error' si no se pudo leer (si no, se quedaría en "Cargando" para siempre).
  const [detalle, setDetalle] = useState<string | null>(null)
  const [cargados, setCargados] = useState<
    { total: number; movimientos: MovimientoRow[] } | 'error' | null
  >(null)

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const datosDe = (b: BorradorRec) => ({
    type: b.type,
    concept: b.concept,
    amount: b.amount,
    intervalMonths: b.intervalMonths,
    nextDate: b.nextDate,
    categoryUuid: b.cat || null,
  })

  const abrirAlta = () => {
    setBorrador(vacio)
    setEditando(null)
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const guardar = () => {
    if (!borrador.concept.trim() || borrador.amount === null) return
    if (editando) {
      run(updateRecurrente(editando.uuid, datosDe(borrador)), 'Recurrente actualizado', cerrar)
      return
    }
    run(createRecurrente(datosDe(borrador)), 'Recurrente creado', cerrar)
  }

  const borradorDe = (r: RecurrenteRow): BorradorRec => ({
    type: r.type,
    concept: r.concept,
    amount: r.amount,
    intervalMonths: r.intervalMonths,
    nextDate: r.nextDate,
    cat: r.categoryUuid ?? '',
  })

  /** Abre (o cierra) el detalle y pide lo que ha apuntado ese recurrente. */
  const abrirDetalle = (r: RecurrenteRow) => {
    if (detalle === r.uuid) return setDetalle(null)
    setDetalle(r.uuid)
    setCargados(null)
    if (r.generados === 0) return
    startTransition(async () => {
      const res = await leerMovimientosDeRecurrente(r.uuid)
      setCargados(res ?? 'error')
    })
  }

  /** Duplicar: abre el alta con los mismos valores; no escribe nada hasta crear. */
  const duplicar = (r: RecurrenteRow) => {
    setDetalle(null)
    setEditando(null)
    setBorrador({ ...borradorDe(r), concept: `${r.concept} (copia)` })
    setAbierto(true)
  }

  const resumen = resumenRecurrentes(filas)
  // Sin useMemo: el compilador de React ya memoiza esto solo, y a mano se
  // queja de no poder preservarlo (la lista son decenas de filas, no miles).
  const q = clave(busqueda.trim())
  const visibles = filas.filter((r) => {
    if (q && !clave(r.concept).includes(q)) return false
    if (filtro === 'activos') return r.active
    if (filtro === 'pausados') return !r.active
    return true
  })

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<Repeat className="size-4 text-primary" />}
        titulo="Recurrentes"
        resumen={`${resumen.activos} activos · ${eur(resumen.gasto)} de gasto fijo al mes`}
        busqueda={busqueda}
        onBuscar={setBusqueda}>
        <Filtros valor={filtro} onCambio={setFiltro} opciones={FILTROS_REC} etiqueta="Filtrar recurrentes" />
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={abrirAlta}>
          <Plus className="size-3.5" /> Nuevo
        </button>
      </Cabecera>

      <div className="px-5 py-3">
        {visibles.length === 0 && (
          <p className="py-1 text-[13px] text-muted-foreground">
            {filas.length === 0
              ? 'Ninguno todavía. Con «Nuevo» das de alta el primero: el alquiler, una suscripción o la nómina.'
              : 'Ninguno con ese criterio.'}
          </p>
        )}

        {visibles.map((r) => {
          const cat = categorias.find((c) => c.uuid === r.categoryUuid)
          const esGasto = r.type === 'GASTO'
          return (
            <div key={r.uuid} className="border-b border-border/60 py-2.5">
              {/* Mismas dos líneas que en categorías: concepto e importe
                  arriba, periodicidad y acciones abajo. En escritorio los
                  envoltorios desaparecen (`sm:contents`) y el orden original
                  lo recupera `sm:order-*`. */}
              <div
                className={cn(
                  'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2',
                  !r.active && 'opacity-55',
                )}>
                <div className="flex min-w-0 items-center gap-2 sm:contents">
                  <Tooltip texto={cat ? etiquetaCategoria(cat) : 'Sin categoría'}>
                    <span
                      className="inline-block size-3 shrink-0 rounded"
                      style={{ background: cat?.color ?? SIN_CATEGORIA }}
                    />
                  </Tooltip>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.concept}</span>
                  <span
                    className={cn(
                      'shrink-0 text-[13px] font-semibold tabular-nums sm:order-2',
                      esGasto ? 'text-danger' : 'text-success',
                    )}>
                    {esGasto ? '−' : '+'}
                    {eur(r.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 max-sm:ml-5 sm:contents">
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:order-1 sm:flex-none sm:shrink-0">
                    {etiquetaPeriodo(r.intervalMonths)}
                    {' · '}
                    {r.active ? `próximo ${fmtDiaAnio(r.nextDate, hoy)}` : 'en pausa'}
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 sm:order-3">
                    {/* Lo de menos uso (apuntar ya, duplicar, ver lo apuntado)
                        se despliega en línea: en la fila serían seis iconos. */}
                    <Tooltip texto="Apuntar ahora, duplicar y ver lo apuntado">
                    <button
                      type="button"
                      className={btnIcon}
                      aria-label={`Más de ${r.concept}`}
                      aria-expanded={detalle === r.uuid}
                      onClick={() => abrirDetalle(r)}>
                      <ChevronDown
                        className={cn('size-3.5 transition-transform', detalle === r.uuid && 'rotate-180')}
                      />
                    </button>
                    </Tooltip>
                    {/* El chevron se queda FUERA del menú: no es una acción,
                        es un despliegue — y meter un "ver más" dentro de otro
                        "ver más" son dos toques para lo mismo. */}
                    <MenuAcciones
                      etiqueta={r.concept}
                      acciones={[
                        {
                          id: 'pausar',
                          label: r.active ? 'Pausar' : 'Reactivar',
                          icon: r.active ? (
                            <Pause className="size-3.5" />
                          ) : (
                            <Check className="size-3.5" />
                          ),
                          disabled: pending,
                          onClick: () =>
                            run(
                              updateRecurrente(r.uuid, { active: !r.active }),
                              r.active ? 'Recurrente en pausa' : 'Recurrente reactivado',
                            ),
                        },
                        {
                          id: 'editar',
                          label: 'Editar',
                          icon: <Pencil className="size-3.5" />,
                          onClick: () => {
                            setDetalle(null)
                            setBorrador(borradorDe(r))
                            setEditando(r)
                            setAbierto(true)
                          },
                        },
                        {
                          id: 'eliminar',
                          label: 'Eliminar',
                          icon: <Trash2 className="size-3.5" />,
                          destructiva: true,
                          onClick: async () => {
                            if (
                              await confirmar({
                                clave: 'borrar-recurrente',
                                titulo: 'Eliminar el recurrente',
                                texto: `«${r.concept}» dejará de apuntarse. Los movimientos que ya generó se quedan como están.`,
                              })
                            ) {
                              run(deleteRecurrente(r.uuid), `${r.concept} eliminado`)
                            }
                          },
                        },
                      ]}
                    />
                  </span>
                </div>
              </div>

              {/* Detalle: apuntar ya, duplicar y lo que lleva apuntado. */}
              {detalle === r.uuid && (
                <div className="mt-2 flex flex-col gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
                  {/* En móvil, un botón por fila: "Apuntar el cargo del 03/09"
                      no cabe en media fila y se partía en dos líneas. */}
                  <div className="flex flex-wrap items-center gap-2 max-sm:flex-col max-sm:items-stretch">
                    <Tooltip texto="Hace lo mismo que hará el cron, pero ya" envuelto={pending}>
                    <button
                      type="button"
                      className={cn(btnOutline, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
                      disabled={pending}
                      onClick={() =>
                        run(apuntarRecurrenteAhora(r.uuid), 'Cargo apuntado', () => setDetalle(null))
                      }>
                      <PlayCircle className="size-3.5" />
                      Apuntar el cargo del {fmtDiaAnio(r.nextDate, hoy)}
                    </button>
                    </Tooltip>
                    <Tooltip texto="Dar de alta otro igual, cambiando lo que haga falta">
                      <button
                        type="button"
                        className={cn(btnOutline, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
                        onClick={() => duplicar(r)}>
                        <Copy className="size-3.5" />
                        Duplicar
                      </button>
                    </Tooltip>
                  </div>

                  {/* Lo que ha apuntado: la lista se pide al abrir el detalle. */}
                  {r.generados === 0 ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      Todavía no ha apuntado ningún movimiento.
                    </p>
                  ) : cargados === null ? (
                    <p className="text-[12.5px] text-muted-foreground">Cargando lo apuntado...</p>
                  ) : cargados === 'error' ? (
                    <p className="text-[12.5px] text-muted-foreground">
                      No se ha podido cargar lo apuntado.{' '}
                      {r.generados === 1
                        ? 'El movimiento sigue'
                        : `Los ${r.generados} movimientos siguen`}{' '}
                      en la lista de su mes.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p className="text-[12.5px] font-semibold text-muted-foreground">
                        Ha apuntado {cargados.total}{' '}
                        {cargados.total === 1 ? 'movimiento' : 'movimientos'}
                      </p>
                      {cargados.movimientos.map((m) => (
                        <span
                          key={m.uuid}
                          className="flex items-center gap-2 text-[12.5px] tabular-nums">
                          <span className="w-24 shrink-0 text-muted-foreground">
                            {fmtDiaAnio(m.expenseDate, hoy)}
                          </span>
                          <span
                            className={cn(
                              'font-semibold',
                              m.type === 'GASTO' ? 'text-danger' : 'text-success',
                            )}>
                            {m.type === 'GASTO' ? '−' : '+'}
                            {eur(m.amount)}
                          </span>
                        </span>
                      ))}
                      {cargados.total > cargados.movimientos.length && (
                        <span className="text-[12px] text-muted-foreground">
                          y {cargados.total - cargados.movimientos.length} más, en la lista de
                          movimientos de su mes.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )
        })}

      </div>

      {/* Alta y edición en el mismo modal: seis campos no caben en la fila. */}
      {abierto && (
        <Modal
          title={editando ? `Editar «${editando.concept}»` : 'Nuevo recurrente'}
          description="La fecha es la del próximo cargo: si ya ha pasado, se apuntará en la siguiente pasada del aviso diario."
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || !borrador.concept.trim() || borrador.amount === null}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <FormRecurrente
            valor={borrador}
            onChange={setBorrador}
            categorias={categorias}
            onGuardar={guardar}
          />
        </Modal>
      )}
    </section>
  )
}

// ─────────── años de ahorro ───────────

interface BorradorAnio {
  year: number | null
  goal: number | null
}

/**
 * Años del sistema de ahorro: crear, renombrar, cambiar el objetivo, exportar
 * a Excel y eliminar.
 *
 * Estaba en el modal «Gestionar años» de las pestañas de Ahorro. Se trajo aquí
 * el 28/08/2026 para que toda la configuración de Finanzas viva en un sitio;
 * las pestañas de Ahorro se quedan solo para navegar entre años.
 */
function PanelAnios({ years }: { years: YearSummary[] }) {
  const [pending, startTransition] = useTransition()
  const confirmar = useConfirmar()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<YearSummary | null>(null)
  const [borrador, setBorrador] = useState<BorradorAnio>({ year: null, goal: null })

  const run = (promise: Accion, success: string, luego?: () => void) =>
    startTransition(async () => {
      const res = await promise
      if (!res.ok) return void toast.error(res.message ?? 'Error')
      toast.success(success)
      luego?.()
    })

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
  }

  const abrirAlta = () => {
    // Propone el siguiente al último creado: es lo que se hace el 99% de las veces.
    const ultimo = years[years.length - 1]?.year ?? new Date().getFullYear() - 1
    setBorrador({ year: ultimo + 1, goal: null })
    setEditando(null)
    setAbierto(true)
  }

  const guardar = () => {
    if (borrador.year === null) return
    if (editando) {
      run(
        updateYear(editando.uuid, { year: borrador.year, goal: borrador.goal }),
        'Año actualizado',
        cerrar,
      )
      return
    }
    run(createYear({ year: borrador.year, goal: borrador.goal }), `Año ${borrador.year} creado`, cerrar)
  }

  // Objetivo del año en curso, si lo hay: es el dato que se consulta.
  const enCurso = years.find((y) => y.year === new Date().getFullYear())
  const resumen = [
    `${years.length} ${years.length === 1 ? 'año' : 'años'}`,
    enCurso?.goal ? `objetivo de ${enCurso.year}: ${eur(enCurso.goal)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={cardClass}>
      <Cabecera
        icono={<CalendarRange className="size-4 text-primary" />}
        titulo="Años de ahorro"
        resumen={resumen}>
        <button
          type="button"
          className={cn(btnPrimary, 'px-2.5 py-1 text-[12.5px] max-sm:py-2')}
          onClick={abrirAlta}>
          <Plus className="size-3.5" /> Nuevo
        </button>
      </Cabecera>

      <div className="px-5 py-3">
        {years.length === 0 && (
          <p className="py-1 text-[13px] text-muted-foreground">
            Ningún año todavía. Con «Nuevo» creas el primero y ya puedes rellenar sus meses.
          </p>
        )}

        {years.map((y) => (
          <div key={y.uuid} className="border-b border-border/60 py-2">
            {/* Dos líneas en móvil, una en escritorio, como los otros bloques. */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex min-w-0 items-center gap-2 sm:contents">
                <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums">{y.year}</span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                  {y.goal === null ? 'Sin objetivo' : `${eur(y.goal)} al año`}
                </span>
              </div>
              <div className="flex items-center gap-2 sm:contents">
                <span className="min-w-0 flex-1 text-[12px] text-muted-foreground sm:flex-none sm:shrink-0">
                  {mesesRellenos(y)}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  {/* Descarga del Excel del año (route handler con guarda propia).
                      `download`: es una descarga, no una navegación — así la barra
                      de carga global no se dispara con este enlace. */}
                  <Tooltip texto="Descargar Excel">
                    <a
                      className={btnIcon}
                      href={`/app/finance/exportar?year=${y.year}`}
                      download
                      aria-label={`Descargar Excel de ${y.year}`}>
                      <FileDown className="size-3.5" />
                    </a>
                  </Tooltip>
                  <button
                    type="button"
                    className={btnIcon}
                    aria-label={`Editar ${y.year}`}
                    onClick={() => {
                      setBorrador({ year: y.year, goal: y.goal })
                      setEditando(y)
                      setAbierto(true)
                    }}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn(btnIcon, 'hover:bg-danger-bg hover:text-danger')}
                    aria-label={`Eliminar ${y.year}`}
                    onClick={async () => {
                      // SIN `clave`: borrar un año se lleva todo su detalle y
                      // no hay deshacer. Esto se pregunta siempre.
                      if (
                        await confirmar({
                          titulo: `Eliminar ${y.year}`,
                          texto: `Se borra el año con todo su detalle (${mesesRellenos(y)}, ingresos extra y viajes). Los movimientos de Gastos no se tocan: no cuelgan del año.`,
                        })
                      ) {
                        run(deleteYear(y.uuid), `Año ${y.year} eliminado`)
                      }
                    }}>
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {abierto && (
        <Modal
          title={editando ? `Editar ${editando.year}` : 'Nuevo año de ahorro'}
          description="El objetivo es opcional: sin él, el año funciona igual pero sin barra de progreso ni proyección."
          onClose={cerrar}
          footer={
            <>
              <button type="button" className={btnOutline} onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={pending || borrador.year === null}
                onClick={guardar}>
                {editando ? 'Guardar' : 'Crear'}
              </button>
            </>
          }>
          <div className="flex flex-col gap-3">
            <Field label="Año">
              <NumberField
                className="w-32"
                step={1}
                ariaLabel="Año"
                value={borrador.year}
                onChange={(v) => setBorrador((b) => ({ ...b, year: v }))}
              />
            </Field>
            <Field label="Objetivo de ahorro">
              <NumberField
                className="w-32"
                step={50}
                placeholder="Sin objetivo"
                ariaLabel="Objetivo anual"
                value={borrador.goal}
                onChange={(v) => setBorrador((b) => ({ ...b, goal: v }))}
                onEnter={guardar}
              />
            </Field>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** "8 meses rellenos" — los que tienen ahorro general apuntado. */
function mesesRellenos(y: YearSummary) {
  const n = y.generalPorMes.filter((v) => v !== null).length
  if (n === 0) return 'sin meses rellenos'
  return `${n} ${n === 1 ? 'mes relleno' : 'meses rellenos'}`
}
