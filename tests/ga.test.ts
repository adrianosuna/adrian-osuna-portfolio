// Parsers de la capa de GA (src/lib/ga.ts) contra una Data API simulada:
// andamiaje de la serie (la API omite los días a cero), comparativa por
// dateRange, transposición del mapa horario (GA empieza en domingo; aquí,
// lunes), traducciones y tolerancia a fallos del tiempo real.
import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Clave RSA real: el JWT se firma de verdad antes de llegar al fetch mockeado.
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const CLAVE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

type Informe = { rows?: Array<{ dimensionValues?: Array<{ value: string }>; metricValues?: Array<{ value: string }> }> }

const fila = (dims: string[], mets: number[]) => ({
  dimensionValues: dims.map((value) => ({ value })),
  metricValues: mets.map((v) => ({ value: String(v) })),
})

// Día de la serie en el formato de GA (YYYYMMDD), RELATIVO a hoy y en el mismo
// horario que usa ga.ts. Con fechas fijas el test caducaba: la serie son los
// `dias` últimos días HASTA HOY, así que un día escrito a mano se sale de la
// ventana en cuanto pasa el tiempo (y el andamiaje lo rellenaba a cero).
const diaGA = (atras: number) =>
  new Date(Date.now() - atras * 86_400_000)
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
    .replace(/-/g, '')

// Respuestas canned: cada lote se reconoce por la primera dimensión pedida.
function respuestaLote(cuerpo: { requests: Array<{ dimensions?: Array<{ name: string }> }> }): { reports: Informe[] } {
  const primera = cuerpo.requests[0]?.dimensions?.[0]?.name
  if (primera === 'date') {
    // Lote 1: serie (solo 2 días con datos), totales (2 rangos), eventos,
    // fuentes y canales.
    return {
      reports: [
        { rows: [fila([diaGA(1)], [3, 9]), fila([diaGA(0)], [5, 12])] },
        { rows: [fila(['date_range_0'], [40, 60, 150, 95.5, 0.62]), fila(['date_range_1'], [20, 30, 75, 60, 0.5])] },
        { rows: [fila(['clic_contactar'], [4]), fila(['clic_demo'], [2])] },
        { rows: [fila(['(direct)'], [30]), fila(['linkedin.com'], [12])] },
        { rows: [fila(['Direct'], [30]), fila(['Organic Search'], [18])] },
      ],
    }
  }
  if (primera === 'pagePath') {
    // Lote 2: páginas, países, ciudades, dispositivos, navegadores.
    // Las páginas piden DOS rangos, así que cada ruta vuelve dos veces con la
    // dimensión implícita del rango: actual (date_range_0) y previo (_1).
    return {
      reports: [
        {
          rows: [
            fila(['/', 'date_range_0'], [90]),
            fila(['/', 'date_range_1'], [60]),
            fila(['/privacidad', 'date_range_0'], [12]),
            // Sin fila previa: /privacidad es "nueva" en este periodo.
            fila(['/casos', 'date_range_1'], [40]),
          ],
        },
        { rows: [fila(['Spain'], [35]), fila(['(not set)'], [2])] },
        { rows: [fila(['Seville'], [8]), fila(['Lucena'], [5])] },
        { rows: [fila(['desktop'], [22]), fila(['mobile'], [18])] },
        { rows: [fila(['Chrome'], [30])] },
      ],
    }
  }
  // Lote 3: mapa horario (dayOfWeek 0 = DOMINGO en GA) y nuevos/recurrentes.
  return {
    reports: [
      { rows: [fila(['0', '10'], [7]), fila(['1', '23'], [3])] },
      { rows: [fila(['new'], [28]), fila(['returning'], [12])] },
    ],
  }
}

function mockFetch(opciones: { realtimeFalla?: boolean } = {}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'token-de-prueba', expires_in: 3600 }))
    }
    if (u.includes(':runRealtimeReport')) {
      if (opciones.realtimeFalla) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ rows: [fila([], [2])] }))
    }
    if (u.includes(':batchRunReports')) {
      const cuerpo = JSON.parse(String(init?.body))
      return new Response(JSON.stringify(respuestaLote(cuerpo)))
    }
    throw new Error(`URL inesperada en el test: ${u}`)
  })
}

async function cargarGa() {
  // Import fresco por test: ga.ts cachea token e instantáneas a nivel de módulo.
  vi.resetModules()
  return import('@/lib/ga')
}

beforeEach(() => {
  process.env.GA_PROPERTY_ID = '123456'
  process.env.GA_SA_CLIENT_EMAIL = 'test@proyecto.iam.gserviceaccount.com'
  process.env.GA_SA_PRIVATE_KEY = CLAVE_PEM.replace(/\n/g, '\\n')
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GA_PROPERTY_ID
  delete process.env.GA_SA_CLIENT_EMAIL
  delete process.env.GA_SA_PRIVATE_KEY
})

