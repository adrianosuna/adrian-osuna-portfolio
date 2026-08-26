// Capa de datos del Panel de control (solo servidor). Dos instantáneas:
// - snapshotInfra: el monitor — certificado SSL, ping de BD, backup, disco,
//   uptime y versión desplegada. Backup y disco llegan por el volumen de solo
//   lectura que monta docker-compose (INFRA_BACKUPS_DIR).
// - snapshotServidor: estado en vivo del servidor — CPU, memoria, swap, disco,
//   proceso Node y sistema. En Docker, os.* y /proc/* leen del HOST (el VPS).
// La fase v3 (visitas vía GA Data API) está en docs/TAREAS.md.
import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
import tls from 'node:tls'
import os from 'node:os'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'
import pkg from '../../package.json'

export type EstadoCheck = 'ok' | 'aviso' | 'error'

export interface InfraSnapshot {
  generadoEn: string // ISO
  ssl: {
    estado: EstadoCheck
    dominio: string
    diasRestantes: number | null
    caducaEl: string | null // ISO
    detalle: string
  }
  db: {
    estado: EstadoCheck
    latenciaMs: number | null
    detalle: string
    version: string | null // "8.4.5"
    motorUptimeSeg: number | null // uptime del propio MySQL
    conexiones: { actual: number; max: number } | null
  }
  almacenBD: {
    totalBytes: number
    tablas: number
    top: Array<{ tabla: string; bytes: number }> // las 3 mayores
  } | null // null si no se pudo leer information_schema
  web: {
    estado: EstadoCheck
    ttfbMs: number | null // primera respuesta del dominio público (viaje completo)
    url: string
    detalle: string
  }
  uptime: {
    servidorSeg: number // en Docker, /proc/uptime es el del host (el VPS)
    appSeg: number // proceso Node: se reinicia con cada despliegue
  }
  backup: {
    estado: EstadoCheck | null // null = sin volumen configurado (desarrollo)
    ficheros: number
    ultimoTs: string | null // ISO (mtime del dump más reciente)
    tamanoBytes: number | null
    detalle: string
  }
  disco: {
    estado: EstadoCheck
    usadoPct: number | null
    libresBytes: number | null
    totalBytes: number | null
    detalle: string
  }
  version: {
    app: string
    build: string | null // ISO horneado en next.config (en dev, arranque del server)
    node: string
    entorno: 'Producción' | 'Desarrollo'
  }
}

// Dominio a vigilar: el de NEXT_PUBLIC_SITE_URL. En desarrollo (localhost)
// se comprueba igualmente el certificado del dominio real en producción.
const dominioSSL = () => {
  const host = new URL(SITE_URL).hostname
  return host === 'localhost' ? 'adrianosuna.com' : host
}

// Lee la fecha de caducidad del certificado abriendo una conexión TLS.
function caducidadCertificado(host: string): Promise<Date> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert?.valid_to) return void reject(new Error('El servidor no presentó certificado'))
      resolve(new Date(cert.valid_to))
    })
    socket.setTimeout(5000, () => {
      socket.destroy()
      reject(new Error('Tiempo de espera agotado (5 s)'))
    })
    socket.on('error', reject)
  })
}

async function checkSSL(): Promise<InfraSnapshot['ssl']> {
  const dominio = dominioSSL()
  try {
    const caduca = await caducidadCertificado(dominio)
    const dias = Math.floor((caduca.getTime() - Date.now()) / 86_400_000)
    // Caddy renueva ~30 días antes de caducar: bajar de 14 significa que la
    // renovación automática lleva días fallando.
    const estado: EstadoCheck = dias <= 0 ? 'error' : dias <= 14 ? 'aviso' : 'ok'
    const detalle =
      estado === 'ok'
        ? 'Renovación automática de Caddy al día'
        : estado === 'aviso'
          ? 'Quedan pocos días: revisar la renovación automática de Caddy'
          : 'Certificado caducado'
    return { estado, dominio, diasRestantes: dias, caducaEl: caduca.toISOString(), detalle }
  } catch (e) {
    return {
      estado: 'error',
      dominio,
      diasRestantes: null,
      caducaEl: null,
      detalle: `No se pudo comprobar: ${e instanceof Error ? e.message : 'error desconocido'}`,
    }
  }
}

