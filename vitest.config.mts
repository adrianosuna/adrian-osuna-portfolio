// Configuración de Vitest: tests unitarios de la lógica crítica (fórmulas de
// finanzas, parsers de GA, validaciones de server actions). Sin BD ni red:
// todo lo externo se mockea en cada suite.
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
    server: {
      deps: {
        // next-auth importa 'next/server' sin extensión: el ESM nativo de Node
        // lo rechaza; procesado por Vite (inline), resuelve sin problema.
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
})
