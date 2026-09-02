import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Dominios de Google Analytics 4. Solo hacen falta si `NEXT_PUBLIC_GA_ID`
// está puesto, pero la CSP se calcula en el build y el consentimiento se
// decide en el navegador: dejarlos siempre no abre nada (sin consentimiento
// no se carga ningún script de Google) y evita una CSP que dependa del env.
const GA_SCRIPT = "https://www.googletagmanager.com";
const GA_ENVIO = "https://*.google-analytics.com https://*.analytics.google.com";

// Content-Security-Policy.
//
// ⚠ `script-src` lleva 'unsafe-inline' A PROPÓSITO. Next inyecta scripts en
// línea para hidratar (self.__next_f), así que una CSP estricta necesitaría
// nonces por petición — que exige middleware y se descartó en su día por lo
// que costaba frente a lo que aportaba aquí (React escapa el contenido y no
// se construye HTML a mano salvo en el tooltip, que escapa lo que recibe).
// Lo que sí aporta esta versión, y no tenía la mínima anterior: fija el
// ORIGEN de cada tipo de recurso, así que un script, una hoja de estilos o
// una petición a un dominio que no esté aquí no se ejecuta. Eso deja fuera la
// exfiltración a un servidor ajeno, que es el remate de casi cualquier XSS.
//
// Las fuentes son self-hosted (next/font las hornea en /_next/static), así
// que `font-src` no necesita fonts.gstatic.com.
//
// En DESARROLLO se aflojan dos cosas que solo existen ahí: Turbopack compila
// con eval() y el HMR abre un websocket. Sin esto, la CSP de producción
// rompería el dev server, y una CSP que solo se prueba en producción es una
// CSP que se descubre roto en producción.
const DEV = process.env.NODE_ENV !== "production";
const EVAL = DEV ? " 'unsafe-eval'" : "";
const HMR = DEV ? " ws: wss:" : "";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${EVAL} ${GA_SCRIPT}`,
  // Tailwind y los estilos en línea de React (variables de tema, alturas de
  // barra) necesitan 'unsafe-inline'; no hay hoja de estilos externa.
  "style-src 'self' 'unsafe-inline'",
  // data: para los SVG y las splash generadas; el avatar viene de Google.
  `img-src 'self' data: blob: https://lh3.googleusercontent.com ${GA_SCRIPT} ${GA_ENVIO}`,
  "font-src 'self' data:",
  // Server actions y router van al propio origen; el resto es la telemetría
  // de GA4 (y el push, que sale del service worker al endpoint del navegador).
  `connect-src 'self'${HMR} ${GA_SCRIPT} ${GA_ENVIO}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  // Nada de plugins, ni <base> hostil, ni iframes (ni propios ni ajenos).
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
  // Fuera en desarrollo: es la que impide abrir el sitio dentro de un iframe
  // (extensiones de vista responsive). En report-only no bloquearía, pero
  // tampoco aporta, y así el aviso no sale por algo que da igual en local.
  ...(DEV ? [] : ["frame-ancestors 'none'"]),
  // Los formularios solo pueden enviar al propio sitio: un XSS que inyecte
  // un <form action="https://…"> no se lleva nada.
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Next 16.3.4 escribe un bloque propio al final de CLAUDE.md en cada
  // `next dev` («This is NOT the Next.js you know»). CLAUDE.md es un fichero
  // a mano, en español y versionado: una herramienta que lo reescribe sola
  // ensucia el diff en cada arranque. Se apaga.
  agentRules: false,
  // Salida autocontenida para la imagen Docker (ver Dockerfile). Condicionada
  // por env porque `next start` (pnpm start local) no funciona con standalone.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // ⚠ El dev server y el build COMPARTEN `.next`: construir con `pnpm dev`
  // levantado lo mata. Con `NEXT_DIST_DIR` se le da al build su propia
  // carpeta y dejan de pisarse — es lo que hacen los e2e, que construyen
  // solos (ver `playwright.config.ts`). Para un build a mano sin cortar el
  // dev server: `pnpm build:aislado`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Fecha de build horneada para el monitor de infraestructura ("versión
  // desplegada"). En desarrollo equivale al arranque del dev server.
  env: {
    BUILD_TS: new Date().toISOString(),
  },
  // Hay un pnpm-lock.yaml suelto en el home que confunde la detección de raíz.
  turbopack: {
    root: __dirname,
  },
  // Solo afecta a desarrollo: permite probar desde el móvil en la red local
  // (el dev server bloquea por defecto los orígenes que no son localhost).
  allowedDevOrigins: ["192.168.1.*"],
  images: {
    // Avatares de la cuenta de Google (foto de perfil en el dashboard).
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [
      {
        // Headers de seguridad para todo el sitio (anti-clickjacking, anti-MIME
        // sniffing, HSTS y recorte de referrer y de permisos del navegador).
        source: "/:path*",
        headers: [
          // ⚠ En DESARROLLO nada de esto se APLICA, y es a propósito:
          //
          //   · `X-Frame-Options: DENY` y `frame-ancestors 'none'` impiden que
          //     la página se cargue dentro de un iframe, que es exactamente
          //     cómo funcionan las extensiones de vista responsive (varios
          //     móviles a la vez, con los clics espejados).
          //   · La CSP completa bloquea además los recursos que inyectan las
          //     extensiones y algunas herramientas del navegador.
          //
          // Y en local no protegen de nada. Así que en desarrollo la CSP va en
          // **report-only** (avisa en la consola, no bloquea) y el
          // anti-clickjacking no se manda. En producción, las dos aplicadas.
          //
          // Report-only y no "quitarla del todo" para no perder lo que la
          // hacía útil en dev: que una violación real se vea aquí y no se
          // descubra en producción.
          ...(DEV ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          {
            key: DEV ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            value: CSP,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Un año, subdominios incluidos. SIN `preload`: entrar en la lista
          // del navegador es fácil y salir tarda meses, y afectaría a
          // cualquier subdominio futuro que aún no sirva HTTPS.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

// Análisis del bundle, apagado salvo que se pida (`pnpm analyze`): envuelve la
// config y, al construir, abre el treemap de cada chunk en el navegador. Va
// tras un env y no siempre porque abrir tres pestañas en cada `pnpm build`
// sería insufrible — y en CI, directamente un cuelgue.
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

export default withAnalyzer(nextConfig);
