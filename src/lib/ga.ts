// Visitas del sitio vía Google Analytics Data API (GA4), para la pestaña
// "Visitas" del Panel de control. Autenticación de service account con JWT
// firmado a mano (node:crypto) — sin SDK de Google, en línea con el proyecto.
// Los informes van agrupados con batchRunReports (máx. 5 por lote): la API
// limita a 10 peticiones concurrentes por propiedad.
//
// Requiere tres variables de entorno (ver .env.production.example):
//   GA_PROPERTY_ID      id numérico de la propiedad GA4 (no el G-XXXX)
//   GA_SA_CLIENT_EMAIL  correo de la service account
//   GA_SA_PRIVATE_KEY   clave privada del JSON, con \n escapados
// La service account debe tener acceso de Lector en la propiedad GA4.
import 'server-only'
import crypto from 'node:crypto'

/** Fila genérica de ranking (páginas, fuentes, países...). */
export interface Fila {
  etiqueta: string
  valor: number
}

/** Métrica con su valor de los 30 días previos, para pintar tendencia. */
export interface Metrica {
  actual: number
  previo: number
}

export type RangoDias = 7 | 30 | 90

export interface VisitasSnapshot {
  configurado: boolean
  generadoEn: string // ISO
  error: string | null
  dias: RangoDias // rango del informe (la comparativa usa el mismo tamaño)
  propertyId: string // para el enlace "Abrir en Google Analytics" (no es secreto)
  ahora: number | null // usuarios activos en tiempo real
  totales: {
    activos: Metrica
    sesiones: Metrica
    vistas: Metrica
    duracionSeg: Metrica // duración media de sesión, en segundos
    interaccionPct: Metrica // engagement rate, en %
  }
  serie: Array<{ fecha: string; activos: number; vistas: number }> // por día (YYYY-MM-DD)
  conversiones: Fila[] // eventos clic_* instrumentados en la landing
  fuentes: Fila[] // sessionSource: el sitio exacto de procedencia
  canales: Fila[]
  paginas: Fila[]
  paises: Fila[]
  ciudades: Fila[]
  dispositivos: Fila[]
  navegadores: Fila[]
  nuevos: { nuevos: number; recurrentes: number } // visitantes nuevos vs. que repiten
  horario: number[][] // 7 filas (lunes..domingo) × 24 horas: usuarios activos
}

const METRICA_CERO: Metrica = { actual: 0, previo: 0 }
const HORARIO_VACIO = () => Array.from({ length: 7 }, () => Array<number>(24).fill(0))
const VACIO = {
  totales: {
    activos: METRICA_CERO, sesiones: METRICA_CERO, vistas: METRICA_CERO,
    duracionSeg: METRICA_CERO, interaccionPct: METRICA_CERO,
  },
  serie: [], conversiones: [], fuentes: [], canales: [], paginas: [],
  paises: [], ciudades: [], dispositivos: [], navegadores: [],
  nuevos: { nuevos: 0, recurrentes: 0 },
  horario: HORARIO_VACIO(),
}

const config = () => {
  const propertyId = process.env.GA_PROPERTY_ID || undefined
  const email = process.env.GA_SA_CLIENT_EMAIL || undefined
  const key = process.env.GA_SA_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined
  return propertyId && email && key ? { propertyId, email, key } : null
}

// ── Token de acceso (flujo JWT de service account) ─────────────────────────
// Se cachea hasta poco antes de su caducidad para no pedir uno por informe.
let tokenCache: { token: string; caducaMs: number } | null = null