describe('snapshotVisitas', () => {
  it('sin variables de entorno queda "sin configurar" y no llama a la red', async () => {
    delete process.env.GA_PROPERTY_ID
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.configurado).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rellena a cero los días que la API omite y respeta el tamaño del rango', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(7)
    expect(snap.error).toBeNull()
    expect(snap.serie).toHaveLength(7)
    // Todos los días presentes en formato YYYY-MM-DD y los omitidos a cero.
    expect(snap.serie.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.fecha))).toBe(true)
    const conDatos = snap.serie.filter((d) => d.activos > 0)
    expect(conDatos.map((d) => d.activos).sort()).toEqual([3, 5])
    expect(snap.serie.filter((d) => d.activos === 0)).toHaveLength(5)
  })

  it('separa la comparativa por dateRange (actual vs. periodo previo)', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.totales.activos).toEqual({ actual: 40, previo: 20 })
    expect(snap.totales.sesiones).toEqual({ actual: 60, previo: 30 })
    // engagementRate llega en tanto por uno y se expone en porcentaje.
    expect(snap.totales.interaccionPct).toEqual({ actual: 62, previo: 50 })
  })

  it('empareja cada página con su periodo previo, ordenada por lo actual', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    // Ordenadas por el valor ACTUAL (no por el previo, que es lo que ordena GA
    // al mezclar los dos rangos en la misma respuesta).
    expect(snap.paginas.map((p) => p.etiqueta)).toEqual(['/', '/privacidad', '/casos'])
    expect(snap.paginas[0]).toEqual({ etiqueta: '/', valor: 90, previo: 60 })
    // Solo en el periodo actual: previo 0 (la UI lo pinta como "nueva").
    expect(snap.paginas[1]).toEqual({ etiqueta: '/privacidad', valor: 12, previo: 0 })
    // Solo en el previo: sigue apareciendo, con 0 actual (ha desaparecido).
    expect(snap.paginas[2]).toEqual({ etiqueta: '/casos', valor: 0, previo: 40 })
  })

  it('traduce canales, países, ciudades, dispositivos y eventos', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.canales[0].etiqueta).toBe('Directo')
    expect(snap.canales[1].etiqueta).toBe('Búsqueda orgánica')
    expect(snap.paises.map((p) => p.etiqueta)).toEqual(['España', 'Desconocido'])
    expect(snap.ciudades[0].etiqueta).toBe('Sevilla')
    expect(snap.ciudades[1].etiqueta).toBe('Lucena') // sin mapa: se deja tal cual
    expect(snap.dispositivos.map((d) => d.etiqueta)).toEqual(['Ordenador', 'Móvil'])
    expect(snap.conversiones[0].etiqueta).toBe('Botón "Contactar"')
    expect(snap.fuentes[0].etiqueta).toBe('Directo')
  })

  it('transpone el mapa horario: dayOfWeek 0 de GA (domingo) va a la fila 6', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.horario).toHaveLength(7)
    expect(snap.horario.every((f) => f.length === 24)).toBe(true)
    expect(snap.horario[6][10]).toBe(7) // domingo 10:00
    expect(snap.horario[0][23]).toBe(3) // lunes 23:00
    expect(snap.horario[3][12]).toBe(0)
  })

  it('nuevos vs. recurrentes y usuarios en tiempo real', async () => {
    vi.stubGlobal('fetch', mockFetch())
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.nuevos).toEqual({ nuevos: 28, recurrentes: 12 })
    expect(snap.ahora).toBe(2)
  })

  it('si el tiempo real falla, la pestaña no cae: ahora = null y el resto vive', async () => {
    vi.stubGlobal('fetch', mockFetch({ realtimeFalla: true }))
    const { snapshotVisitas } = await cargarGa()
    const snap = await snapshotVisitas(30)
    expect(snap.error).toBeNull()
    expect(snap.ahora).toBeNull()
    expect(snap.totales.activos.actual).toBe(40)
  })

  it('cachea la instantánea 60 s por rango (sin repetir informes)', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    const { snapshotVisitas } = await cargarGa()
    const primera = await snapshotVisitas(30)
    const llamadas = fetchMock.mock.calls.length
    const segunda = await snapshotVisitas(30)
    expect(segunda).toBe(primera)
    expect(fetchMock.mock.calls.length).toBe(llamadas)
    // Otro rango NO comparte caché.
    await snapshotVisitas(7)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(llamadas)
  })
})
