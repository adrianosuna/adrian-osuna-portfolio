// Política de privacidad y cookies (requerida por el uso de Google Analytics).
// Paleta pública, texto plano y honesto: este sitio solo trata datos de
// analítica con consentimiento previo.
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
    <section className="mt-9">
      <h2 className="mb-3 text-lg font-bold text-foreground">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-[1.75] text-body">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="pf-public min-h-dvh bg-background text-body">
      <main className="mx-auto w-full max-w-190 px-[6%] py-14 sm:py-18">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="size-4" />
          Volver al portfolio
        </Link>

        <h1 className="text-3xl font-extrabold tracking-[-1px] text-foreground sm:text-4xl">
          Política de privacidad y cookies
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Última actualización: agosto de 2026</p>

        <Bloque titulo="1. Responsable">
          <p>
            El titular de este sitio web (adrianosuna.com) es <strong>Adrián Osuna Albalá</strong>,
            con domicilio en Moriles (Córdoba), España. Es un sitio personal, sin actividad
            comercial: un portfolio profesional. Para cualquier cuestión sobre esta política
            puedes escribir a{' '}
            <a className="font-semibold text-primary" href={`mailto:${PROFILE.email}`}>
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
            <a className="font-semibold text-primary" href={`mailto:${PROFILE.email}`}>
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
