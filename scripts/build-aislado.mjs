// `pnpm build:aislado`: build de producción en `.next-aparte` para no matar el dev
// server. Script y no `VAR=valor pnpm build`: en Windows los scripts corren en cmd.
import { spawnSync } from 'node:child_process'

const { status } = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: '.next-aparte' },
})

process.exit(status ?? 1)
