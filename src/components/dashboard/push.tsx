'use client'

// Notificaciones push: registro del service worker y el interruptor para
// activarlas en ESTE dispositivo.
//
// El service worker (`/public/sw.js`) hace dos cosas: servir la pantalla de
// "sin conexión" cuando falla una navegación, y recibir las notificaciones. Se
// registra siempre que se entra al dashboard, porque lo primero vale aunque no
// se activen los avisos.
//
// ⚠ En iPhone, el push SOLO funciona con la app INSTALADA en la pantalla de
// inicio (iOS 16.4+). En Safari a pelo el navegador ni ofrece el permiso, así
// que el interruptor lo dice en vez de fallar sin explicación.
import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Send } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { desuscribirPush, estadoPush, probarPush, suscribirPush } from '@/app/app/push-actions'

/** Registra el service worker (offline + push). No pinta nada. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // `scope: '/'` para que cubra la navegación de todo el sitio.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
      // Que falle no rompe nada: solo se pierde la pantalla offline y el push.
      console.warn('[sw] no se pudo registrar:', e)
    })
  }, [])
  return null
}

/**
 * La clave VAPID viaja en base64url y `subscribe` la quiere en bytes.
 *
 * El buffer se crea explícitamente (`new ArrayBuffer`) para que el tipo sea
 * `Uint8Array<ArrayBuffer>`: `new Uint8Array(n)` da `ArrayBufferLike`, que
 * incluye `SharedArrayBuffer` y no encaja donde se espera un `BufferSource`.
 */
function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length))
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

type Estado =
  | 'cargando'
  | 'no-soportado' // el navegador no tiene push (o iOS sin instalar)
  | 'sin-configurar' // el servidor no tiene claves VAPID
  | 'bloqueado' // el permiso está denegado en el navegador
  | 'inactivo'
  | 'activo'

/** Interruptor de avisos en el dispositivo, para el menú de perfil. */
export function TogglePush() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [clave, setClave] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    const mirar = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (vivo) setEstado('no-soportado')
        return
      }
      const { configurado, clave: pub } = await estadoPush()
      if (!vivo) return
      if (!configurado || !pub) {
        setEstado('sin-configurar')
        return
      }
      setClave(pub)
      if (Notification.permission === 'denied') {
        setEstado('bloqueado')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (vivo) setEstado(sub ? 'activo' : 'inactivo')
    }
    mirar().catch(() => {
      if (vivo) setEstado('no-soportado')
    })
    return () => {
      vivo = false
    }
  }, [])

  const activar = async () => {
    if (!clave) return
    setOcupado(true)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'inactivo')
        toast.error('Permiso de notificaciones no concedido')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        // Obligatorio en la web: no se admiten notificaciones silenciosas.
        userVisibleOnly: true,
        applicationServerKey: claveABytes(clave),
      })
      const res = await suscribirPush(JSON.parse(JSON.stringify(sub)))
      if (!res.ok) {
        await sub.unsubscribe()
        toast.error(res.message ?? 'No se pudo activar')
        setEstado('inactivo')
        return
      }
      setEstado('activo')
      toast.success('Avisos activados en este dispositivo')
    } catch (e) {
      console.error('[push] activación fallida:', e)
      toast.error('No se pudo activar en este navegador')
    } finally {
      setOcupado(false)
    }
  }

  const desactivar = async () => {
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await desuscribirPush(sub.endpoint)
        await sub.unsubscribe()
      }
      setEstado('inactivo')
      toast.success('Avisos desactivados aquí')
    } catch (e) {
      console.error('[push] baja fallida:', e)
      toast.error('No se pudo desactivar')
    } finally {
      setOcupado(false)
    }
  }

  // Estados en los que no hay nada que ofrecer: se explica en una línea en vez
  // de dejar un botón que siempre falla.
  if (estado === 'cargando') return null
  if (estado === 'no-soportado' || estado === 'sin-configurar' || estado === 'bloqueado') {
    const texto =
      estado === 'bloqueado'
        ? 'Avisos bloqueados en el navegador'
        : estado === 'sin-configurar'
          ? 'Avisos push sin configurar'
          : 'Este navegador no admite avisos'
    return (
      <p className="flex items-start gap-2 px-3 py-2 text-[12px] text-muted-foreground">
        <BellOff className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {texto}
          {estado === 'no-soportado' && (
            // El caso más probable en iPhone: Safari sin instalar la app.
            <span className="block text-muted-foreground">
              En iPhone hay que añadir la app a la pantalla de inicio.
            </span>
          )}
        </span>
      </p>
    )
  }

  const activo = estado === 'activo'
  return (
    <div className="flex items-center gap-1 px-3 py-1">
      <button
        type="button"
        className={cn(
          'flex flex-1 items-center gap-2 rounded-lg py-2 text-left text-sm transition-colors',
          activo ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-pressed={activo}
        disabled={ocupado}
        onClick={activo ? desactivar : activar}>
        {activo ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        {activo ? 'Avisos activados aquí' : 'Activar avisos aquí'}
      </button>
      {activo && (
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:p-2.5"
          aria-label="Enviar una notificación de prueba"
          title="Probar"
          disabled={ocupado}
          onClick={async () => {
            const res = await probarPush()
            if (res.ok) toast.success(res.message ?? 'Enviada')
            else toast.error(res.message ?? 'Error')
          }}>
          <Send className="size-3.5" />
        </button>
      )}
    </div>
  )
}
