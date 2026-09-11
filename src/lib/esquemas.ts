// Esquemas Zod de todo lo que entra por server action o API, en un solo sitio y con
// los límites de las columnas. Sin `server-only`; no se importa desde el cliente.
import { z } from 'zod'

// Dos trampas de Zod: `z.coerce.number()` en unión con `z.null()` convierte null en
// 0 (el null se atiende a mano), y un campo con `.transform()` sigue siendo obligatorio.

// ─────────── Piezas comunes ───────────

/** Identificador de negocio (`VarChar(36)`). No valida el formato uuid: Prisma
 *  parametriza y la BD mezcla v1 y v4. Sí rechaza vacío, null y cadenas absurdas. */
export const Uuid = z
  .string({ error: 'Falta el identificador' })
  .trim()
  .min(1, { error: 'Falta el identificador' })
  .max(36, { error: 'Identificador no válido' })

/** Identificador de un desplegable con "ninguno": cadena vacía y null son lo mismo.
 *  `.nullish()` antes del transform. En edición, omitir la clave pone null. */
export const uuidOpcional = z
  .union([Uuid, z.literal('')])
  .nullish()
  .transform((v) => v || null)

/** Texto obligatorio: se recorta y se limita al ancho de su columna. */
export const textoObligatorio = (max: number, nombre: string) =>
  z
    .string({ error: `${nombre} es obligatorio` })
    .transform((s) => s.trim().slice(0, max))
    .refine((s) => s.length > 0, { error: `${nombre} es obligatorio` })

/** Texto opcional: recortado, limitado y vacío → null. Distinguir "" de null no
 *  aporta y obliga a comprobar las dos cosas. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => {
      const t = (v ?? '').trim().slice(0, max)
      return t === '' ? null : t
    })

/** Importe en euros (`Decimal(12,2)`). El tope es el de la columna: sin él una
 *  cifra absurda revienta contra MySQL. Acepta texto porque los Atajos mandan cadena. */
/** Texto o número → número. Acepta la coma decimal («12,50»), que es lo que
 *  manda un Atajo de iOS: así la regla vale igual por las dos puertas. */
const aNumero = (v: string | number) =>
  typeof v === 'number' ? v : Number(v.trim().replace(',', '.'))

export const importe = (nombre = 'El importe') =>
  z
    .union([z.number(), z.string()], { error: `${nombre} no es válido` })
    .transform(aNumero)
    .refine((n) => Number.isFinite(n), { error: `${nombre} no es válido` })
    .refine((n) => n >= 0, { error: `${nombre} no puede ser negativo` })
    .refine((n) => n < 1e10, { error: `${nombre} es demasiado grande` })

/** Importe opcional (null = sin valor). */
export const importeOpcional = (nombre = 'El importe') =>
  z
    .union([z.number(), z.string()], { error: `${nombre} no es válido` })
    .nullish()
    .transform((v) => (v === null || v === undefined ? null : aNumero(v)))
    .refine((n) => n === null || Number.isFinite(n), { error: `${nombre} no es válido` })
    .refine((n) => n === null || n >= 0, { error: `${nombre} no puede ser negativo` })
    .refine((n) => n === null || n < 1e10, { error: `${nombre} es demasiado grande` })

