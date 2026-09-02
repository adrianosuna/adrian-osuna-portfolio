// Las invariantes de seguridad, vistas DESDE FUERA.
//
// Es lo que ningún test unitario puede afirmar: allí `auth()` está mockeado, así
// que "el dashboard exige sesión" se prueba sobre un doble. Aquí se le pregunta
// al servidor montado, sin cookie, y se comprueba que no suelta nada.
import { expect, test } from '@playwright/test'

/** Páginas del dashboard (las que renderizan). */
const PAGINAS_PRIVADAS = [
  '/app',
  '/app/finance',
  '/app/finance?s=gastos',
  '/app/finance?s=ajustes',
  '/app/panel',
  '/app/panel?tab=usuarios&u=api',
  '/app/pipeline',
  '/app/una-ruta-que-no-existe',
]

/**
 * Textos que SOLO existen dentro del dashboard. Si alguno aparece en la
 * respuesta de una ruta pedida sin sesión, se está sirviendo contenido privado.
 *
 * Son cadenas de componentes, no palabras genéricas: la landing habla del
 * dashboard en sus casos de estudio, y buscar "dashboard" daría falsos rojos.
 */
const MARCADORES_PRIVADOS = [
  'Sesiones activas',
  'Tokens de la API',
  'Histórico de accesos',
  'Sin categoría',
  'Nuevo movimiento',
  'Resumen histórico',
]

test.describe('el dashboard no sirve nada sin sesión', () => {
  for (const ruta of PAGINAS_PRIVADAS) {
    test(`${ruta} manda al login y no suelta contenido`, async ({ request }) => {
      const res = await request.get(ruta, { maxRedirects: 0 })
      const cuerpo = await res.text()

      // Next puede resolver el redirect de DOS formas, y las dos valen:
      //   · 3xx con Location, cuando la guarda corta antes de renderizar.
      //   · 200 con el "error shell" cuyo payload lleva el NEXT_REDIRECT,
      //     cuando la página ya había empezado a emitir (metadata incluida).
      // Lo que se exige es lo que importa: que acabe en /login.
      const redirigido =
        [302, 303, 307, 308].includes(res.status()) &&
        (res.headers()['location'] ?? '').includes('/login')
      const redirigidoEnPayload =
        res.status() === 200 && cuerpo.includes('NEXT_REDIRECT') && cuerpo.includes('/login')

      expect(
        redirigido || redirigidoEnPayload,
        `${ruta} respondió ${res.status()} sin llevar al login`,
      ).toBe(true)

      // Y en ninguno de los dos casos puede venir contenido del dashboard. En
      // el "error shell" viaja el <title> de la página (metadata, no datos):
      // eso es lo único que se acepta.
      for (const marcador of MARCADORES_PRIVADOS) {
        expect(cuerpo, `${ruta} filtró «${marcador}»`).not.toContain(marcador)
      }
      // Ni una cifra en euros, que es lo que hay detrás de finanzas.
      expect(cuerpo).not.toMatch(/\d+,\d{2}\s*€/)
    })
  }

  test('la exportación a Excel responde 403, con su propia guarda', async ({ request }) => {
    // Es un route handler, no una página: el layout no lo protege y por eso
    // lleva su guarda de admin, que contesta con un código, no con un redirect.
    const res = await request.get('/app/finance/exportar?year=2026', { maxRedirects: 0 })
    expect(res.status()).toBe(403)
    const cuerpo = await res.text()
    // Nada de Excel en el cuerpo: ni la firma de un .xlsx (PK, zip).
    expect(cuerpo.startsWith('PK')).toBe(false)
  })
})

