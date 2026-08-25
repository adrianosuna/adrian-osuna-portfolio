import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida autocontenida para la imagen Docker (ver Dockerfile). Condicionada
  // por env porque `next start` (pnpm start local) no funciona con standalone.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // Hay un pnpm-lock.yaml suelto en el home que confunde la detección de raíz.
  turbopack: {
    root: __dirname,
  },
  // Solo afecta a desarrollo: permite probar desde el móvil en la red local
  // (el dev server bloquea por defecto los orígenes que no son localhost).
  allowedDevOrigins: ["192.168.1.138", "192.168.1.*"],
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
          { key: "X-Frame-Options", value: "DENY" },
          // CSP mínima sin riesgo de romper nada (una completa con script-src
          // requeriría nonces): bloquea plugins, <base> hostiles y embebido.
          {
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
