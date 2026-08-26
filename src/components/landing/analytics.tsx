'use client'

// Google Analytics 4 con consentimiento previo (RGPD): no se carga NINGÚN
// script ni cookie hasta que el visitante acepta en el banner. La elección se
// guarda en localStorage; "Rechazar" es tan fácil como "Aceptar" y se puede
// cambiar desde /privacidad. Sin NEXT_PUBLIC_GA_ID no se renderiza nada.
import { useEffect, useSyncExternalStore } from 'react'
import Link from 'next/link'
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const CONSENT_KEY = 'pf_cookies'

type Consent = 'granted' | 'denied' | null

// Micro-store del consentimiento respaldado por localStorage: el servidor
// renderiza "sin decidir" (no pinta banner ni scripts) y el cliente resuelve
// tras hidratar, sin desajustes.
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

  // Eventos de conversión por delegación: cualquier elemento de la landing con
  // data-ga="nombre" dispara ese evento al hacer clic (los mide la pestaña
  // Visitas del Panel de control). Solo con consentimiento y gtag cargado.
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
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-130 rounded-2xl border border-border bg-popover p-4.5 shadow-[0_18px_50px_var(--pf-shadow)]">
          <p className="text-[13.5px] leading-relaxed text-body">
            Uso cookies de Google Analytics solo para saber cuánta gente visita la
            web. Si las rechazas, todo funciona exactamente igual.{' '}
            <Link href="/privacidad" className="font-semibold text-primary hover:text-primary-dark">
              Más información
            </Link>
          </p>
          <div className="mt-3.5 flex gap-2.5">
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-body transition-colors hover:border-primary hover:text-primary"
              onClick={() => setConsent('denied')}>
              Rechazar
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-btn px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-btn-hover"
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
      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:border-primary"
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
        // A la portada con carga completa: descarga los scripts de GA de la
        // sesión y el banner reaparece inmediatamente (feedback visible).
        // URL absoluta: la exige la regla de lint de Next para location.
        window.location.assign(new URL('/', window.location.origin))
      }}>
      Cambiar mi elección de cookies
    </button>
  )
}
