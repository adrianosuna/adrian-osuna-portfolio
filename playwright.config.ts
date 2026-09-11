import { defineConfig, devices } from '@playwright/test'

// E2E (Playwright, `e2e/`): la superficie pública y las invariantes de seguridad
// desde fuera. Los flujos autenticados no se automatizan: el OAuth de Google da falsos rojos.

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
  // Build de producción (las cabeceras y redirects difieren en dev) en su propia
  // carpeta (`NEXT_DIST_DIR`): con `.next` mataba el dev server levantado.
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
