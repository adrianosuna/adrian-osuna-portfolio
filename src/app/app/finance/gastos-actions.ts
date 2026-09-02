'use server'

// Server actions del control de gastos e ingresos (personal del admin):
// movimientos, recurrentes y categorías (con sus topes). Mismo contrato:
// { ok, message? } y revalidación.
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth'
import { AppError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { hoyMadrid } from '@/lib/mantenimiento'
import { colorLibre } from '@/lib/colores'
import { redondearCentimos } from '@/lib/euros'
import {
  altaMovimiento,
  fechaValida,
  limpiarConceptoImporte,
  limpiarNotaMovimiento,
  tipoValido,
  type DatosAlta,
} from '@/lib/alta-movimiento'
import { CategoriaNueva, textoObligatorio, tope, validar } from '@/lib/esquemas'

/** 100 caracteres: el ancho de `expense_category.name`. */
const NombreCategoria = textoObligatorio(100, 'El nombre')
import { apuntarRecurrenteYa, listCategorias, movimientosDeRecurrente, type CategoriaRow } from '@/lib/gastos'
import { log } from '@/lib/log'
import { avisarFrenado, limitar, LIMITE_ACCIONES } from '@/lib/rate-limit'

type Result = { ok: boolean; message?: string }

const ok: Result = { ok: true }
const fail = (message: string): Result => ({ ok: false, message })
const refresh = () => revalidatePath('/app/finance')

// Genérica para que una acción pueda devolver más que `{ ok, message }` (p. ej.
// el paquete de restauración de un borrado con deshacer). El catch sigue
// devolviendo un `Result` pelado, que encaja porque los extras son opcionales.
async function guarded<T extends Result>(fn: () => Promise<T>): Promise<T | Result> {
  try {
    const sesionActual = await requireAdmin()
    // Freno por usuario: 120 escrituras por minuto no las alcanza nadie
    // pulsando botones, pero sí un bucle en el cliente o un doble envío
    // desbocado — que es lo único de lo que hay que protegerse aquí, porque
    // llegar hasta este punto ya exige sesión de admin.
    const freno = limitar(`accion:${sesionActual.user.uuid}`, LIMITE_ACCIONES)
    if (!freno.ok) {
      avisarFrenado('gastos', `accion:${sesionActual.user.uuid}`, freno.esperaS)
      return fail(`Vas muy rápido: espera ${freno.esperaS} s`)
    }
    return await fn()
  } catch (e) {
    if (e instanceof AppError) return fail(e.message)
    log.error('gastos', 'error inesperado', { error: e })
    return fail('Error inesperado')
  }
}

// Las reglas del movimiento (fecha, concepto/importe, tipo, nota) viven en
// `@/lib/alta-movimiento`, porque las comparte la API de los Atajos de iOS:
// aquí solo se les pone el nombre corto con el que se leen estas acciones.
const fecha = fechaValida
const limpiar = limpiarConceptoImporte
const limpiarNota = limpiarNotaMovimiento

/**
 * Tope mensual de una categoría: número positivo, o null para "sin tope".
 * Vaciar el campo y poner un 0 son la misma intención (quitar el tope), así
 * que las dos guardan null. Devuelve `false` si el valor no vale.
 *
 * La regla es la de `tope` en `lib/esquemas.ts`; aquí solo se adapta al
 * `| false` con el que ya se leían estas actions.
 */
const topeValido = (v: number | null | undefined): number | null | false => {
  const r = tope.safeParse(v)
  return r.success ? r.data : false
}

// ─────────── Gastos ───────────

// Mismos campos que el alta compartida: la interfaz era una copia literal.
type DatosGasto = DatosAlta

/**
 * Categorías para la alta rápida global (el "+" de la barra y la paleta ⌘K),
 * que puede abrirse desde cualquier página del dashboard. Se cargan al abrir el
 * modal en vez de en cada render del layout. Sin permisos devuelve lista vacía:
 * el desplegable sale con solo "Sin categoría".
 */
export async function categoriasParaAlta(): Promise<CategoriaRow[]> {
  try {
    await requireAdmin()
    return await listCategorias()
  } catch {
    return []
  }
}

/**
 * Alta de un movimiento. La validación y la inserción son las de
 * `altaMovimiento`, LAS MISMAS que usa la API de los Atajos: dos puertas al
 * mismo dato con reglas distintas es como se descuadra un mes en silencio.
 */
export async function createGasto(datos: DatosGasto): Promise<Result> {
  return guarded(async () => {
    const res = await altaMovimiento(datos)
    if (res.error !== undefined) return fail(res.error)
    refresh()
    return ok
  })
}

export async function updateGasto(uuid: string, datos: DatosGasto): Promise<Result> {
  return guarded(async () => {
    const patch: Record<string, unknown> = {}
    if (datos.concept !== undefined || datos.amount !== undefined) {
      const parsed = limpiar(datos)
      if (parsed.error !== undefined) return fail(parsed.error)
      patch.concept = parsed.concept
      patch.amount = parsed.amount
    }
    if (datos.expenseDate !== undefined) {
      const dia = fecha(datos.expenseDate)
      if (!dia) return fail('Fecha no válida')
      patch.expenseDate = dia
    }
    if (datos.type !== undefined) {
      if (!tipoValido(datos.type)) return fail('Tipo no válido')
      patch.type = datos.type
    }
    if (datos.categoryUuid !== undefined) patch.categoryUuid = datos.categoryUuid || null
    if (datos.note !== undefined) patch.note = limpiarNota(datos.note)
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.expense.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/** Una parte de un movimiento dividido: su trozo del importe y su categoría. */
interface ParteDivision {
  concept?: string
  amount?: number | null
  categoryUuid?: string | null
}

/** Cuántas partes como mucho: repartir una compra entre más de esto no es
 *  dividir un gasto, es teclear la lista de la compra. */
const MAX_PARTES = 10

/**
 * Divide un movimiento en varias partes, cada una con su categoría.
 *
 * El caso es la compra mixta (supermercado + farmacia en el mismo recibo), que
 * hasta ahora había que borrar y teclear dos veces. Las partes heredan tipo,
 * fecha y nota del original, y **la suma tiene que cuadrar con el importe**: si
 * no, no es una división, es otra cosa — y cuadrarla a medias descuadraría el
 * mes en silencio.
 *
 * Todo en una transacción: se crean las partes y desaparece el original, así
 * que los totales del mes no cambian ni por un instante.
 */
export async function dividirGasto(uuid: string, partes: ParteDivision[]): Promise<Result> {
  return guarded(async () => {
    const original = await prisma.expense.findUnique({ where: { uuid } })
    if (!original) return fail('Ese movimiento no existe')
    if (!Array.isArray(partes) || partes.length < 2) return fail('Indica al menos dos partes')
    if (partes.length > MAX_PARTES) return fail(`Como mucho ${MAX_PARTES} partes`)

    // Cada parte se valida con las mismas reglas que un movimiento normal.
    const limpias: Array<{ concept: string; amount: number; categoryUuid: string | null }> = []
    for (const p of partes) {
      const parsed = limpiar({ concept: p.concept ?? original.concept, amount: p.amount })
      if (parsed.error !== undefined) return fail(parsed.error)
      if (parsed.amount <= 0) return fail('Cada parte necesita un importe mayor que cero')
      limpias.push({ ...parsed, categoryUuid: p.categoryUuid || null })
    }

    // Comparación en céntimos: en decimales, 0.1 + 0.2 no da 0.3.
    const centimos = (v: number) => Math.round(v * 100)
    const suma = limpias.reduce((s, p) => s + centimos(p.amount), 0)
    const total = centimos(Number(original.amount))
    if (suma !== total) {
      const dif = (suma - total) / 100
      return fail(
        dif > 0
          ? `Las partes suman ${dif.toFixed(2)} € de más`
          : `Faltan ${Math.abs(dif).toFixed(2)} € por asignar`,
      )
    }

    await prisma.$transaction([
      prisma.expense.createMany({
        data: limpias.map((p) => ({
          type: original.type,
          concept: p.concept,
          amount: p.amount,
          expenseDate: original.expenseDate,
          categoryUuid: p.categoryUuid,
          note: original.note,
          // El origen recurrente NO se hereda: el cargo que generó el
          // recurrente fue el original, y ya no existe.
        })),
      }),
      prisma.expense.delete({ where: { uuid } }),
    ])
    refresh()
    return { ok: true, message: `Dividido en ${limpias.length} movimientos` }
  })
}

/**
 * Todo lo que hace falta para devolver un movimiento borrado a su sitio.
 *
 * Se devuelve al cliente al borrar, y el botón "Deshacer" del aviso lo manda de
 * vuelta a `restaurarGasto`. Va con su **uuid original**: así el movimiento
 * vuelve a ser el mismo, y no un duplicado con otra identidad.
 */
export interface GastoRestaurable {
  uuid: string
  type: string
  concept: string
  amount: number
  expenseDate: string // 'YYYY-MM-DD'
  categoryUuid: string | null
  recurringUuid: string | null
  note: string | null
}

/**
 * Borra un movimiento y devuelve con qué restaurarlo.
 *
 * No pregunta antes: el aviso de después ofrece deshacerlo, que es mejor que un
 * "¿seguro?" —se puede uno equivocar igual, pero aquí hay marcha atrás—.
 */
export async function deleteGasto(
  uuid: string,
): Promise<Result & { deshacer?: GastoRestaurable }> {
  return guarded(async () => {
    const fila = await prisma.expense.findUnique({ where: { uuid } })
    if (!fila) return fail('Ese movimiento ya no existe')
    await prisma.expense.delete({ where: { uuid } })
    refresh()
    return {
      ok: true,
      deshacer: {
        uuid: fila.uuid,
        type: fila.type,
        concept: fila.concept,
        amount: Number(fila.amount),
        expenseDate: fila.expenseDate.toISOString().slice(0, 10),
        categoryUuid: fila.categoryUuid,
        recurringUuid: fila.recurringUuid,
        note: fila.note,
      },
    }
  })
}

/** Devuelve a su sitio un movimiento recién borrado (botón "Deshacer"). */
export async function restaurarGasto(datos: GastoRestaurable): Promise<Result> {
  return guarded(async () => {
    if (!tipoValido(datos.type)) return fail('Tipo no válido')
    const dia = fecha(datos.expenseDate)
    if (!dia) return fail('Fecha no válida')
    // Si ya existe (doble clic en Deshacer), no se duplica.
    if (await prisma.expense.findUnique({ where: { uuid: datos.uuid } })) {
      refresh()
      return ok
    }
    await prisma.expense.create({
      data: {
        uuid: datos.uuid,
        type: datos.type,
        concept: datos.concept.slice(0, 255),
        amount: redondearCentimos(Number(datos.amount)),
        expenseDate: dia,
        // La categoría o el recurrente pueden haber desaparecido entretanto:
        // el FK es SET NULL, así que se comprueba antes de referenciarlos.
        categoryUuid: datos.categoryUuid
          ? ((await prisma.expenseCategory.findUnique({ where: { uuid: datos.categoryUuid } }))
              ? datos.categoryUuid
              : null)
          : null,
        recurringUuid: datos.recurringUuid
          ? ((await prisma.recurringExpense.findUnique({ where: { uuid: datos.recurringUuid } }))
              ? datos.recurringUuid
              : null)
          : null,
        note: limpiarNota(datos.note),
      },
    })
    refresh()
    return ok
  })
}

// ─────────── Recurrentes ───────────

interface DatosRecurrente {
  type?: string
  concept?: string
  amount?: number | null
  intervalMonths?: number | null
  nextDate?: string | null
  categoryUuid?: string | null
  active?: boolean
}

/**
 * Periodicidad en meses: entre 1 y 120 (hasta cada 10 años). El tope no protege
 * de nada —`cargosPendientes` ya frena la generación con `MAX_CARGOS`— y es solo
 * una cota de sensatez, alineada con la ventana de fecha (`fechaCargo`, ±10
 * años). La UI ofrece las periodicidades comunes y un "Personalizado" con
 * número + unidad (meses/años) para el resto.
 */
const periodoValido = (v: number | null | undefined): number | false => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : false
}

/**
 * Fecha del próximo cargo. Se acepta con hasta un año de retraso —el cron
 * recupera lo pendiente— pero no más: una fecha de 2019 solo puede ser un
 * despiste, y generaría un histórico falso.
 */
const fechaCargo = (v: string | null | undefined, hoyIso: string): Date | false => {
  const dia = fecha(v)
  if (!dia) return false
  const [y, m, d] = hoyIso.split('-').map(Number)
  const minimo = new Date(Date.UTC(y - 1, m - 1, d))
  const maximo = new Date(Date.UTC(y + 10, m - 1, d))
  return dia >= minimo && dia <= maximo ? dia : false
}

export async function createRecurrente(datos: DatosRecurrente): Promise<Result> {
  return guarded(async () => {
    const parsed = limpiar(datos)
    if (parsed.error !== undefined) return fail(parsed.error)
    if (!tipoValido(datos.type)) return fail('Indica si es un ingreso o un gasto')
    const interval = periodoValido(datos.intervalMonths)
    if (interval === false) return fail('Periodicidad no válida')
    const dia = fechaCargo(datos.nextDate, hoyMadrid())
    if (dia === false) return fail('Fecha del próximo cargo no válida')

    await prisma.recurringExpense.create({
      data: {
        ...parsed,
        type: datos.type,
        intervalMonths: interval,
        nextDate: dia,
        // El ancla es el día elegido: lo conserva aunque un mes corto lo recorte.
        dayAnchor: dia.getUTCDate(),
        categoryUuid: datos.categoryUuid || null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateRecurrente(uuid: string, datos: DatosRecurrente): Promise<Result> {
  return guarded(async () => {
    const patch: Record<string, unknown> = {}
    if (datos.concept !== undefined || datos.amount !== undefined) {
      const parsed = limpiar(datos)
      if (parsed.error !== undefined) return fail(parsed.error)
      patch.concept = parsed.concept
      patch.amount = parsed.amount
    }
    if (datos.type !== undefined) {
      if (!tipoValido(datos.type)) return fail('Tipo no válido')
      patch.type = datos.type
    }
    if (datos.intervalMonths !== undefined) {
      const interval = periodoValido(datos.intervalMonths)
      if (interval === false) return fail('Periodicidad no válida')
      patch.intervalMonths = interval
    }
    if (datos.nextDate !== undefined) {
      const dia = fechaCargo(datos.nextDate, hoyMadrid())
      if (dia === false) return fail('Fecha del próximo cargo no válida')
      patch.nextDate = dia
      patch.dayAnchor = dia.getUTCDate()
    }
    if (datos.categoryUuid !== undefined) patch.categoryUuid = datos.categoryUuid || null
    if (datos.active !== undefined) patch.active = Boolean(datos.active)
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.recurringExpense.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/**
 * Apunta ya el cargo de un recurrente, sin esperar a la pasada del cron.
 *
 * Hace lo mismo que haría el cron (mismo movimiento, misma fecha, y adelanta
 * `next_date`), así que cuando llegue el día no se duplica.
 */
export async function apuntarRecurrenteAhora(uuid: string): Promise<Result> {
  return guarded(async () => {
    const res = await apuntarRecurrenteYa(uuid)
    if (res === null) return fail('Ese recurrente no existe')
    if (res.creados === 0) return fail('No había ningún cargo que apuntar')
    refresh()
    return {
      ok: true,
      message:
        res.creados === 1
          ? 'Cargo apuntado'
          : `${res.creados} cargos apuntados (estaba atrasado)`,
    }
  })
}

/** Movimientos que ha generado un recurrente (para el detalle de su fila). */
export async function leerMovimientosDeRecurrente(uuid: string) {
  try {
    await requireAdmin()
    return await movimientosDeRecurrente(uuid)
  } catch {
    // Sin sesión o sin permisos: el detalle simplemente no se pinta.
    return null
  }
}

/** Borra el recurrente. Los movimientos que ya generó NO se tocan: son gasto
 *  real y viven en el histórico como cualquier otro (pierden el origen). */
export async function deleteRecurrente(uuid: string): Promise<Result> {
  return guarded(async () => {
    await prisma.recurringExpense.delete({ where: { uuid } })
    refresh()
    return ok
  })
}

// ─────────── Categorías ───────────

export async function createCategoria(datos: {
  name?: string
  color?: string
  type?: string
  budget?: number | null
}): Promise<Result> {
  return guarded(async () => {
    const v = validar(CategoriaNueva, datos)
    if (!v.ok) return fail(v.message)
    const { name } = v.datos
    // El nombre solo debe ser único DENTRO de su tipo ("Regalos" puede ser
    // categoría de gasto y de ingreso a la vez).
    if (await prisma.expenseCategory.findFirst({ where: { name, type: v.datos.type } })) {
      return fail('Ya existe una categoría con ese nombre')
    }
    // El tope solo tiene sentido en las categorías de gasto: en una de ingreso
    // se ignora en vez de fallar (el formulario ya no lo ofrece).
    const limite = v.datos.budget
    // El color lo pone la aplicación, en el hueco más grande del círculo
    // cromático: elegirlo a mano no aportaba nada y con ocho colores fijos
    // había repetidos a partir de la novena categoría.
    const usados = await prisma.expenseCategory.findMany({ select: { color: true } })
    await prisma.expenseCategory.create({
      data: {
        name,
        type: v.datos.type,
        color: colorLibre(usados.map((c) => c.color)),
        budget: v.datos.type === 'GASTO' ? limite : null,
      },
    })
    refresh()
    return ok
  })
}

export async function updateCategoria(
  uuid: string,
  datos: { name?: string; budget?: number | null },
): Promise<Result> {
  return guarded(async () => {
    const patch: { name?: string; budget?: number | null; notified?: null } = {}
    if (datos.name !== undefined) {
      const n = validar(NombreCategoria, datos.name)
      if (!n.ok) return fail(n.message)
      const name = n.datos
      const actual = await prisma.expenseCategory.findUnique({ where: { uuid } })
      if (!actual) return fail('Categoría no encontrada')
      const otra = await prisma.expenseCategory.findFirst({ where: { name, type: actual.type } })
      if (otra && otra.uuid !== uuid) return fail('Ya existe una categoría con ese nombre')
      patch.name = name
    }
    if (datos.budget !== undefined) {
      const tope = topeValido(datos.budget)
      if (tope === false) return fail('Tope no válido')
      patch.budget = tope
      // Cambiar el tope reinicia la marca de aviso: con el límite nuevo, el
      // estado se vuelve a evaluar desde cero en la siguiente pasada del cron.
      patch.notified = null
    }
    if (!Object.keys(patch).length) return fail('Nada que actualizar')
    await prisma.expenseCategory.update({ where: { uuid }, data: patch })
    refresh()
    return ok
  })
}

/**
 * Fusiona una categoría en otra del MISMO tipo: sus movimientos y sus
 * recurrentes pasan a la de destino y la de origen desaparece.
 *
 * Es la salida limpia a los nombres parecidos que se acumulan con el tiempo
 * ("Comer fuera" y "Restaurantes"), donde hasta ahora solo quedaba borrar una
 * y perder la categoría de su historial.
 */
export async function fusionarCategorias(origenUuid: string, destinoUuid: string): Promise<Result> {
  return guarded(async () => {
    if (origenUuid === destinoUuid) return fail('Elige una categoría distinta')
    const [origen, destino] = await Promise.all([
      prisma.expenseCategory.findUnique({ where: { uuid: origenUuid } }),
      prisma.expenseCategory.findUnique({ where: { uuid: destinoUuid } }),
    ])
    if (!origen || !destino) return fail('Categoría no encontrada')
    // Mezclar un gasto con un ingreso no significa nada: son dos listas.
    if (origen.type !== destino.type) return fail('Las dos categorías deben ser del mismo tipo')

    const [movimientos, recurrentes] = await prisma.$transaction([
      prisma.expense.updateMany({
        where: { categoryUuid: origenUuid },
        data: { categoryUuid: destinoUuid },
      }),
      prisma.recurringExpense.updateMany({
        where: { categoryUuid: origenUuid },
        data: { categoryUuid: destinoUuid },
      }),
      prisma.expenseCategory.delete({ where: { uuid: origenUuid } }),
    ])

    refresh()
    const partes = [
      `${movimientos.count} ${movimientos.count === 1 ? 'movimiento' : 'movimientos'}`,
      recurrentes.count > 0
        ? `${recurrentes.count} ${recurrentes.count === 1 ? 'recurrente' : 'recurrentes'}`
        : '',
    ].filter(Boolean)
    return { ok: true, message: `${origen.name} → ${destino.name}: ${partes.join(' y ')}` }
  })
}

/**
 * Borra una categoría, PERO solo si no la usa nada.
 *
 * El FK es SET NULL, así que técnicamente se podría borrar y dejar los
 * movimientos "sin categoría" — y ahí se pierde en silencio la clasificación
 * de todo su historial, que es justo lo que el módulo sirve para tener. Si
 * tiene movimientos o recurrentes, el camino es **fusionarla** en otra.
 */
export async function deleteCategoria(uuid: string): Promise<Result> {
  return guarded(async () => {
    const [movimientos, recurrentes] = await Promise.all([
      prisma.expense.count({ where: { categoryUuid: uuid } }),
      prisma.recurringExpense.count({ where: { categoryUuid: uuid } }),
    ])
    if (movimientos > 0 || recurrentes > 0) {
      const partes = [
        movimientos > 0 ? `${movimientos} ${movimientos === 1 ? 'movimiento' : 'movimientos'}` : '',
        recurrentes > 0 ? `${recurrentes} ${recurrentes === 1 ? 'recurrente' : 'recurrentes'}` : '',
      ].filter(Boolean)
      return fail(`No se puede borrar: la usan ${partes.join(' y ')}. Fusiónala en otra categoría.`)
    }
    await prisma.expenseCategory.delete({ where: { uuid } })
    refresh()
    return ok
  })
}
