// Política de privacidad y cookies, requerida por Google Analytics. Estilo de la landing.
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CookieReset } from '@/components/landing/analytics'
import { PROFILE } from '@/lib/landing/content'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Política de privacidad y cookies de adrianosuna.com.',
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/8 py-8">
      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em] text-foreground">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-[1.75] text-body">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="pf-public relative min-h-dvh overflow-hidden bg-background text-body">
      <div aria-hidden="true" className="pf-grid absolute inset-x-0 top-0 h-128 mask-[radial-gradient(ellipse_70%_80%_at_50%_0%,#000_10%,transparent_75%)]" />
      <div aria-hidden="true" className="pf-hero-glow" />
      <main className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:px-8 sm:py-20">
        <Link
          href="/"
          // py-2: zona táctil suficiente para el pulgar sin cambiar el aspecto.
          className="mb-8 flex w-fit items-center gap-1.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Volver al portfolio
        </Link>

        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Legal
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
          Política de privacidad y cookies
        </h1>
        <p className="mb-10 mt-4 text-sm text-muted-foreground">Última actualización: agosto de 2026</p>

        <Bloque titulo="1. Responsable">
          <p>
            El titular de este sitio web (adrianosuna.com) es <strong>Adrián Osuna Albalá</strong>,
            con domicilio en Moriles (Córdoba), España. Es un sitio personal, sin actividad
            comercial: un portfolio profesional. Para cualquier cuestión sobre esta política
            puedes escribir a{' '}
            <a className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary" href={`mailto:${PROFILE.email}`}>
              {PROFILE.email}
            </a>
            .
          </p>
        </Bloque>

        <Bloque titulo="2. Qué datos se tratan">
          <p>
            La parte pública de este sitio <strong>no recoge datos personales por sí misma</strong>:
            no hay formularios ni registro. El único tratamiento es la <strong>analítica de
            visitas</strong> mediante Google Analytics 4, y solo si la aceptas expresamente en el
            aviso de cookies.
          </p>
          <p>
            Si aceptas, Google Analytics instala cookies (<code>_ga</code> y <code>_ga_*</code>,
            con una duración de hasta 2 años) y recoge datos de uso: páginas visitadas, duración
            de la visita, tipo de dispositivo y navegador, y ubicación aproximada derivada de la
            dirección IP (que se trata de forma anonimizada). Estos datos son estadísticos y no
            se usan para identificarte.
          </p>
          <p>
            Si escribes al correo de contacto, tus datos (tu dirección y lo que escribas) se usan
            únicamente para responderte.
          </p>
        </Bloque>

        <Bloque titulo="3. Finalidad y base legal">
          <p>
            La finalidad de la analítica es conocer el uso del sitio para mejorarlo. La base
            legal es tu <strong>consentimiento</strong> (art. 6.1.a RGPD), que se solicita antes
            de cargar ningún script de analítica. Si rechazas las cookies, no se instala ninguna
            y el sitio funciona exactamente igual.
          </p>
        </Bloque>

        <Bloque titulo="4. Destinatarios">
          <p>
            Los datos de analítica los trata <strong>Google Ireland Ltd.</strong> (y Google LLC,
            EE. UU.) como proveedor de Google Analytics. Las transferencias internacionales se
            amparan en el marco de privacidad de datos UE-EE. UU. (EU-U.S. Data Privacy
            Framework). No se ceden datos a ningún otro tercero.
          </p>
        </Bloque>

        <Bloque titulo="5. Conservación">
          <p>
            Los datos de analítica se conservan en Google Analytics durante un máximo de
            14 meses. Los correos de contacto, el tiempo necesario para atender la conversación.
          </p>
        </Bloque>

        <Bloque titulo="6. Tus derechos">
          <p>
            Puedes ejercer los derechos de acceso, rectificación, supresión, oposición,
            limitación y portabilidad escribiendo a{' '}
            <a className="font-medium text-foreground underline decoration-white/25 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary" href={`mailto:${PROFILE.email}`}>
              {PROFILE.email}
            </a>
            . También puedes reclamar ante la Agencia Española de Protección de Datos
            (aepd.es) si consideras que un tratamiento no se ajusta a la normativa.
          </p>
        </Bloque>

        <Bloque titulo="7. Retirar el consentimiento">
          <p>
            Puedes cambiar tu decisión sobre las cookies en cualquier momento. Este botón borra
            tu elección y las cookies de analítica de este navegador, y te vuelve a mostrar el
            aviso:
          </p>
          <CookieReset />
        </Bloque>
      </main>
    </div>
  )
}
