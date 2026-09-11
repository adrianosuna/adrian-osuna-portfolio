// Configuración de Vitest: tests unitarios sin BD ni red; lo externo se mockea en
// cada suite.
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // El marcador 'server-only' explota fuera de React Server Components;
      // en los tests se sustituye por un módulo vacío.
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Rellena lo que jsdom no implementa (matchMedia, scrollIntoView).
    setupFiles: ['tests/setup.ts'],
    // 20 s y no 5: varias suites hacen `await import()` dentro del test y ese import
    // arrastra Prisma y next-auth (647 ms libre, 4,8 s con carga). Ver CLAUDE.md.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    server: {
      deps: {
        // next-auth importa 'next/server' sin extensión: el ESM nativo de Node
        // lo rechaza; procesado por Vite (inline), resuelve sin problema.
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
})