test.describe('API v1', () => {
  const CUERPO = { concepto: 'Prueba e2e', importe: '1,00' }

  test('sin cabecera Authorization devuelve 401 y no apunta nada', async ({ request }) => {
    const res = await request.post('/api/v1/movimientos', { data: CUERPO })
    expect(res.status()).toBe(401)
    expect((await res.json()).ok).toBe(false)
    // El estándar pide anunciar el esquema en el 401.
    expect(res.headers()['www-authenticate']).toContain('Bearer')
  })

  test('un token inventado no pasa, y nunca con un 500', async ({ request }) => {
    const res = await request.post('/api/v1/movimientos', {
      data: CUERPO,
      headers: { Authorization: 'Bearer ao_esto_no_existe' },
    })
    // 401 si la BD contesta (el token no está); 503 si la BD no contesta y por
    // tanto no se pudo comprobar. Un 500 sería un fallo de verdad: significa
    // que la excepción se ha escapado.
    expect([401, 503]).toContain(res.status())
    expect((await res.json()).ok).toBe(false)
  })

  test('las lecturas también exigen token', async ({ request }) => {
    for (const ruta of ['/api/v1/resumen', '/api/v1/categorias']) {
      expect([401, 503], ruta).toContain((await request.get(ruta)).status())
    }
  })

  test('el método equivocado devuelve 405, no un 500', async ({ request }) => {
    expect((await request.get('/api/v1/movimientos')).status()).toBe(405)
    expect((await request.post('/api/v1/resumen', { data: {} })).status()).toBe(405)
  })

  test('una ráfaga de tokens inválidos acaba en 429 con Retry-After', async ({ request }) => {
    // Es el tope estrecho de intentos FALLIDOS por IP: quien acierta el token
    // entra por el normal, mucho más ancho. Se comprueba desde fuera porque el
    // contador vive en el proceso del servidor.
    //
    // Con una IP PROPIA (`X-Forwarded-For`): los tests corren en paralelo y
    // sin esto esta ráfaga agotaría el cupo de los demás, que esperan un 401.
    // De paso comprueba que la clave sale de esa cabecera, que es de donde
    // tiene que salir detrás de Caddy.
    const soloParaEsteTest = { 'X-Forwarded-For': '203.0.113.99' }

    // EN PARALELO a propósito: sin base de datos cada intento se come el tope
    // de 5 s de la autenticación, y en serie esto tardaría minutos. Lanzadas
    // a la vez, las esperas se solapan.
    const respuestas = await Promise.all(
      Array.from({ length: 30 }, () =>
        request.get('/api/v1/resumen', {
          headers: { Authorization: 'Bearer ao_no_existe', ...soloParaEsteTest },
        }),
      ),
    )

    const codigos = respuestas.map((r) => r.status())
    // Cada una es 401 (token que no está), 503 (sin BD) o 429 (frenada).
    for (const c of codigos) expect([401, 503, 429]).toContain(c)

    const frenadas = respuestas.filter((r) => r.status() === 429)
    expect(frenadas.length, `códigos: ${codigos.join(",")}`).toBeGreaterThan(0)
    expect(Number(frenadas[0].headers()['retry-after'])).toBeGreaterThan(0)
    expect((await frenadas[0].json()).ok).toBe(false)
  })

  test('las respuestas de la API no se cachean', async ({ request }) => {
    const res = await request.get('/api/v1/resumen')
    expect(res.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('cabeceras de seguridad', () => {
  test('están puestas en la landing', async ({ request }) => {
    const h = (await request.get('/')).headers()
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['strict-transport-security']).toContain('max-age=31536000')
    expect(h['permissions-policy']).toContain('camera=()')
  })

  test('la CSP fija el origen de cada tipo de recurso', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("base-uri 'self'")
  })
})

test.describe('salud del contenedor', () => {
  test('/api/health responde 200 sin tocar la base de datos', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(res.headers()['cache-control']).toContain('no-store')
  })

  test('/api/ready contesta 200 o 503, nunca un 500', async ({ request }) => {
    // 503 es una respuesta legítima: significa "la BD no está". Lo que no vale
    // es que reviente, porque entonces no sirve para decidir nada.
    const res = await request.get('/api/ready')
    expect([200, 503]).toContain(res.status())
  })
})
