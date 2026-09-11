// `pnpm analyze`: build con el analizador. Es un script porque en Windows los scripts
// de pnpm corren en cmd, sin `VAR=valor`. Usa su propia carpeta de build.
import { spawnSync } from 'node:child_process'

const { status } = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ANALYZE: '1', NEXT_DIST_DIR: '.next-aparte' },
})

process.exit(status ?? 1)
