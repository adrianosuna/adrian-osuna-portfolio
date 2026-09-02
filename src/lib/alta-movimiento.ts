// Alta de un movimiento, SIN autorización: la parte que comparten la server
// action del dashboard y la API de los Atajos de iOS.
//
// Existe porque hay dos puertas de entrada al mismo dato y las reglas tienen
// que ser exactamente las mismas: si la API validara por su cuenta, el día que
// cambie el tope del importe o el recorte del concepto solo cambiaría en un
// lado. Quién puede llamar a esto lo decide cada puerta (sesión de admin en la
// action, token en la API).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { redondearCentimos } from '@/lib/euros'
import {
  MovimientoAlta,
  NOTA_MOVIMIENTO_MAX,
  textoObligatorio,
  textoOpcional,
  TipoMovimiento,
  importe as importeEsquema,
  validar,
} from '@/lib/esquemas'

export const TIPOS_MOVIMIENTO = ['INGRESO', 'GASTO'] as const
export type TipoMovimientoValido = (typeof TIPOS_MOVIMIENTO)[number]

export const tipoValido = (v: unknown): v is TipoMovimientoValido =>
  TipoMovimiento.safeParse(v).success

/** Fecha 'YYYY-MM-DD' válida → medianoche UTC; si no, null. */
export const fechaValida = (v: string | null | undefined) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null

/** Nota libre: texto plano (nunca HTML), recortada; '' se guarda como null. */
export const NOTA_MAX = NOTA_MOVIMIENTO_MAX
const notaEsquema = textoOpcional(NOTA_MAX)
export const limpiarNotaMovimiento = (v: string | null | undefined): string | null => {
  const r = notaEsquema.safeParse(v)
  return r.success ? r.data : null
}

export type ConceptoImporte =
  | { error: string }
  | { error?: never; concept: string; amount: number }

/**
 * Concepto e importe, comunes al alta y a la edición.
 *
 * El importe se redondea A CÉNTIMOS aquí y no en la BD: la columna es
 * DECIMAL(12,2) y redondearía sola, pero entonces lo guardado no sería lo que
 * validó la división en partes (que compara en céntimos).
 */
const conceptoEsquema = textoObligatorio(255, 'El concepto')
const importeCampo = importeEsquema()

export const limpiarConceptoImporte = (datos: {
  concept?: string
  amount?: number | null
}): ConceptoImporte => {
  const c = validar(conceptoEsquema, datos.concept)
  if (!c.ok) return { error: c.message }
  const a = validar(importeCampo, datos.amount)
  if (!a.ok) return { error: a.message }
  return { concept: c.datos, amount: redondearCentimos(a.datos) }
}

export interface DatosAlta {
  type?: string
  concept?: string
  amount?: number | null
  expenseDate?: string | null
  categoryUuid?: string | null
  note?: string | null
}

export type ResultadoAlta =
  | { error: string }
  | { error?: never; uuid: string; concept: string; amount: number; expenseDate: string }

/**
 * Valida y da de alta un movimiento. No revalida caché ni comprueba permisos:
 * eso es de quien llama.
 *
 * La categoría se COMPRUEBA antes de referenciarla: por la API puede llegar un
 * uuid inventado, y el FK es SET NULL — se guardaría sin categoría en silencio.
 * Aquí se prefiere decirlo.
 */
export async function altaMovimiento(datos: DatosAlta): Promise<ResultadoAlta> {
  // Un solo paso con el esquema completo: tipo, concepto, importe, fecha,
  // categoría y nota. Lo que llega por la API pasa por aquí igual que lo que
  // llega del dashboard.
  const v = validar(MovimientoAlta, datos)
  if (!v.ok) return { error: v.message }
  const parsed = { concept: v.datos.concept, amount: redondearCentimos(v.datos.amount) }
  const dia = fechaValida(v.datos.expenseDate)
  if (!dia) return { error: 'Indica la fecha del movimiento' }

  let categoryUuid: string | null = null
  if (v.datos.categoryUuid) {
    const cat = await prisma.expenseCategory.findUnique({
      where: { uuid: v.datos.categoryUuid },
      select: { uuid: true, type: true },
    })
    if (!cat) return { error: 'Esa categoría no existe' }
    // Una categoría de ingreso en un gasto descuadraría los desgloses.
    if (cat.type !== v.datos.type) return { error: 'La categoría no es de ese tipo' }
    categoryUuid = cat.uuid
  }

  const fila = await prisma.expense.create({
    data: {
      ...parsed,
      type: v.datos.type,
      expenseDate: dia,
      categoryUuid,
      note: v.datos.note,
    },
  })

  return {
    uuid: fila.uuid,
    concept: fila.concept,
    amount: Number(fila.amount),
    expenseDate: fila.expenseDate.toISOString().slice(0, 10),
  }
}
