'use client'

// Google Analytics 4 con consentimiento previo (RGPD): ningún script hasta aceptar.
// La elección va en localStorage y se cambia desde /privacidad.
import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const CONSENT_KEY = 'pf_cookies'

type Consent = 'granted' | 'denied' | null

// Micro-store del consentimiento en localStorage: el servidor renderiza "sin
// decidir" y el cliente resuelve tras hidratar, sin desajustes.
let current: Consent | undefined
const subscribers = new Set<() => void>()

const getConsent = (): Consent => {
  if (current === undefined) {
    const stored = localStorage.getItem(CONSENT_KEY)
    current = stored === 'granted' || stored === 'denied' ? stored : null
  }
  return current
}

const setConsent = (value: Consent) => {
  current = value
  if (value === null) localStorage.removeItem(CONSENT_KEY)
  else localStorage.setItem(CONSENT_KEY, value)
  subscribers.forEach((notify) => notify())
}

const subscribe = (notify: () => void) => {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}

// undefined durante el SSR/hidratación → no se pinta nada todavía.
function useConsent() {
  return useSyncExternalStore(subscribe, getConsent, () => undefined as Consent | undefined)
}

export function Analytics() {
  const consent = useConsent()

  // Eventos de conversión por delegación: cualquier elemento con data-ga="nombre"
  // dispara ese evento al hacer clic. Solo con consentimiento y gtag cargado.
  useEffect(() => {
    if (consent !== 'granted') return
    const onClick = (e: MouseEvent) => {
      const nombre = (e.target as Element | null)?.closest?.('[data-ga]')?.getAttribute('data-ga')
      if (nombre) (window as { gtag?: (...args: unknown[]) => void }).gtag?.('event', nombre)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [consent])

  if (!GA_ID || consent === undefined) return null

  return (
    <>
      {consent === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });`}
          </Script>
        </>
      )}

      {consent === null && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-130 rounded-2xl border border-white/10 bg-popover p-4.5 shadow-[0_18px_50px_var(--pf-shadow)]">
          <p className="text-[13.5px] leading-relaxed text-body">
            Uso cookies de Google Analytics solo para saber cuánta gente visita la
            web. Si las rechazas, todo funciona exactamente igual.{' '}
            <Link href="/privacidad" className="font-medium text-foreground underline decoration-white/25 underline-offset-4 hover:text-primary hover:decoration-primary">
              Más información
            </Link>
          </p>
          <div className="mt-3.5 flex gap-2.5">
            <button
              type="button"
              className="flex-1 rounded-full border border-white/12 bg-white/3 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/6"
              onClick={() => setConsent('denied')}>
              Rechazar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-primary"
              onClick={() => setConsent('granted')}>
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Botón de /privacidad para retirar o cambiar la elección: borra la decisión
// guardada (y las cookies de GA si las hubiera) y recarga.
export function CookieReset() {
  return (
    <button
      type="button"
      className="rounded-full border border-white/12 bg-white/3 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/6"
      onClick={() => {
        setConsent(null)
        // Borra las cookies de GA (_ga y _ga_*) del dominio actual.
        document.cookie.split(';').forEach((c) => {
          const name = c.split('=')[0].trim()
          if (name.startsWith('_ga')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${location.hostname}`
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          }
        })
        // A la portada con carga completa: descarga los scripts de GA y el banner
        // reaparece. URL absoluta por la regla de lint de Next.
        window.location.assign(new URL('/', window.location.origin))
      }}>
      Cambiar mi elección de cookies
    </button>
  )
}
