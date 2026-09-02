// `pnpm analyze`: build con el analizador de bundle encendido.
//
// Por qué un script y no `ANALYZE=1 next build` en el package.json: **en
// Windows los scripts de pnpm corren en cmd**, y ahí `VAR=valor comando` no es
// sintaxis válida — falla con "«ANALYZE» no se reconoce como un comando". Aquí
// la variable se pone en el proceso y se hereda, que funciona igual en Windows,
// en macOS y en el CI.
//
// De paso usa su PROPIA carpeta de build: analizar con el dev server levantado
// ya no lo mata (comparten `.next`; ver la nota de `next.config.ts`).
import { spawnSync } from 'node:child_process'

const { status } = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ANALYZE: '1', NEXT_DIST_DIR: '.next-aparte' },
})

process.exit(status ?? 1)
