// Histórico del monitor de infraestructura (solo servidor).
//
// `infra.ts` MIDE: dice cómo está el servidor en el instante de la petición.
// Este módulo GUARDA una muestra al día (la apunta el cron de las 8:00) y la
// lee de vuelta como serie, que es lo que contesta las preguntas que un dato
// puntual no puede: ¿el disco se está llenando o lleva meses igual? ¿la BD
// crece más rápido desde que hay recurrentes? ¿el certificado se renovó solo?
//
// Una muestra al día a propósito: el valor está en la tendencia de meses. Un
// muestreo por minuto sería una base de datos de series temporales, y eso es
// otro problema (y otra herramienta).
// El TIPO de la muestra y los cálculos puros viven en `infra-series.ts` (sin
// `server-only`): los comparten este módulo y las tarjetas del cliente.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { snapshotInfra, snapshotServidor } from '@/lib/infra'
import { hoyMadrid } from '@/lib/mantenimiento'
import type { MuestraInfra } from '@/lib/infra-series'
import { log } from '@/lib/log'

export type { MuestraInfra }

/** Cuántos días de histórico se leen por defecto (un trimestre). */
export const DIAS_HISTORICO = 90

/** Redondea a entero, dejando pasar el null (las columnas son enteras). */
const ent = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v)

/**
 * Mide y guarda la muestra de hoy (una fila por día: si el cron repite, la
 * reescribe). No lanza nunca: es trabajo de fondo y una muestra perdida no
 * puede tumbar la pasada del cron.
 *
 * Devuelve `true` si la guardó.
 */
export async function guardarMuestraInfra(hoyIso = hoyMadrid()): Promise<boolean> {
  try {
    const [infra, maquina] = await Promise.all([snapshotInfra(), snapshotServidor()])

    // Antigüedad del backup en horas: es lo comparable entre días (la fecha
    // absoluta del último dump no dice si el backup va al día).
    const backupHoras =
      infra.backup.ultimoTs === null
        ? null
        : ent((Date.now() - Date.parse(infra.backup.ultimoTs)) / 3_600_000)

    const datos = {
      discoPct: ent(infra.disco.usadoPct),
      dbBytes: infra.almacenBD === null ? null : BigInt(Math.round(infra.almacenBD.totalBytes)),
      sslDias: ent(infra.ssl.diasRestantes),
      backupHoras,
      dbLatenciaMs: ent(infra.db.latenciaMs),
      webTtfbMs: ent(infra.web.ttfbMs),
      memoriaPct: ent(maquina.memoria.usadaPct),
      cpuPct: ent(maquina.cpu.usoPct),
    }

    const dia = new Date(`${hoyIso}T00:00:00Z`)
    await prisma.infraSample.upsert({
      where: { sampledOn: dia },
      create: { sampledOn: dia, ...datos },
      update: datos,
    })
    return true
  } catch (e) {
    log.error('infra-historico', 'muestra no guardada', { error: e })
    return false
  }
}

/** Muestras de los últimos `dias` días, de la más antigua a la más reciente. */
export async function historicoInfra(dias = DIAS_HISTORICO): Promise<MuestraInfra[]> {
  const desde = new Date(Date.now() - dias * 86_400_000)
  const filas = await prisma.infraSample.findMany({
    where: { sampledOn: { gte: desde } },
    orderBy: { sampledOn: 'asc' },
  })
  return filas.map((f) => ({
    fecha: f.sampledOn.toISOString().slice(0, 10),
    discoPct: f.discoPct,
    // BigInt no es serializable a JSON (ni cruza a un componente cliente).
    dbBytes: f.dbBytes === null ? null : Number(f.dbBytes),
    sslDias: f.sslDias,
    backupHoras: f.backupHoras,
    dbLatenciaMs: f.dbLatenciaMs,
    webTtfbMs: f.webTtfbMs,
    memoriaPct: f.memoriaPct,
    cpuPct: f.cpuPct,
  }))
}

