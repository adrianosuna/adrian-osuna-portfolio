// Tipos, constantes y utilidades compartidas del módulo de pipeline
// (tablero, modal de detalle e histórico). Sin dependencias de servidor.

export type EstadoOportunidad = 'CONTACTO' | 'CONVERSACION' | 'PROPUESTA' | 'CERRADO' | 'DESCARTADO'

export interface OpportunityRow {
  uuid: string
  title: string
  company: string | null
  contact: string | null
  origin: string | null
  amount: number | null
  notes: string | null
  status: EstadoOportunidad
  nextAction: string | null
  /** 'YYYY-MM-DD' o null (sin seguimiento previsto). */
  nextActionDate: string | null
  /** ISO o null (solo estados terminales). */
  closedAt: string | null
  archived: boolean
  createTs: string // ISO
  updateTs: string // ISO (ordena las vistas por última actividad)
}

// Urgencia del seguimiento por comparación de fechas ISO (mismos umbrales que
// el mantenimiento: vencido, próximo ≤7 días, al día).
export function urgenciaSeguimiento(fechaIso: string, hoyIso: string): 'vencido' | 'proximo' | 'aldia' {
  if (fechaIso <= hoyIso) return 'vencido'
  const dias = (Date.parse(`${fechaIso}T00:00:00Z`) - Date.parse(`${hoyIso}T00:00:00Z`)) / 86_400_000
  return dias <= 7 ? 'proximo' : 'aldia'
}

/** 'YYYY-MM-DD' (o un ISO completo) → 'DD/MM/YYYY'. */
export const fmtFecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * Cuándo toca la próxima acción, en lenguaje natural y CORTO: en la tarjeta del
 * tablero el chip solo tiene ~130px, y la fecha completa (10 caracteres) no
 * dejaba sitio para leer la acción. La fecha exacta va en el title.
 */
export function cuandoSeguimiento(fechaIso: string, hoyIso: string): string {
  const dias = Math.round(
    (Date.parse(`${fechaIso}T00:00:00Z`) - Date.parse(`${hoyIso}T00:00:00Z`)) / 86_400_000,
  )
  if (dias === 0) return 'vence hoy'
  if (dias === -1) return 'venció ayer'
  if (dias < 0) return `venció hace ${-dias} días`
  if (dias === 1) return 'vence mañana'
  if (dias <= 14) return `vence en ${dias} días`
  return `vence el ${fmtFecha(fechaIso)}`
}

export const CLASE_URGENCIA = {
  vencido: 'bg-danger-bg text-danger',
  proximo: 'bg-warning-bg text-warning',
  aldia: 'border border-border text-muted-foreground',
} as const

export const COLUMNAS: Array<{ estado: EstadoOportunidad; label: string; accent: string }> = [
  { estado: 'CONTACTO', label: 'Contacto', accent: 'bg-muted text-muted-foreground' },
  { estado: 'CONVERSACION', label: 'Conversación', accent: 'bg-primary/10 text-primary' },
  { estado: 'PROPUESTA', label: 'Propuesta', accent: 'bg-warning-bg text-warning' },
  { estado: 'CERRADO', label: 'Cerrado', accent: 'bg-success-bg text-success' },
  { estado: 'DESCARTADO', label: 'Descartado', accent: 'bg-danger-bg text-danger' },
]

/** Estados terminales: sellan fecha de cierre y admiten archivado. */
export const TERMINALES: readonly EstadoOportunidad[] = ['CERRADO', 'DESCARTADO']

export const ORIGENES = ['LinkedIn', 'Web', 'Email', 'Referido', 'Otro']

// useGrouping siempre: es-ES no agrupa los números de 4 cifras por defecto.
export const eur = (v: number) =>
  v.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    useGrouping: 'always',
  })

// Escala de botones: fuente única en `ui/botones.ts` (estaba copiada en cinco
// ficheros). Se re-exporta porque el módulo la importa de aquí.
export { btnPrimary, btnOutline, btnIcon, chipFiltro } from '@/components/ui/botones'