/** Fecha 'AAAA-MM-DD'. Se queda en texto: convertirla es de quien la usa. */
export const fechaIso = (nombre = 'La fecha') =>
  z
    .string({ error: `${nombre} es obligatoria` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${nombre} no es válida` })

/** Mes 'AAAA-MM'. */
export const mesIso = z
  .string({ error: 'Falta el mes' })
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'El mes debe tener la forma AAAA-MM' })

// ─────────── Ahorro anual (finance/actions) ───────────

/** Año del ahorro, 2000-2100: fuera de la horquilla solo hay dedazos. */
const anio = z
  .number({ error: 'Indica un año válido' })
  .int({ error: 'Indica un año válido' })
  .min(2000, { error: 'Indica un año válido' })
  .max(2100, { error: 'Indica un año válido' })

/** Objetivo del año: null o una cifra positiva (un 0 es "sin objetivo"). */
const objetivo = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'number' ? v : Number(v)
    // Un 0, un vacío o una cifra imposible son todos "sin objetivo": es un
    // campo que se deja en blanco, no algo que haya que corregir.
    return Number.isFinite(n) && n > 0 && n < 1e10 ? n : null
  })

export const AnioNuevo = z.object({ year: anio, goal: objetivo })

export const AnioEdicion = z.object({
  year: anio.optional(),
  goal: objetivo.optional(),
})

/** Concepto + importe: lo comparten los ingresos extra y los gastos de viaje. */
export const ConceptoImporte = z.object({
  concept: textoObligatorio(255, 'El concepto'),
  amount: importe(),
})

/** Una fila del control mensual. */
// `z.unknown()` y no una unión: lo que no vale se sanea a null en vez de tumbar la
// fila. Son doce meses enviados a la vez y un NaN no puede costar los otros once.
const cifraMes = z.unknown().transform((v) => {
  // El null va PRIMERO y a mano: ver la trampa 1 de arriba. Un mes sin
  // rellenar tiene que seguir siendo null, no un 0.
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  // Admite negativos (un mes puede ir en contra) pero no cifras imposibles.
  return Number.isFinite(n) && Math.abs(n) < 1e10 ? n : null
})

export const MesAhorro = z.object({
  month: z.number().int().min(1).max(12),
  income: cifraMes,
  savingGeneral: cifraMes,
  savingTravel: cifraMes,
})

/** El control mensual llega en bloque. Las filas con mes imposible se descartan en
 *  vez de tumbar el guardado: perder once buenas por una mala sería peor. */
export const MesesAhorro = z
  .array(z.unknown())
  .min(1, { error: 'Nada que guardar' })
  .transform((filas) =>
    filas.map((f) => MesAhorro.safeParse(f)).filter((r) => r.success).map((r) => r.data),
  )
  .refine((filas) => filas.length > 0, { error: 'Nada que guardar' })

// ─────────── Movimientos, categorías y recurrentes (gastos-actions) ───────────

export const TipoMovimiento = z.enum(['INGRESO', 'GASTO'], {
  error: 'Indica si es un ingreso o un gasto',
})

/** Nota libre de un movimiento: texto plano, nunca HTML (se pinta como texto). */
export const NOTA_MOVIMIENTO_MAX = 1000

export const MovimientoAlta = z.object({
  type: TipoMovimiento,
  concept: textoObligatorio(255, 'El concepto'),
  amount: importe(),
  expenseDate: fechaIso('La fecha del movimiento'),
  categoryUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
  note: textoOpcional(NOTA_MOVIMIENTO_MAX),
})

/** En la edición todo es opcional: se aplica un parche con lo que venga. */
export const MovimientoEdicion = z.object({
  type: TipoMovimiento.optional(),
  concept: textoObligatorio(255, 'El concepto').optional(),
  amount: importe().optional(),
  expenseDate: fechaIso('La fecha del movimiento').optional(),
  categoryUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
  note: textoOpcional(NOTA_MOVIMIENTO_MAX).optional(),
})

/** Una parte de un movimiento dividido. */
export const ParteDivision = z.object({
  concept: textoOpcional(255),
  amount: importe(),
  categoryUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
})

/** Como mucho diez partes: repartir entre más no es dividir, es teclear la compra. */
export const MAX_PARTES = 10

export const PartesDivision = z
  .array(ParteDivision, { error: 'Indica al menos dos partes' })
  .min(2, { error: 'Indica al menos dos partes' })
  .max(MAX_PARTES, { error: `Como mucho ${MAX_PARTES} partes` })

/** Tope mensual de una categoría: null es "sin tope" y 0 la misma intención. */
export const tope = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null
    if (typeof v === 'string' && v.trim() === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n) || n < 0 || n >= 1e10) return undefined // lo rechaza el refine
    return n === 0 ? null : n
  })
  .refine((v) => v !== undefined, { error: 'Tope no válido' })
  .transform((v) => v as number | null)

/** 100 caracteres: es el ancho de `expense_category.name`. */
const nombreCategoria = textoObligatorio(100, 'El nombre')

export const CategoriaNueva = z.object({
  name: nombreCategoria,
  // El mensaje es el de la categoría, no el del movimiento.
  type: z.enum(['INGRESO', 'GASTO'], {
    error: 'Indica si la categoría es de ingreso o de gasto',
  }),
  // Un GRUPO en vez de una categoría: contenedor que agrupa y no se apunta.
  isGroup: z.boolean().nullish().transform((v) => v ?? false),
  // Grupo del que cuelga (vacío = suelta). Que EXISTA, sea un grupo y sea del
  // mismo tipo lo comprueba la action, que es quien consulta la BD.
  parentUuid: uuidOpcional,
  budget: tope,
})

export const CategoriaEdicion = z.object({
  name: nombreCategoria.optional(),
  budget: tope.optional(),
})

/** Periodicidad en meses, de 1 a 120. Solo una cota de sensatez: quien frena la
 *  generación es `MAX_CARGOS`. */
export const periodicidadMeses = z
  .number({ error: 'Periodicidad no válida' })
  .int({ error: 'La periodicidad va en meses enteros' })
  .min(1, { error: 'La periodicidad debe ser de 1 a 120 meses' })
  .max(120, { error: 'La periodicidad debe ser de 1 a 120 meses' })

export const RecurrenteAlta = z.object({
  type: TipoMovimiento,
  concept: textoObligatorio(255, 'El concepto'),
  amount: importe(),
  intervalMonths: periodicidadMeses,
  nextDate: fechaIso('La fecha del próximo cargo'),
  categoryUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
    // Sin `coerce`: `Boolean("false")` es `true`, y estos valores vienen de
  // nuestra propia interfaz como booleanos de verdad.
  active: z.boolean().optional(),
})

export const RecurrenteEdicion = z.object({
  type: TipoMovimiento.optional(),
  concept: textoObligatorio(255, 'El concepto').optional(),
  amount: importe().optional(),
  intervalMonths: periodicidadMeses.optional(),
  nextDate: fechaIso('La fecha del próximo cargo').optional(),
  categoryUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
    // Sin `coerce`: `Boolean("false")` es `true`, y estos valores vienen de
  // nuestra propia interfaz como booleanos de verdad.
  active: z.boolean().optional(),
})

// ─────────── Usuarios, tokens y ámbitos (panel/actions) ───────────

export const Rol = z.enum(['ADMIN', 'USER'])
export const Estado = z.enum(['ACTIVE', 'DISABLED'])

export const UsuarioInvitado = z.object({
  email: z
    .string({ error: 'El correo es obligatorio' })
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s.length > 0, { error: 'El correo es obligatorio' })
    .refine((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), { error: 'Correo no válido' })
    .refine((s) => s.length <= 255, { error: 'Correo demasiado largo' }),
  // Un rol desconocido degrada a USER en vez de fallar: es el valor seguro, y
  // un cliente manipulado no debe poder colarse como admin ni por error.
  role: z
    .unknown()
    .transform((v) => (v === 'ADMIN' ? ('ADMIN' as const) : ('USER' as const))),
})

export const UsuarioEdicion = z.object({
  role: Rol.optional(),
  status: Estado.optional(),
})

export const TokenNuevo = z.object({
  name: textoObligatorio(80, 'El nombre'),
})

export const NOMBRE_AMBITO_MAX = 60

export const Ambito = z.object({
  name: textoObligatorio(NOMBRE_AMBITO_MAX, 'El nombre'),
})

// ─────────── Mantenimiento y recordatorios (panel/actions) ───────────

export const TareaAlta = z.object({
  title: textoObligatorio(255, 'El título'),
  scopeUuid: uuidOpcional,
  notes: textoOpcional(5000),
  // null = no se repite: es un recordatorio puntual (ver `mantenimiento.ts`).
  intervalMonths: periodicidadMeses.nullish().transform((v) => v ?? null),
  nextDue: fechaIso('La fecha de vencimiento'),
})

export const TareaEdicion = z.object({
  title: textoObligatorio(255, 'El título').optional(),
  scopeUuid: uuidOpcional,
  notes: textoOpcional(5000).optional(),
  intervalMonths: periodicidadMeses.nullish().transform((v) => v ?? null),
  nextDue: fechaIso('La fecha de vencimiento').optional(),
})

// ─────────── Notas (panel/actions) ───────────

export const NOTA_TITULO_MAX = 255
// El contenido es HTML del editor: el tope va más alto que el texto, lejos del
// límite de TEXT (64 KB) y sin dejar llenar la columna.
export const NOTA_CONTENIDO_MAX = 50_000

export const Nota = z.object({
  title: textoOpcional(NOTA_TITULO_MAX),
  // El saneado del HTML NO va aquí: es de `alta-nota.ts`, que es el punto donde
  // el contenido pasa a ser de fiar. Aquí solo se recorta.
  content: z
    .string()
    .nullish()
    .transform((v) => (v ?? '').slice(0, NOTA_CONTENIDO_MAX)),
})

/** Índice de un ítem de la checklist de una nota. */
export const indiceTarea = z
  .number({ error: 'Índice no válido' })
  .int({ error: 'Índice no válido' })
  .min(0, { error: 'Índice no válido' })
  .max(999, { error: 'Índice no válido' })

// ─────────── Pipeline (pipeline/actions) ───────────

export const EstadoOportunidad = z.enum(
  ['CONTACTO', 'CONVERSACION', 'PROPUESTA', 'CERRADO', 'DESCARTADO'],
  { error: 'Estado no válido' },
)

/** El título es el único campo obligatorio de una oportunidad. */
export const TituloOportunidad = textoObligatorio(255, 'El título')

/** Campos de relleno de una oportunidad, todos opcionales, sin estado ni título:
 *  un estado inventado degrada al inicial en vez de fallar el alta. */
export const CamposOportunidad = z.object({
  company: textoOpcional(255),
  contact: textoOpcional(255),
  origin: textoOpcional(100),
  amount: importeOpcional(),
  notes: textoOpcional(5000),
  nextAction: textoOpcional(255),
  // Una fecha malformada es "sin seguimiento", no error: los campos del proyecto
  // emiten ISO válido y aquí solo llega basura de un cliente manipulado.
  nextActionDate: z
    .string()
    .nullish()
    .transform((v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
})

/** La oportunidad completa: los campos, más el título y el estado. */
export const OportunidadAlta = CamposOportunidad.extend({
  title: TituloOportunidad,
  status: EstadoOportunidad,
})

export const EventoOportunidad = z.object({
  // 'ESTADO' lo apunta el sistema y no se admite desde el cliente: el historial
  // de cambios de estado no se falsifica.
  type: z.enum(['NOTA', 'LLAMADA', 'EMAIL', 'REUNION'], { error: 'Tipo de evento no válido' }),
  detail: textoObligatorio(2000, 'El detalle'),
})

// ─────────── El validador ───────────

export type Validado<T> = { ok: true; datos: T } | { ok: false; message: string }

/** Valida y devuelve el contrato del proyecto. Solo el primer mensaje: las actions
 *  contestan con un texto, que es lo que cabe en un toast. */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown): Validado<T> {
  const res = esquema.safeParse(datos)
  if (res.success) return { ok: true, datos: res.data }
  const primero = res.error.issues[0]
  return { ok: false, message: primero?.message || 'Datos no válidos' }
}