async function checkDB(): Promise<InfraSnapshot['db']> {
  try {
    // Primera consulta fuera de la medición: si el pool está frío, abrir la
    // conexión dispararía la latencia sin que MySQL tenga culpa alguna.
    await prisma.$queryRaw`SELECT 1`
    const inicio = performance.now()
    await prisma.$queryRaw`SELECT 1`
    const latencia = Math.max(1, Math.round(performance.now() - inicio))
    // En la misma red Docker debería responder en pocos ms; centenares de ms
    // apuntan a un MySQL saturado.
    const estado: EstadoCheck = latencia > 300 ? 'aviso' : 'ok'

    // Datos del motor (mejor esfuerzo: si el usuario no puede leerlos, el
    // ping sigue valiendo). SHOW no admite parámetros: consultas fijas.
    let version: string | null = null
    let motorUptimeSeg: number | null = null
    let conexiones: { actual: number; max: number } | null = null
    try {
      const [filaVersion] = await prisma.$queryRaw<Array<{ v: string }>>`SELECT VERSION() AS v`
      version = filaVersion?.v?.split('-')[0] ?? null
      const status = await prisma.$queryRaw<Array<{ Variable_name: string; Value: string }>>`
        SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime', 'Threads_connected')`
      const valor = (clave: string) => Number(status.find((s) => s.Variable_name === clave)?.Value ?? NaN)
      if (Number.isFinite(valor('Uptime'))) motorUptimeSeg = valor('Uptime')
      const [filaMax] = await prisma.$queryRaw<Array<{ Variable_name: string; Value: string }>>`
        SHOW VARIABLES LIKE 'max_connections'`
      if (Number.isFinite(valor('Threads_connected')) && filaMax) {
        conexiones = { actual: valor('Threads_connected'), max: Number(filaMax.Value) }
      }
    } catch (e) {
      console.error('[infra] datos del motor MySQL no disponibles:', e)
    }

    return {
      estado,
      latenciaMs: latencia,
      detalle: estado === 'ok' ? 'MySQL responde con normalidad' : 'MySQL responde lento',
      version,
      motorUptimeSeg,
      conexiones,
    }
  } catch (e) {
    console.error('[infra] ping BD fallido:', e)
    return {
      estado: 'error',
      latenciaMs: null,
      detalle: 'La base de datos no responde',
      version: null,
      motorUptimeSeg: null,
      conexiones: null,
    }
  }
}

// Tamaño de la base de datos y sus tablas (information_schema). Los BIGINT
// llegan como bigint de JS: se convierten a number (tamaños muy por debajo
// del límite seguro) para que el snapshot sea serializable.
async function checkAlmacenBD(): Promise<InfraSnapshot['almacenBD']> {
  try {
    const filas = await prisma.$queryRaw<Array<{ tabla: string; bytes: bigint | number }>>`
      SELECT table_name AS tabla, (data_length + index_length) AS bytes
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY bytes DESC`
    if (!filas.length) return null
    const tablas = filas.map((f) => ({ tabla: f.tabla, bytes: Number(f.bytes) }))
    return {
      totalBytes: tablas.reduce((acc, t) => acc + t.bytes, 0),
      tablas: tablas.length,
      top: tablas.slice(0, 3),
    }
  } catch (e) {
    console.error('[infra] tamaño de BD no disponible:', e)
    return null
  }
}

// Latencia pública: una petición al dominio real DESDE el servidor — recorre
// la cadena completa (DNS, Caddy, TLS, Next), que es lo que ve un visitante.
// El resto de checks miran hacia dentro; si Caddy cae, solo este lo delata.
async function checkWeb(): Promise<InfraSnapshot['web']> {
  const url = `https://${dominioSSL()}/`
  try {
    const inicio = performance.now()
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const ttfb = Math.max(1, Math.round(performance.now() - inicio))
    if (!res.ok) {
      return { estado: 'error', ttfbMs: ttfb, url, detalle: `El dominio respondió HTTP ${res.status}` }
    }
    const estado: EstadoCheck = ttfb > 2000 ? 'error' : ttfb > 800 ? 'aviso' : 'ok'
    const detalle =
      estado === 'ok'
        ? 'Primera respuesta del viaje completo (DNS, Caddy, TLS, Next)'
        : 'El sitio público responde lento'
    return { estado, ttfbMs: ttfb, url, detalle }
  } catch (e) {
    console.error('[infra] latencia pública fallida:', e)
    return { estado: 'error', ttfbMs: null, url, detalle: 'El dominio público no responde' }
  }
}

// Carpeta con los dumps del cron de backup (en producción, el volumen de solo
// lectura del compose). Sin definir —desarrollo—, el check queda "sin configurar".
// Se lee en cada llamada, no a nivel de módulo: en desarrollo el env se recarga
// en caliente y una constante se quedaría con el valor del arranque.
const dirBackups = () => process.env.INFRA_BACKUPS_DIR || undefined