async function tokenAcceso(email: string, key: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.caducaMs) return tokenCache.token

  const ahora = Math.floor(Date.now() / 1000)
  const b64 = (s: string) => Buffer.from(s).toString('base64url')
  const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    }),
  )
  const firma = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key)
  const jwt = `${header}.${claims}.${firma.toString('base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`intercambio de token fallido (HTTP ${res.status})`)
  const datos = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = { token: datos.access_token, caducaMs: Date.now() + (datos.expires_in - 60) * 1000 }
  return datos.access_token
}

// ── Informes ────────────────────────────────────────────────────────────────

interface FilaInforme {
  dimensionValues?: Array<{ value: string }>
  metricValues?: Array<{ value: string }>
}

async function llamada(propertyId: string, token: string, metodo: string, cuerpo: object) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:${metodo}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    },
  )
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    console.error(`[ga] ${metodo} HTTP ${res.status}:`, detalle.slice(0, 500))
    throw new Error(`la Data API respondió HTTP ${res.status}`)
  }
  return res.json()
}

// Lote de hasta 5 informes en una sola petición; devuelve las filas de cada uno.
async function lote(propertyId: string, token: string, cuerpos: object[]): Promise<FilaInforme[][]> {
  const datos = (await llamada(propertyId, token, 'batchRunReports', { requests: cuerpos })) as {
    reports?: Array<{ rows?: FilaInforme[] }>
  }
  return cuerpos.map((_, i) => datos.reports?.[i]?.rows ?? [])
}

const num = (fila: FilaInforme | undefined, i: number) => Number(fila?.metricValues?.[i]?.value ?? 0)
const dim = (fila: FilaInforme, i: number) => fila.dimensionValues?.[i]?.value ?? ''

// ── Traducciones de valores que la API devuelve en inglés ───────────────────

const CANALES_ES: Record<string, string> = {
  'Direct': 'Directo',
  'Organic Search': 'Búsqueda orgánica',
  'Organic Social': 'Social orgánico',
  'Referral': 'Referencias',
  'Email': 'Correo',
  'Paid Search': 'Búsqueda de pago',
  'Unassigned': 'Sin asignar',
}

const PAISES_ES: Record<string, string> = {
  'Spain': 'España', 'United States': 'Estados Unidos', 'United Kingdom': 'Reino Unido',
  'Germany': 'Alemania', 'France': 'Francia', 'Italy': 'Italia', 'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos', 'Ireland': 'Irlanda', 'Switzerland': 'Suiza',
  'Belgium': 'Bélgica', 'Mexico': 'México', 'Argentina': 'Argentina', 'Chile': 'Chile',
  'Colombia': 'Colombia', 'Brazil': 'Brasil', 'Japan': 'Japón', 'China': 'China',
  'India': 'India', '(not set)': 'Desconocido',
}

// GA devuelve las ciudades con exónimo inglés; se corrigen las españolas típicas.
const CIUDADES_ES: Record<string, string> = {
  'Seville': 'Sevilla', 'Cordoba': 'Córdoba', 'Malaga': 'Málaga', 'Saragossa': 'Zaragoza',
  'A Coruna': 'A Coruña', 'Corunna': 'A Coruña', 'San Sebastian': 'San Sebastián',
  'Castellon de la Plana': 'Castellón de la Plana', 'Logrono': 'Logroño',
  'Almeria': 'Almería', 'Caceres': 'Cáceres', 'Leon': 'León', 'Avila': 'Ávila',
  'Jaen': 'Jaén', 'Cadiz': 'Cádiz', '(not set)': 'Desconocida',
}

const DISPOSITIVOS_ES: Record<string, string> = {
  desktop: 'Ordenador',
  mobile: 'Móvil',
  tablet: 'Tablet',
}

// Eventos clic_* instrumentados en la landing (data-ga en sections.tsx).
const EVENTOS_ES: Record<string, string> = {
  clic_contactar: 'Botón "Contactar"',
  clic_email: 'Correo',
  clic_github: 'GitHub',
  clic_linkedin: 'LinkedIn',
  clic_demo: 'Demo de proyecto',
  clic_repo: 'Código de proyecto',
}

const filas = (rows: FilaInforme[], mapa?: Record<string, string>): Fila[] =>
  rows.map((f) => {
    const bruto = dim(f, 0)
    return { etiqueta: mapa?.[bruto] ?? bruto, valor: num(f, 0) }
  })

/** Solo los usuarios activos en tiempo real (para el refresco automático). */
export async function visitantesAhora(): Promise<number | null> {
  const cfg = config()
  if (!cfg) return null
  try {
    const token = await tokenAcceso(cfg.email, cfg.key)
    const datos = (await llamada(cfg.propertyId, token, 'runRealtimeReport', {
      metrics: [{ name: 'activeUsers' }],
    })) as { rows?: FilaInforme[] }
    return datos.rows?.length ? num(datos.rows[0], 0) : 0
  } catch (e) {
    console.error('[ga] tiempo real fallido:', e)
    return null
  }
}

/** Pulso de visitas para el inicio del dashboard: usuarios de los últimos 7
 *  días y de los 7 anteriores, en UN solo informe (el snapshot completo del
 *  panel lanza doce: aquí solo hace falta la cifra y su tendencia). */
let cachePulso: { ts: number; datos: { usuarios: number; previos: number } | null } | null = null

export async function pulsoVisitas(): Promise<{ usuarios: number; previos: number } | null> {
  if (cachePulso && Date.now() - cachePulso.ts < CACHE_MS) return cachePulso.datos
  const cfg = config()
  if (!cfg) return null
  try {
    const token = await tokenAcceso(cfg.email, cfg.key)
    // Dos rangos en la misma petición: la API añade la dimensión dateRange
    // (date_range_0 = últimos 7 días, date_range_1 = los 7 anteriores).
    const datos = (await llamada(cfg.propertyId, token, 'runReport', {
      dateRanges: [
        { startDate: '6daysAgo', endDate: 'today' },
        { startDate: '13daysAgo', endDate: '7daysAgo' },
      ],
      metrics: [{ name: 'activeUsers' }],
    })) as { rows?: FilaInforme[] }
    const de = (i: number) =>
      num(datos.rows?.find((f) => dim(f, 0) === `date_range_${i}`), 0)
    const pulso = { usuarios: de(0), previos: de(1) }
    cachePulso = { ts: Date.now(), datos: pulso }
    return pulso
  } catch (e) {
    console.error('[ga] pulso de visitas fallido:', e)
    cachePulso = { ts: Date.now(), datos: null } // no reintentar en ráfaga
    return null
  }
}

// Caché corto por rango: cambiar de pestaña o refrescar en ráfaga no repite
// los 12 informes contra Google (y la cuota de la Data API lo agradece).
const cacheVisitas = new Map<RangoDias, { ts: number; snap: VisitasSnapshot }>()
const CACHE_MS = 60_000

/** Visitas del rango elegido (con comparativa) + usuarios en tiempo real. */
export async function snapshotVisitas(dias: RangoDias = 30): Promise<VisitasSnapshot> {
  const generadoEn = new Date().toISOString()
  const cfg = config()
  if (!cfg) {
    return { configurado: false, generadoEn, error: null, dias, propertyId: '', ahora: null, ...VACIO }
  }

  const cacheado = cacheVisitas.get(dias)
  if (cacheado && Date.now() - cacheado.ts < CACHE_MS) return cacheado.snap

  try {
    const token = await tokenAcceso(cfg.email, cfg.key)
    const rango = [{ startDate: `${dias - 1}daysAgo`, endDate: 'today' }]
    // Dos rangos en la misma petición: la API añade la dimensión implícita
    // dateRange (date_range_0 = actual, date_range_1 = el periodo previo del
    // mismo tamaño, para la tendencia).
    const rangos = [...rango, { startDate: `${2 * dias - 1}daysAgo`, endDate: `${dias}daysAgo` }]
    const porValor = (metrica: string) => [{ metric: { metricName: metrica }, desc: true }]

    const [lote1, lote2, ahora] = await Promise.all([
      lote(cfg.propertyId, token, [
        {
          dateRanges: rango,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
        {
          dateRanges: rangos,
          metrics: [
            { name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' },
            { name: 'averageSessionDuration' }, { name: 'engagementRate' },
          ],
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: { fieldName: 'eventName', stringFilter: { matchType: 'BEGINS_WITH', value: 'clic_' } },
          },
          orderBys: porValor('eventCount'),
          limit: 10,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'sessionSource' }],
          metrics: [{ name: 'sessions' }],
          orderBys: porValor('sessions'),
          limit: 8,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }],
          orderBys: porValor('sessions'),
          limit: 6,
        },
      ]),
      lote(cfg.propertyId, token, [
        {
          dateRanges: rango,
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          // Fuera las rutas internas: la navegación SPA landing → dashboard
          // mantiene vivo el script de GA y la medición mejorada registraba
          // /app/* y /login (visitas propias, además ya filtradas por IP).
          dimensionFilter: {
            notExpression: {
              orGroup: {
                expressions: [
                  { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/app' } } },
                  { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/login' } } },
                ],
              },
            },
          },
          orderBys: porValor('screenPageViews'),
          limit: 8,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: porValor('activeUsers'),
          limit: 6,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'city' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: porValor('activeUsers'),
          limit: 6,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: porValor('activeUsers'),
          limit: 3,
        },
        {
          dateRanges: rango,
          dimensions: [{ name: 'browser' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: porValor('activeUsers'),
          limit: 5,
        },
      ]),
      // El tiempo real no debe tumbar la pestaña si falla: ya cae a null.
      visitantesAhora(),
    ])
    const [filasSerie, filasTotales, filasEventos, filasFuentes, filasCanales] = lote1
    const [filasPaginas, filasPaises, filasCiudades, filasDispositivos, filasNavegadores] = lote2

    // Tercer lote (los anteriores ya llevan 5): mapa horario y nuevos/recurrentes.
    const [filasHorario, filasNuevos] = await lote(cfg.propertyId, token, [
      {
        dateRanges: rango,
        dimensions: [{ name: 'dayOfWeek' }, { name: 'hour' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 200, // 7 × 24 = 168 combinaciones como máximo
      },
      {
        dateRanges: rango,
        dimensions: [{ name: 'newVsReturning' }],
        metrics: [{ name: 'activeUsers' }],
      },
    ])

    // Andamiaje de 30 días: la API omite los días sin datos y la gráfica
    // necesita la serie completa. Fechas en horario de Madrid, como GA.
    const porDia = new Map(
      filasSerie.map((f) => {
        const d = dim(f, 0) // YYYYMMDD
        return [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, f]
      }),
    )
    const serie: VisitasSnapshot['serie'] = []
    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date(Date.now() - i * 86_400_000).toLocaleDateString('en-CA', {
        timeZone: 'Europe/Madrid',
      })
      const fila = porDia.get(fecha)
      serie.push({ fecha, activos: fila ? num(fila, 0) : 0, vistas: fila ? num(fila, 1) : 0 })
    }

    // Totales con comparativa: una fila por rango de fechas.
    const actual = filasTotales.find((f) => dim(f, 0) === 'date_range_0')
    const previo = filasTotales.find((f) => dim(f, 0) === 'date_range_1')
    const met = (i: number, factor = 1): Metrica => ({
      actual: num(actual, i) * factor,
      previo: num(previo, i) * factor,
    })

    // Mapa horario: dayOfWeek de GA empieza en domingo (0); aquí, lunes primero.
    const horario = HORARIO_VACIO()
    for (const f of filasHorario) {
      const d = Number(dim(f, 0))
      const h = Number(dim(f, 1))
      if (d >= 0 && d < 7 && h >= 0 && h < 24) horario[(d + 6) % 7][h] = num(f, 0)
    }

    const snap: VisitasSnapshot = {
      configurado: true,
      generadoEn,
      error: null,
      dias,
      propertyId: cfg.propertyId,
      ahora,
      totales: {
        activos: met(0),
        sesiones: met(1),
        vistas: met(2),
        duracionSeg: met(3),
        interaccionPct: met(4, 100),
      },
      serie,
      conversiones: filas(filasEventos, EVENTOS_ES),
      fuentes: filas(filasFuentes, { '(direct)': 'Directo', '(not set)': 'Desconocida' }),
      canales: filas(filasCanales, CANALES_ES),
      paginas: filas(filasPaginas),
      paises: filas(filasPaises, PAISES_ES),
      ciudades: filas(filasCiudades, CIUDADES_ES),
      dispositivos: filas(filasDispositivos, DISPOSITIVOS_ES),
      navegadores: filas(filasNavegadores),
      nuevos: {
        nuevos: num(filasNuevos.find((f) => dim(f, 0) === 'new'), 0),
        recurrentes: num(filasNuevos.find((f) => dim(f, 0) === 'returning'), 0),
      },
      horario,
    }
    cacheVisitas.set(dias, { ts: Date.now(), snap })
    return snap
  } catch (e) {
    console.error('[ga] snapshot fallido:', e)
    return {
      configurado: true,
      generadoEn,
      error: e instanceof Error ? e.message : 'error desconocido',
      dias,
      propertyId: cfg.propertyId,
      ahora: null,
      ...VACIO,
    }
  }
}
