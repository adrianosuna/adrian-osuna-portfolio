// Esquemas de validación (Zod) de todo lo que entra por una server action o
// por la API. UN solo sitio.
//
// Qué resuelve. Cada action traía su propia tanda de comprobaciones a mano
// (`Number.isFinite`, `.trim().slice(255)`, un regex de fecha, un `includes`
// para el enum...), repetidas de fichero en fichero con variaciones. Eso tiene
// dos problemas: los topes se desincronizan del esquema de la BD —y entonces
// el fallo llega como el "Error inesperado" genérico en vez de un mensaje
// legible— y cada validación nueva se escribe otra vez.
//
// Aquí los límites son los de las columnas y se declaran una vez. Los mensajes
// van en **español y en primera persona del formulario** porque viajan tal cual
// al cliente en `{ ok: false, message }`: son lo que lee quien se ha equivocado.
//
// ⚠ Sin `server-only`: los comparten las server actions, la API v1 y los tests
// (mismo criterio que `fechas.ts`). Y **no se importa desde componentes de
// cliente**: el navegador no necesita revalidar nada, y así Zod no entra en el
// bundle.
import { z } from 'zod'

// ⚠ DOS TRAMPAS de Zod que ya costaron un fallo aquí y explican por qué los
// campos opcionales se escriben como se escriben:
//
//  1. **`z.coerce.number()` dentro de un `union` con `z.null()`** no hace lo
//     que parece: la unión prueba las opciones EN ORDEN, y `Number(null)` es
//     `0`, así que un `null` se convertía en un 0 antes de llegar a
//     `z.null()`. En el control mensual del ahorro eso significa escribir un
//     cero donde el mes estaba SIN RELLENAR — que es justo lo que el módulo
//     distingue para avisar por correo. Por eso aquí no se usa `coerce` en
//     uniones: el `null` se atiende primero, a mano, dentro del transform.
//  2. Un campo con `.transform()` **sigue siendo obligatorio**: si la clave
//     no viene, Zod falla con "expected nonoptional". Para que se pueda
//     omitir hay que marcarlo `.nullish()` ANTES del transform.

// ─────────── Piezas comunes ───────────

/**
 * Identificador de negocio (columna `VarChar(36)`).
 *
 * ⚠ NO comprueba el formato de un uuid, y es deliberado. Prisma parametriza
 * las consultas, así que un identificador con mala pinta no inyecta nada: en
 * el peor caso no encuentra fila. Lo que sí hace falta es descartar el vacío,
 * el null y las cadenas absurdas —que son los que llegan de un cliente
 * manipulado o de un bug— para contestar con un mensaje claro en vez de dejar
 * que Prisma reviente y salga el "Error inesperado" genérico.
 *
 * Exigir el formato canónico tampoco valdría de mucho: la BD viene heredada
 * del Portfolio antiguo y conviven uuids de versión 1 (los que sembró MySQL)
 * con los v4 de Prisma. Y donde el identificador viene de fuera de verdad
 * —la API— lo que se comprueba es que la fila EXISTA, que es la garantía que
 * de verdad importa (ver `resolverCategoria` y `altaMovimiento`).
 */
export const Uuid = z
  .string({ error: 'Falta el identificador' })
  .trim()
  .min(1, { error: 'Falta el identificador' })
  .max(36, { error: 'Identificador no válido' })

/** Texto obligatorio: se recorta y se limita al ancho de su columna. */
export const textoObligatorio = (max: number, nombre: string) =>
  z
    .string({ error: `${nombre} es obligatorio` })
    .transform((s) => s.trim().slice(0, max))
    .refine((s) => s.length > 0, { error: `${nombre} es obligatorio` })

/**
 * Texto opcional: se recorta, se limita, y **vacío se guarda como null**.
 *
 * Distinguir "" de null en la BD no aporta nada y sí obliga a comprobar las dos
 * cosas en cada lectura.
 */
export const textoOpcional = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => {
      const t = (v ?? '').trim().slice(0, max)
      return t === '' ? null : t
    })

/**
 * Importe en euros: `Decimal(12,2)` en la BD.
 *
 * El tope es el de la columna (no el de JavaScript): sin él, una cifra absurda
 * de un cliente manipulado revienta contra MySQL y al usuario le llega el
 * "Error inesperado" genérico. Se acepta texto porque los Atajos de iOS mandan
 * el importe como cadena.
 */
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