async function checkBackup(): Promise<InfraSnapshot['backup']> {
  const dir = dirBackups()
  if (!dir) {
    return {
      estado: null,
      ficheros: 0,
      ultimoTs: null,
      tamanoBytes: null,
      detalle: 'Sin configurar: requiere el volumen de backups (solo producción)',
    }
  }
  try {
    // turbopackIgnore: la ruta llega del entorno en runtime; sin la marca,
    // Turbopack trazaría el proyecto entero dentro del build standalone.
    const nombres = (await fs.readdir(/* turbopackIgnore: true */ dir)).filter(
      (n) => /^portfolio-.+\.sql\.gz$/.test(n),
    )
    if (nombres.length === 0) {
      return {
        estado: 'error',
        ficheros: 0,
        ultimoTs: null,
        tamanoBytes: null,
        detalle: 'La carpeta no contiene ningún dump',
      }
    }
    const stats = await Promise.all(
      nombres.map(async (n) => await fs.stat(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, n))),
    )
    const ultimo = stats.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a))
    const horas = (Date.now() - ultimo.mtimeMs) / 3_600_000
    // El cron corre a diario a las 4:00: con más de 26 h el de hoy no llegó a
    // hacerse, y con más de 50 h ya van dos días fallando.
    const estado: EstadoCheck = horas <= 26 ? 'ok' : horas <= 50 ? 'aviso' : 'error'
    const detalle =
      estado === 'ok'
        ? 'Cron de las 4:00 al día'
        : estado === 'aviso'
          ? 'El backup de hoy no se ha hecho: revisar el cron'
          : 'Más de dos días sin backup: revisar el cron'
    return {
      estado,
      ficheros: nombres.length,
      ultimoTs: new Date(ultimo.mtimeMs).toISOString(),
      tamanoBytes: ultimo.size,
      detalle,
    }
  } catch (e) {
    console.error('[infra] lectura de backups fallida:', e)
    return {
      estado: 'error',
      ficheros: 0,
      ultimoTs: null,
      tamanoBytes: null,
      detalle: 'No se pudo leer la carpeta de backups',
    }
  }
}

async function checkDisco(): Promise<InfraSnapshot['disco']> {
  // La partición donde viven los backups es la raíz del VPS, así que medirla
  // equivale a medir el disco del servidor. Sin volumen (desarrollo) se mide
  // el disco local de trabajo.
  const dir = dirBackups()
  const ruta = dir ?? process.cwd()
  try {
    const s = await fs.statfs(ruta)
    const total = s.blocks * s.bsize
    const libres = s.bavail * s.bsize
    const usadoPct = Math.round(((total - libres) / total) * 100)
    const estado: EstadoCheck = usadoPct >= 90 ? 'error' : usadoPct >= 80 ? 'aviso' : 'ok'
    const detalle = dir
      ? 'Sistema de ficheros del VPS'
      : 'Disco local (equipo de desarrollo)'
    return { estado, usadoPct, libresBytes: libres, totalBytes: total, detalle }
  } catch (e) {
    console.error('[infra] statfs fallido:', e)
    return {
      estado: 'error',
      usadoPct: null,
      libresBytes: null,
      totalBytes: null,
      detalle: 'No se pudo medir el disco',
    }
  }
}

// ── Estado del servidor ─────────────────────────────────────────────────────

export interface ServidorSnapshot {
  generadoEn: string // ISO
  cpu: {
    estado: EstadoCheck
    usoPct: number
    nucleos: number
    modelo: string
    carga: [number, number, number] | null // loadavg 1/5/15 min (null en Windows)
  }
  memoria: {
    estado: EstadoCheck
    usadaPct: number
    usadaBytes: number
    disponiblesBytes: number
    totalBytes: number
  }
  swap: {
    estado: EstadoCheck
    usadaPct: number
    usadaBytes: number
    totalBytes: number
  } | null // null = sin swap o plataforma sin /proc (desarrollo en Windows)
  disco: InfraSnapshot['disco']
  proceso: {
    rssBytes: number
    heapUsadoBytes: number
    heapTotalBytes: number
    pid: number
    node: string
  }
  sistema: {
    so: string
    kernel: string
    arch: string
    host: string
    uptimeSeg: number
  }
}

