# Tareas pendientes

**adrianosuna.com está en producción desde el 25/08/2026.** Aquí vive solo lo
pendiente, por horizontes: cuando algo se termina, se documenta bien contado
en `CHANGELOG.md` y se retira de aquí.

> **Flujo de actualización en producción** (cada vez que se suba un commit):
> `cd /var/www/adrian-osuna-portfolio && git pull && docker compose --env-file
> .env.production build && docker compose --env-file .env.production up -d`
> Con migraciones nuevas: el build lleva `--profile setup` (si no, la imagen
> de `migrate` no se reconstruye) y se ejecuta `migrate` antes del `up` — ver
> "Actualizaciones" en DESPLIEGUE.md.

---

## 1 · Operación recurrente (una vez al mes, 10 min)

- [ ] `pnpm deps` + `pnpm audit` en local; actualizar lo que toque y redesplegar.
      Dependencias retenidas a propósito (revisar si ya se pueden subir):
      - **eslint 10** — bloqueado hasta que `eslint-config-next` actualice sus
        plugins (`eslint-plugin-react` usa APIs eliminadas).
      - **TypeScript 7** — esperar al soporte de `typescript-eslint` (≥7.1).
      - **`@types/node`** — solo al cambiar el Node del sistema (hoy Node 24).
      - **next-auth** — fijado en `5.0.0-beta.32`; vigilar cuándo sale de beta.
- [ ] Vistazo a **GA4** (visitas, orígenes) y **Search Console** (búsquedas,
      indexación, errores de rastreo).
- [ ] Vistazo a los backups (`ls -lh ~/backups/`) y al estado de los
      contenedores (`docker compose ps` — db healthy, web up).

## 2 · Siguiente feature: tab de Gastos en Finanzas

La feature estrella del backlog — registro de movimientos por categorías y
resumen mensual en `/app/finance`.

- [ ] Modelo de datos: tabla `expense` nueva (id + uuid + FK a `saving_year`
      o fecha propia, concepto, categoría, importe, timestamps).
      ⚠ **Nota sobre migraciones**: seguir el flujo ya rodado (ver CLAUDE.md):
      generar el SQL con `prisma migrate diff` schema-a-schema (sin tocar la
      BD), aplicarlo en local con `migrate deploy` y en producción con el
      servicio `migrate`. Nunca `prisma migrate dev`/`reset` contra `ao_test`
      (tiene datos reales).
- [ ] Server actions + página con la misma estructura que el módulo de ahorro
      (borrador editable, `revalidatePath`, mensajes vía `AppError`).
- [ ] Al terminar: actualizar la tarjeta "Gastos del mes" del inicio del
      dashboard (hoy muestra "—" / "En desarrollo").

## 3 · Backlog (sin prisa, por orden sugerido)

- [ ] **Ajustar la fecha de la tarea "Renovar dominio"** a su caducidad real
      en OVH (Panel de control → Mantenimiento → editar la tarea). Solo puede
      hacerlo Adrián.
- [ ] **Dato real para los casos de estudio**: si algún día hay una cifra
      publicable de Client360 o IntarLAB (usuarios, cálculos, ensayos/mes),
      añadirla a "El resultado" del caso — multiplica la fuerza del cierre.

Los descartes razonados (CSP con nonces, rate limit en Caddy, monitorización
externa, módulo de notas...) están documentados en `CHANGELOG.md` para no
reabrirlos sin motivo.
