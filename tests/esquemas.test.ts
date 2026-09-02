// Esquemas de validación compartidos (Zod).
//
// Lo que más importa aquí no son los rechazos obvios, sino **las dos trampas
// de Zod** que ya provocaron un fallo real al escribirlos y que un refactor
// podría reintroducir sin que nada más se queje:
//
//   1. `z.coerce.number()` en una unión con `z.null()` convierte `null` en 0
//      (`Number(null) === 0`). En el control mensual del ahorro eso escribe un
//      cero donde el mes estaba SIN RELLENAR — justo lo que el módulo
//      distingue para avisar por correo.
//   2. Un campo con `.transform()` sigue siendo obligatorio: sin `.nullish()`
//      antes, omitir la clave falla con "expected nonoptional".
import { describe, expect, it } from 'vitest'
import {
  AnioEdicion,
  AnioNuevo,
  CategoriaNueva,
  ConceptoImporte,
  EventoOportunidad,
  MesesAhorro,
  MovimientoAlta,
  MovimientoEdicion,
  Nota,
  OportunidadAlta,
  PartesDivision,
  RecurrenteAlta,
  TareaAlta,
  tope,
  UsuarioInvitado,
  Uuid,
  validar,
} from '@/lib/esquemas'

const UUID = '808fb6b5-0515-463f-9b2e-8c3ede0b3e10'
/** uuid de versión 1, como los que sembró MySQL en la BD heredada. */
const UUID_V1 = '9f9d19bd-a205-11f1-b29d-00e04c68150b'

describe('trampa 1: null no se convierte en 0', () => {
  it('un mes sin rellenar sigue siendo null en las tres cifras', () => {
    const res = validar(MesesAhorro, [
      { month: 3, income: null, savingGeneral: null, savingTravel: null },
    ])
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.datos[0]).toEqual({
      month: 3,
      income: null,
      savingGeneral: null,
      savingTravel: null,
    })
  })

  it('una cadena vacía también es null, no 0', () => {
    const res = validar(MesesAhorro, [
      { month: 1, income: '', savingGeneral: '  ', savingTravel: 10 },
    ])
    expect(res.ok && res.datos[0]).toMatchObject({
      income: null,
      savingGeneral: null,
      savingTravel: 10,
    })
  })

  it('el objetivo del año y el tope: null se queda null', () => {
    expect(validar(AnioNuevo, { year: 2026, goal: null })).toEqual({
      ok: true,
      datos: { year: 2026, goal: null },
    })
    expect(validar(tope, null)).toEqual({ ok: true, datos: null })
  })

  it('un 0 en el objetivo o en el tope es "sin valor", no un cero', () => {
    expect(validar(AnioNuevo, { year: 2026, goal: 0 })).toEqual({
      ok: true,
      datos: { year: 2026, goal: null },
    })
    expect(validar(tope, 0)).toEqual({ ok: true, datos: null })
  })
})

