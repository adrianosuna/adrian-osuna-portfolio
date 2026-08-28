'use client'

// Gráficas del sistema de ahorro, ahora sobre Chart.js (componentes portados
// del proyecto de Inversiones, en components/ui/charts). Antes eran SVG a mano:
// la versión anterior está en el historial de git si hiciera falta volver.
//
// Los colores salen de los tokens del tema, resueltos a color real dentro de
// `comun.ts` — canvas no entiende `var(--primary)`.
import type { MonthRow } from '@/lib/finance'
import { MESES, mesCorto, mesInicial } from '@/lib/fechas'
import { GraficaBarras } from '@/components/ui/charts/barras'
import { GraficaLinea } from '@/components/ui/charts/linea'
import { coloresTema } from '@/components/ui/charts/comun'



// useGrouping siempre: es-ES no agrupa los números de 4 cifras por defecto.
const eurCorto = (v: number) =>
  `${v.toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })} €`

/**
 * Eje X de doce meses. Con `autoSkip` Chart.js solo pintaba seis (Ene, Mar,
 * May…); el SVG anterior enseñaba los doce, así que se fuerza a pintarlos todos
 * y por debajo de 420px se usa la INICIAL del mes, que es lo que cabe.
 * `this` es la escala: de ahí se saca el ancho real del lienzo.
 */
export const ejeMeses = {
  autoSkip: false,
  maxRotation: 0,
  callback(this: { chart: { width: number } }, _v: unknown, i: number) {
    return this.chart.width < 420 ? mesInicial(i) : mesCorto(i)
  },
}

/** Eje en euros, abreviado a "1,5k" cuando la cifra es de miles: en el eje no
 *  cabe el importe completo y el exacto ya sale en el tooltip. */
export const ejeEuros = (v: number | string) => {
  const n = Number(v)
  if (n >= 1000) return `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k`
  return String(Math.round(n))
}

/** Barras apiladas por mes: ahorro general + ahorro para viajes. */
export function AhorroPorMes({ months }: { months: MonthRow[] }) {
  const c = coloresTema()
  return (
    <GraficaBarras
      labels={MESES.map((_, i) => mesCorto(i))}
      series={[
        {
          label: 'General',
          data: months.map((m) => m.savingGeneral || 0),
          backgroundColor: c.primary,
          _unidad: 'eur',
        },
        {
          label: 'Viajes',
          data: months.map((m) => m.savingTravel || 0),
          backgroundColor: c.viajes,
          _unidad: 'eur',
        },
      ]}
      apiladas
      leyenda={false}
      alto={230}
      titulo={(i) => MESES[i]}
      scales={{ x: { ticks: ejeMeses }, y: { ticks: { callback: ejeEuros } } }}
    />
  )
}

/** Línea de ahorro acumulado por años (suma corrida del ahorro anual). */
export function AhorroAcumulado({ puntos }: { puntos: Array<{ year: number; valor: number }> }) {
  return (
    <GraficaLinea
      labels={puntos.map((p) => String(p.year))}
      series={[{ label: 'Acumulado', data: puntos.map((p) => p.valor), _unidad: 'eur' }]}
      alto={215}
      valoresEncima
      formatoValor={eurCorto}
      titulo={(i) => String(puntos[i].year)}
      scales={{ y: { ticks: { callback: ejeEuros } } }}
    />
  )
}