// Uso de CPU: dos muestras de os.cpus() separadas 250 ms y porcentaje de
// tiempo no ocioso entre ambas. En Docker lee /proc/stat, es decir, el host.
function usoCPU(): Promise<number> {
  const lee = () =>
    os.cpus().reduce(
      (acc, c) => {
        const total = c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
        return { total: acc.total + total, idle: acc.idle + c.times.idle }
      },
      { total: 0, idle: 0 },
    )
  const a = lee()
  return new Promise((resolve) =>
    setTimeout(() => {
      const b = lee()
      const total = b.total - a.total
      resolve(total <= 0 ? 0 : Math.round((1 - (b.idle - a.idle) / total) * 100))
    }, 250),
  )
}

// Memoria del host: /proc/meminfo trae MemAvailable (la cifra que de verdad
// importa) y el swap; si no existe (Windows), se cae a os.totalmem/freemem.
async function memoriaHost() {
  try {
    const txt = await fs.readFile(/* turbopackIgnore: true */ '/proc/meminfo', 'utf8')
    const kb = (clave: string) => {
      const m = txt.match(new RegExp(`^${clave}:\\s+(\\d+) kB`, 'm'))
      return m ? Number(m[1]) * 1024 : null
    }
    const total = kb('MemTotal')
    const disponible = kb('MemAvailable')
    if (total && disponible !== null) {
      return { total, disponible, swapTotal: kb('SwapTotal'), swapLibre: kb('SwapFree') }
    }
  } catch {
    // Sin /proc: plataforma no Linux, se usa el fallback de os.*
  }
  return { total: os.totalmem(), disponible: os.freemem(), swapTotal: null, swapLibre: null }
}

/** Estado en vivo del servidor: CPU, memoria, swap, disco, proceso y sistema. */
export async function snapshotServidor(): Promise<ServidorSnapshot> {
  const [usoPct, mem, disco] = await Promise.all([usoCPU(), memoriaHost(), checkDisco()])

  const cpus = os.cpus()
  const [c1, c5, c15] = os.loadavg()
  const memUsada = mem.total - mem.disponible
  const memPct = Math.round((memUsada / mem.total) * 100)

  const swap =
    mem.swapTotal && mem.swapLibre !== null
      ? (() => {
          const usada = mem.swapTotal - mem.swapLibre
          const pct = Math.round((usada / mem.swapTotal) * 100)
          return {
            // Swap llenándose = presión de memoria sostenida en el VPS.
            estado: (pct >= 80 ? 'error' : pct >= 40 ? 'aviso' : 'ok') as EstadoCheck,
            usadaPct: pct,
            usadaBytes: usada,
            totalBytes: mem.swapTotal,
          }
        })()
      : null

  return {
    generadoEn: new Date().toISOString(),
    cpu: {
      estado: usoPct >= 90 ? 'error' : usoPct >= 70 ? 'aviso' : 'ok',
      usoPct,
      nucleos: cpus.length,
      modelo: cpus[0]?.model.trim() ?? '—',
      // loadavg devuelve [0,0,0] en Windows: mejor "no disponible" que mentir.
      carga: process.platform === 'win32' ? null : [c1, c5, c15],
    },
    memoria: {
      estado: memPct >= 90 ? 'error' : memPct >= 80 ? 'aviso' : 'ok',
      usadaPct: memPct,
      usadaBytes: memUsada,
      disponiblesBytes: mem.disponible,
      totalBytes: mem.total,
    },
    swap,
    disco,
    proceso: {
      rssBytes: process.memoryUsage().rss,
      heapUsadoBytes: process.memoryUsage().heapUsed,
      heapTotalBytes: process.memoryUsage().heapTotal,
      pid: process.pid,
      node: process.version,
    },
    sistema: {
      so: os.type(),
      kernel: os.release(),
      arch: os.arch(),
      host: os.hostname(),
      uptimeSeg: Math.round(os.uptime()),
    },
  }
}

/** Ejecuta todas las comprobaciones y devuelve una instantánea serializable. */
export async function snapshotInfra(): Promise<InfraSnapshot> {
  const [ssl, db, almacenBD, web, backup, disco] = await Promise.all([
    checkSSL(), checkDB(), checkAlmacenBD(), checkWeb(), checkBackup(), checkDisco(),
  ])
  return {
    generadoEn: new Date().toISOString(),
    ssl,
    db,
    almacenBD,
    web,
    backup,
    disco,
    uptime: {
      servidorSeg: Math.round(os.uptime()),
      appSeg: Math.round(process.uptime()),
    },
    version: {
      app: pkg.version,
      build: process.env.BUILD_TS ?? null,
      node: process.version,
      entorno: process.env.NODE_ENV === 'production' ? 'Producción' : 'Desarrollo',
    },
  }
}