/**
 * Año del sistema de ahorro. La horquilla 2000-2100 no es arbitraria: fuera de
 * ella solo hay dedazos, y un año de cuatro cifras raro descuadraría las
 * pestañas y los informes.
 */
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
// `z.unknown()` y no una unión de tipos: aquí lo que no vale se SANEA a null
// en vez de tumbar la fila. Es una tabla de doce meses que se envía completa,
// y un NaN suelto en una celda no puede costar el guardado de las otras once
// (`z.number()` además rechaza NaN, así que la unión fallaba de golpe).
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

/**
 * El guardado del control mensual llega en bloque.
 *
 * Las filas con un mes imposible se **descartan** en vez de tumbar el guardado
 * entero: es una tabla de doce filas que se envía completa, y perder el trabajo
 * de las once buenas por una mala sería el peor de los dos comportamientos.
 */
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

/**
 * Tope mensual de una categoría: null es "sin tope", y un 0 es la misma
 * intención (quitarlo), así que los dos guardan null.
 */
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
  budget: tope,
})

export const CategoriaEdicion = z.object({
  name: nombreCategoria.optional(),
  budget: tope.optional(),
})

/**
 * Periodicidad en meses: de 1 a 120 (hasta cada 10 años). El tope no protege de
 * nada —`cargosPendientes` frena la generación con `MAX_CARGOS`— y es solo una
 * cota de sensatez, alineada con la ventana de fecha del cargo.
 */
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
  scopeUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
  notes: textoOpcional(5000),
  // null = no se repite: es un recordatorio puntual (ver `mantenimiento.ts`).
  intervalMonths: periodicidadMeses.nullish().transform((v) => v ?? null),
  nextDue: fechaIso('La fecha de vencimiento'),
})

export const TareaEdicion = z.object({
  title: textoObligatorio(255, 'El título').optional(),
  scopeUuid: z.union([Uuid, z.literal('')]).nullish().transform((v) => v || null),
  notes: textoOpcional(5000).optional(),
  intervalMonths: periodicidadMeses.nullish().transform((v) => v ?? null),
  nextDue: fechaIso('La fecha de vencimiento').optional(),
})

// ─────────── Notas (panel/actions) ───────────

export const NOTA_TITULO_MAX = 255
// El contenido es HTML del editor, así que el tope va más alto que el texto que
// representa (etiquetas de por medio). Cabe un apunte largo lejos del límite de
// TEXT (64 KB) y evita que un cliente manipulado llene la columna.
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

/**
 * Los campos "de relleno" de una oportunidad, TODOS opcionales y sin el
 * estado ni el título.
 *
 * Van aparte porque los tres se tratan distinto y mezclarlos rompía el
 * comportamiento: el título es obligatorio, y un **estado inventado degrada
 * al inicial** en vez de fallar (un cliente manipulado no debe poder tumbar
 * el alta, solo quedarse en CONTACTO). Con el estado dentro de este esquema,
 * validarlo aquí hacía fallar el alta entera.
 */
export const CamposOportunidad = z.object({
  company: textoOpcional(255),
  contact: textoOpcional(255),
  origin: textoOpcional(100),
  amount: importeOpcional(),
  notes: textoOpcional(5000),
  nextAction: textoOpcional(255),
  // Una fecha malformada se trata como "sin seguimiento" y no como error: los
  // campos de fecha del proyecto solo emiten ISO válido, así que aquí solo
  // llega basura de un cliente manipulado — y descartarla es más útil que
  // impedir guardar la oportunidad.
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

/**
 * Valida y devuelve el contrato del proyecto.
 *
 * Solo se devuelve **el primer mensaje**: las actions contestan
 * `{ ok, message? }` con UN texto, que es lo que el toast puede mostrar. Una
 * lista de cinco errores no cabe en un aviso y tampoco hace falta — los
 * formularios son cortos y se corrige de uno en uno.
 */
export function validar<T>(esquema: z.ZodType<T>, datos: unknown): Validado<T> {
  const res = esquema.safeParse(datos)
  if (res.success) return { ok: true, datos: res.data }
  const primero = res.error.issues[0]
  return { ok: false, message: primero?.message || 'Datos no válidos' }
}