describe('trampa 2: las claves opcionales se pueden omitir', () => {
  it('un movimiento sin categoría ni nota valida', () => {
    const res = validar(MovimientoAlta, {
      type: 'GASTO',
      concept: 'Mercadona',
      amount: 12.5,
      expenseDate: '2026-09-02',
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.datos).toMatchObject({ categoryUuid: null, note: null })
  })

  it('una edición vacía valida (el parche se decide en la action)', () => {
    expect(validar(MovimientoEdicion, {}).ok).toBe(true)
    expect(validar(AnioEdicion, {}).ok).toBe(true)
  })

  it('una tarea puntual (sin periodicidad) valida', () => {
    // Es lo que hace posible un recordatorio que no se repite.
    const res = validar(TareaAlta, { title: 'Renovar dominio', nextDue: '2027-03-12' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.datos.intervalMonths).toBeNull()
  })

  it('una oportunidad solo con título y estado valida', () => {
    const res = validar(OportunidadAlta, { title: 'Encargo', status: 'CONTACTO' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.datos).toMatchObject({ company: null, amount: null })
  })
})

describe('texto', () => {
  it('recorta, limita al ancho de la columna y exige contenido', () => {
    const res = validar(ConceptoImporte, { concept: '  x'.repeat(200), amount: 1 })
    expect(res.ok && res.datos.concept.length).toBe(255)
    expect(validar(ConceptoImporte, { concept: '   ', amount: 1 })).toEqual({
      ok: false,
      message: 'El concepto es obligatorio',
    })
  })

  it('el texto opcional vacío se guarda como null', () => {
    const res = validar(Nota, { title: '   ', content: '<p>x</p>' })
    expect(res.ok && res.datos.title).toBeNull()
  })
})

describe('importes', () => {
  it('acepta la coma decimal (es lo que manda un Atajo de iOS)', () => {
    expect(validar(ConceptoImporte, { concept: 'x', amount: '12,50' })).toEqual({
      ok: true,
      datos: { concept: 'x', amount: 12.5 },
    })
  })

  it('rechaza negativos, cifras imposibles y texto que no es un número', () => {
    const de = (amount: unknown) => validar(ConceptoImporte, { concept: 'x', amount })
    expect(de(-1).ok).toBe(false)
    expect(de(1e10).ok).toBe(false)
    expect(de('doce euros').ok).toBe(false)
    expect(de(null).ok).toBe(false)
    expect(de(undefined).ok).toBe(false)
  })

  it('el mensaje dice QUÉ pasa, porque va al cliente tal cual', () => {
    expect(validar(ConceptoImporte, { concept: 'x', amount: -1 })).toEqual({
      ok: false,
      message: 'El importe no puede ser negativo',
    })
    expect(validar(ConceptoImporte, { concept: 'x', amount: 1e11 })).toEqual({
      ok: false,
      message: 'El importe es demasiado grande',
    })
  })
})

describe('identificador', () => {
  it('acepta los v4 de Prisma y los v1 heredados de la BD antigua', () => {
    expect(validar(Uuid, UUID).ok).toBe(true)
    expect(validar(Uuid, UUID_V1).ok).toBe(true)
  })

  it('rechaza el vacío, el null y lo que no es texto', () => {
    expect(validar(Uuid, '').ok).toBe(false)
    expect(validar(Uuid, '   ').ok).toBe(false)
    expect(validar(Uuid, null).ok).toBe(false)
    expect(validar(Uuid, undefined).ok).toBe(false)
    expect(validar(Uuid, 42).ok).toBe(false)
    expect(validar(Uuid, 'x'.repeat(40)).ok).toBe(false)
  })

  it('NO exige el formato canónico, a propósito', () => {
    // Prisma parametriza: un identificador raro no inyecta, solo no encuentra
    // fila. Y los tests del proyecto usan ids cortos legibles.
    expect(validar(Uuid, 'c1').ok).toBe(true)
  })

  it('en un campo de categoría, la cadena vacía es "sin categoría"', () => {
    const res = validar(MovimientoAlta, {
      type: 'GASTO',
      concept: 'x',
      amount: 1,
      expenseDate: '2026-09-02',
      categoryUuid: '',
    })
    expect(res.ok && res.datos.categoryUuid).toBeNull()
  })

  it('una categoría inventada la caza la BD, no el esquema', () => {
    // El esquema la deja pasar (es texto válido); quien la rechaza es
    // `altaMovimiento`, que comprueba que exista y que sea de ese tipo — la
    // garantía que de verdad importa, porque el FK es SET NULL y si no se
    // guardaría sin categoría en silencio (ver api-v1.test.ts).
    const res = validar(MovimientoAlta, {
      type: 'GASTO',
      concept: 'x',
      amount: 1,
      expenseDate: '2026-09-02',
      categoryUuid: 'inventado',
    })
    expect(res.ok).toBe(true)
  })
})

describe('enums', () => {
  it('el tipo del movimiento solo admite ingreso o gasto', () => {
    // Cada esquema pone SU mensaje: en la categoría se habla de la categoría.
    expect(validar(CategoriaNueva, { name: 'x', type: 'TRANSFERENCIA' })).toEqual({
      ok: false,
      message: 'Indica si la categoría es de ingreso o de gasto',
    })
    expect(
      validar(MovimientoAlta, {
        type: 'TRANSFERENCIA',
        concept: 'x',
        amount: 1,
        expenseDate: '2026-09-02',
      }),
    ).toEqual({ ok: false, message: 'Indica si es un ingreso o un gasto' })
  })

  it('un rol desconocido degrada a USER, no falla', () => {
    // Es el valor seguro: un cliente manipulado no debe colarse como admin.
    const res = validar(UsuarioInvitado, { email: 'a@b.com', role: 'SUPERADMIN' })
    expect(res.ok && res.datos.role).toBe('USER')
  })

  it('el evento ESTADO no se admite desde el cliente', () => {
    // Los cambios de estado los apunta el sistema: el historial no se falsifica.
    expect(validar(EventoOportunidad, { type: 'ESTADO', detail: 'x' }).ok).toBe(false)
    expect(validar(EventoOportunidad, { type: 'LLAMADA', detail: 'x' }).ok).toBe(true)
  })
})

describe('reglas propias de cada módulo', () => {
  it('la división exige entre dos y diez partes', () => {
    const parte = { amount: 1 }
    // `mensajeDe` porque el resultado es una unión: en la rama ok no hay message.
    const mensajeDe = (datos: unknown) => {
      const r = validar(PartesDivision, datos)
      return r.ok ? null : r.message
    }
    expect(mensajeDe([parte])).toBe('Indica al menos dos partes')
    expect(mensajeDe(Array(11).fill(parte))).toBe('Como mucho 10 partes')
    expect(validar(PartesDivision, [parte, parte]).ok).toBe(true)
  })

  it('la periodicidad de un recurrente va de 1 a 120 meses enteros', () => {
    const base = {
      type: 'GASTO',
      concept: 'Alquiler',
      amount: 700,
      nextDate: '2026-10-01',
    }
    expect(validar(RecurrenteAlta, { ...base, intervalMonths: 1 }).ok).toBe(true)
    expect(validar(RecurrenteAlta, { ...base, intervalMonths: 0 }).ok).toBe(false)
    expect(validar(RecurrenteAlta, { ...base, intervalMonths: 121 }).ok).toBe(false)
    expect(validar(RecurrenteAlta, { ...base, intervalMonths: 1.5 }).ok).toBe(false)
  })

  it('el año de ahorro se queda entre 2000 y 2100', () => {
    expect(validar(AnioNuevo, { year: 1999 }).ok).toBe(false)
    expect(validar(AnioNuevo, { year: 2101 }).ok).toBe(false)
    expect(validar(AnioNuevo, { year: 2026 }).ok).toBe(true)
  })

  it('el correo se normaliza a minúsculas y sin espacios', () => {
    const res = validar(UsuarioInvitado, { email: '  Nuevo@Gmail.COM ', role: 'ADMIN' })
    expect(res.ok && res.datos).toEqual({ email: 'nuevo@gmail.com', role: 'ADMIN' })
  })
})

describe('el validador', () => {
  it('devuelve UN mensaje, que es lo que cabe en un aviso', () => {
    // Con dos campos mal, se contesta el primero: los formularios son cortos y
    // se corrige de uno en uno.
    const res = validar(ConceptoImporte, { concept: '', amount: -1 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(typeof res.message).toBe('string')
  })

  it('un cuerpo que no es un objeto no revienta', () => {
    expect(validar(ConceptoImporte, null).ok).toBe(false)
    expect(validar(ConceptoImporte, 'texto').ok).toBe(false)
    expect(validar(ConceptoImporte, []).ok).toBe(false)
  })
})
