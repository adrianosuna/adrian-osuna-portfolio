// Serie temporal para las gráficas por día: rellena huecos, marca los meses y agrupa
// por semana ISO en rangos largos. Devuelve grupos de índices, no valores.

import { DIAS, MESES } from '@/lib/fechas'

/** 'YYYY-MM-DD' → Date en UTC (evita el desfase de zona al sumar días). */
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Lunes de la semana de una fecha (semana ISO). */
const lunesDe = (fecha: string) => {
  const d = utc(fecha)
  const dow = d.getUTCDay() // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return iso(d)
}

/** Por encima de este número de días la serie se agrupa por semanas: 90 barras
 *  finas no se leen, 13 sí. Con 30 o menos, un día por barra. */
const DIAS_PARA_AGRUPAR = 45

export interface SerieDiaria {
  /** Clave de cada columna ('YYYY-MM-DD'; el lunes, si va por semanas). */
  columnas: string[]
  /** Etiqueta corta para el eje X ('DD/MM'). */
  ejeX: string[]
  /** Etiqueta larga para el tooltip ('Lunes 3 de Agosto' o 'Semana del 3 de Agosto'). */
  largas: string[]
  /** Marca de mes por índice de columna: 'Agosto' o 'Agosto 2026' al cambiar de año. */
  marcasMes: Record<number, string>
  /** Índices de los puntos ORIGINALES de cada columna (vacío si no hubo dato). */
  grupos: number[][]
  /** true si se agrupó por semanas. */
  porSemana: boolean
}

/** Serie continua entre el primer y el último día con dato, con huecos rellenos y
 *  agrupada por semana en rangos largos. */
export function serieDiaria(
  puntos: Array<{ fecha: string }>,
  opciones: { agrupar?: 'auto' | 'dia' | 'semana' } = {},
): SerieDiaria {
  const vacio: SerieDiaria = {
    columnas: [],
    ejeX: [],
    largas: [],
    marcasMes: {},
    grupos: [],
    porSemana: false,
  }
  if (!puntos.length) return vacio

  const ordenados = [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const primero = ordenados[0].fecha
  const ultimo = ordenados[ordenados.length - 1].fecha

  // Todos los días del rango, sin huecos.
  const dias: string[] = []
  const fin = utc(ultimo)
  for (let d = utc(primero); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push(iso(d))
  }

  const porSemana =
    opciones.agrupar === 'semana' ||
    (opciones.agrupar !== 'dia' && dias.length > DIAS_PARA_AGRUPAR)

  // Índices de los puntos originales por fecha (un día puede no tener ninguno).
  const porFecha = new Map<string, number[]>()
  puntos.forEach((p, i) => {
    const lista = porFecha.get(p.fecha) ?? []
    lista.push(i)
    porFecha.set(p.fecha, lista)
  })

  // Columnas: un día cada una, o el lunes de cada semana.
  const columnas: string[] = []
  const grupos: number[][] = []
  for (const dia of dias) {
    const clave = porSemana ? lunesDe(dia) : dia
    if (columnas[columnas.length - 1] !== clave) {
      columnas.push(clave)
      grupos.push([])
    }
    grupos[grupos.length - 1].push(...(porFecha.get(dia) ?? []))
  }

  const ejeX = columnas.map((k) => `${k.slice(8, 10)}/${k.slice(5, 7)}`)
  const largas = columnas.map((k) => {
    const d = utc(k)
    const dia = d.getUTCDate()
    const mes = MESES[d.getUTCMonth()]
    return porSemana ? `Semana del ${dia} de ${mes}` : `${DIAS[d.getUTCDay()]} ${dia} de ${mes}`
  })

  return { columnas, ejeX, largas, marcasMes: marcasDeMes(columnas), grupos, porSemana }
}

/** Marca de mes en su primera columna, con el año en la primera y en cada cambio.
 *  Un mes parcial con menos de MIN_COLUMNAS no se marca: se solaparía. */
function marcasDeMes(columnas: string[]): Record<number, string> {
  const MIN_COLUMNAS = 3

  const inicios: Array<{ i: number; mes: number; anio: number }> = []
  let ultimoMes: number | null = null
  let ultimoAnio: number | null = null
  columnas.forEach((k, i) => {
    const d = utc(k)
    const m = d.getUTCMonth()
    const y = d.getUTCFullYear()
    if (m !== ultimoMes || y !== ultimoAnio) {
      inicios.push({ i, mes: m, anio: y })
      ultimoMes = m
      ultimoAnio = y
    }
  })

  const conAncho = inicios.map((ini, n) => ({
    ...ini,
    ancho: (inicios[n + 1]?.i ?? columnas.length) - ini.i,
  }))
  const filtradas = conAncho.filter((m, n) => n > 0 || m.ancho >= MIN_COLUMNAS)
  // Si el filtro se lo lleva todo (un rango corto dentro de un solo mes
  // parcial), se conserva la primera: mejor una marca que un eje vacío.
  const visibles = filtradas.length ? filtradas : conAncho.slice(0, 1)

  const marcas: Record<number, string> = {}
  visibles.forEach((m, n) => {
    const cambiaAnio = n === 0 || m.anio !== visibles[n - 1].anio
    marcas[m.i] = cambiaAnio ? `${MESES[m.mes]} ${m.anio}` : MESES[m.mes]
  })
  return marcas
}
