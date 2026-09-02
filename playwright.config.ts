import { defineConfig, devices } from '@playwright/test'

// Tests de extremo a extremo (Playwright), en `e2e/`.
//
// Qué cubren y qué NO: los flujos AUTENTICADOS no se pueden automatizar aquí —
// el único proveedor es Google, y meter un navegador por el OAuth de Google
// (con su captcha y su 2FA) no es un test, es una fuente de falsos rojos. Así
// que lo que se prueba es la superficie pública y, sobre todo, **las
// invariantes de seguridad que se ven desde fuera**: que ninguna ruta del
// dashboard sirva nada sin sesión, que la API rechace sin token y que las
// cabeceras estén puestas. Es justo lo que los tests unitarios no pueden
// afirmar, porque ahí `auth()` está mockeado.
//
// Los unitarios (Vitest, `tests/`) siguen siendo la red principal: esto son
// unas pocas comprobaciones de que el conjunto montado se comporta.

const PUERTO = 9445 // ni el de dev (9444) ni el de start (9443): no pisa nada

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Un fallo aquí es un fallo de verdad: no se reintenta para "ver si pasa".
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Build de PRODUCCIÓN a propósito: las cabeceras de seguridad y los redirects
  // se comportan distinto en el dev server (y la CSP se afloja en desarrollo).
  // ⚠ Con su PROPIA carpeta de build (`NEXT_DIST_DIR`). El dev server y el
  // build comparten `.next`, así que lanzar los e2e con `pnpm dev` levantado
  // MATABA el dev server — y sin nada escuchando, lo siguiente que falla es
  // cualquier cosa que apunte al 9444 (el navegador, una extensión de vista
  // responsive...). Con la carpeta aparte, los e2e y el desarrollo conviven.
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PUERTO}`,
    // Por `env` y no como prefijo del comando: en Windows los scripts corren
    // en cmd, donde `VAR=valor comando` no es sintaxis válida.
    env: { NEXT_DIST_DIR: '.next-aparte' },
    url: `http://127.0.0.1:${PUERTO}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
