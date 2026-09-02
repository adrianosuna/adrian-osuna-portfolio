/* Service worker del dashboard. Dos cometidos, y solo dos:
 *
 *   1. VISTA OFFLINE. Si una navegación falla por falta de red, se sirve
 *      /offline en vez del error del navegador (que en una app instalada es
 *      una pantalla en blanco, peor todavía).
 *   2. NOTIFICACIONES PUSH. Recibe el mensaje del servidor, lo muestra y, al
 *      pulsarlo, lleva a la pantalla que toca.
 *
 * Lo que NO hace, a propósito: cachear las páginas del dashboard. Son datos
 * personales y cambian a cada rato; servir una versión vieja sería peor que
 * decir "sin conexión". Solo se precachea la propia página de aviso.
 *
 * Va en /public y no por un plugin (next-pwa y compañía) porque son 60 líneas
 * y así no hay una capa de build que envejezca sola.
 */

const CACHE = 'ao-offline-v1'
const OFFLINE = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: 'reload' }))),
  )
  // Sin esperar a que se cierren las pestañas viejas: es la primera versión.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpia cachés de versiones anteriores del SW.
      const nombres = await caches.keys()
      await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Solo las NAVEGACIONES (abrir una pantalla). Las peticiones de datos y las
  // server actions se dejan en paz: si fallan, cada vista ya lo gestiona.
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE)
      return (await cache.match(OFFLINE)) ?? new Response('Sin conexión', { status: 503 })
    }),
  )
})

// ─────────── notificaciones push ───────────

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : '' }
  }
  const titulo = datos.titulo || 'Adrián Osuna'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: '/apple-icon',
      badge: '/apple-icon',
      // `tag` agrupa: un segundo aviso del mismo tipo sustituye al anterior en
      // vez de apilar cinco notificaciones iguales.
      tag: datos.tag || 'aviso',
      data: { url: datos.url || '/app' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/app'
  event.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Si la app ya está abierta, se reutiliza esa ventana en vez de abrir otra.
      for (const c of abiertas) {
        if ('focus' in c) {
          await c.focus()
          if ('navigate' in c) await c.navigate(destino)
          return
        }
      }
      await self.clients.openWindow(destino)
    })(),
  )
})
