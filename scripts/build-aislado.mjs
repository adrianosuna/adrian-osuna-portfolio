// `pnpm build:aislado`: build de producción en su PROPIA carpeta.
//
// Para qué: `pnpm build` escribe en `.next`, la misma carpeta que usa el dev
// server — construir con `pnpm dev` levantado lo MATA, y lo que se ve después
// es que "no carga nada" en el 9444 (el navegador, una extensión de vista
// responsive, el móvil en la red local...). Esto construye en `.next-aparte` y
// los dos conviven.
//
// `pnpm build` se queda como está a propósito: es lo que ejecutan el CI y el
// Dockerfile, y ahí `.next` es justo la carpeta que se espera.
//
// En un script y no como `NEXT_DIST_DIR=... pnpm build` porque en Windows los
// scripts de pnpm corren en cmd, donde esa sintaxis no es válida.
import { spawnSync } from 'node:child_process'

const { status } = spawnSync('next', ['build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: '.next-aparte' },
})

process.exit(status ?? 1)
