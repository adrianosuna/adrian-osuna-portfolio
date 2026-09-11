import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// Dominios de Google Analytics 4 en la CSP siempre: sin consentimiento no se carga
// ningún script, y así la CSP no depende del env.
const GA_SCRIPT = "https://www.googletagmanager.com";
const GA_ENVIO = "https://*.google-analytics.com https://*.analytics.google.com";

// CSP. `script-src` lleva 'unsafe-inline' a propósito (Next hidrata con scripts en
// línea; los nonces exigen middleware). Fija el origen de cada recurso. Dev afloja eval y ws.
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
  // Fuera en desarrollo: impide abrir el sitio en un iframe (extensiones de vista
  // responsive) y en local no protege de nada.
  ...(DEV ? [] : ["frame-ancestors 'none'"]),
  // Los formularios solo pueden enviar al propio sitio: un XSS que inyecte
  // un <form action="https://…"> no se lleva nada.
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Next escribe un bloque propio al final de CLAUDE.md en cada `next dev`. Es un
  // fichero a mano y versionado: se apaga.
  agentRules: false,
  // Salida autocontenida para la imagen Docker (ver Dockerfile). Condicionada
  // por env porque `next start` (pnpm start local) no funciona con standalone.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // El dev server y el build comparten `.next`: construir con `pnpm dev` levantado lo
  // mata. `NEXT_DIST_DIR` da al build su propia carpeta (`pnpm build:aislado`, e2e).
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
  // Fuera el `X-Powered-By`: revela el framework sin dar nada. En el origen y no en
  // Caddy porque aquí es una línea.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Headers de seguridad para todo el sitio (anti-clickjacking, anti-MIME
        // sniffing, HSTS y recorte de referrer y de permisos del navegador).
        source: "/:path*",
        headers: [
          // En desarrollo nada de esto se aplica: XFO y frame-ancestors impiden el iframe de
          // las extensiones responsive. La CSP va en report-only para ver violaciones reales.
          ...(DEV ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          {
            key: DEV ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
            value: CSP,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Un año, subdominios incluidos. Sin `preload`: entrar en la lista es fácil y salir
          // tarda meses.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

// Análisis del bundle solo bajo demanda (`pnpm analyze`): abrir tres pestañas en
// cada build sería insufrible, y en CI un cuelgue.
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

export default withAnalyzer(nextConfig);
