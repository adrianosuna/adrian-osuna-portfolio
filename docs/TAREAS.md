# Tareas pendientes

## Desplegar

Sin subir: **topes de gasto por categoría**, **movimientos recurrentes**, la
**sección Ajustes** (categorías con fusión, recurrentes y años de ahorro), los
**ámbitos del mantenimiento** (editables: servidor / casa / vehículo y los que
se añadan), las **notas del Panel** (editor visual, HTML saneado; ahora con pin,
buscador y listas de tareas), el **buscador de los selects**, la **barra de
carga**, la **paleta ⌘K** con alta rápida, la **búsqueda de movimientos**
(ahora paginada), la **PWA instalable**, la **nota y la división por
movimiento**, los **importes con decimales**, el **calendario de
mantenimiento**, el **histórico del monitor**, el **histórico de accesos**, las
**sub-pestañas de Usuarios**, el bloque de **productividad transversal**
(deshacer, búsqueda global ⌘K, atajos de teclado, accesos fijados, campana de
avisos, confirmaciones silenciables, estado en la URL y aviso de novedades —la
densidad compacta se hizo y se retiró—), el bloque **móvil/PWA** (push web,
vista offline, shortcuts del icono, splash de iOS, safe-area y el **menú de
acciones** de las filas), las **tablas unificadas**, los **recordatorios
puntuales** del mantenimiento, la **validación con Zod** de todas las actions,
el **rate limiting** y el bloque
de **plataforma**: la **API v1 para los Atajos de iOS** con sus tokens, «cerrar
todas las sesiones» y la **caducidad por inactividad**, la **CSP ampliada**,
`/api/health` y `/api/ready`, los **logs estructurados**, más Suspense y los
**e2e de Playwright**.

**DIEZ migraciones** —`topes_por_categoria`, `gastos_recurrentes`,
`ambitos_de_mantenimiento`, `origen_de_los_movimientos`, `ambitos_editables`,
`notas_y_unicidad` (tabla `note` + los índices únicos de la auditoría),
`notas_tareas_gastos_y_accesos` (`expense.note`, `note.pinned` y las tablas
`login_event` e `infra_sample`), `notificaciones_push` (tabla
`push_subscription`), `api_tokens` (tabla `api_token` + el índice
`idx_opportunity_updated`) y `recordatorios_puntuales`
(`maintenance_task.interval_months` pasa a admitir NULL)—, así que el build
necesita el perfil y el paso `migrate` antes del `up`:

```bash
cd /var/www/adrian-osuna-portfolio && git pull
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate
docker compose --env-file .env.production up -d
```

Tres dependencias nuevas de producción (**`sanitize-html`** para las notas,
**`web-push`** para las notificaciones y **`zod`** para la validación) y tres de desarrollo (`@playwright/test`,
`axe-core`, `@next/bundle-analyzer`), que el `pnpm install` del build instala
solas desde el lockfile. Procedimiento completo en `DESPLIEGUE.md` →
"Actualizaciones".

⚠ El lockfile trae además **overrides nuevos** (`mariadb` 3.4.7 y
`mysql2` >=3.22.0, que cierran los avisos de seguridad que quedaban): van en
`pnpm-workspace.yaml` y se aplican con el `--frozen-lockfile` del build, sin
hacer nada extra.

**Variables de entorno nuevas, TODAS OPCIONALES** (sin ellas todo se comporta
como antes salvo la inactividad de la sesión, que trae un valor por defecto):

```bash
npx web-push generate-vapid-keys
# → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (y VAPID_SUBJECT="mailto:...")
```

- `VAPID_*` — sin ellas el push queda inactivo. La privada es un secreto y
  **no se hornea en el build**: basta reiniciar el contenedor tras añadirlas.
- `LOG_LEVEL` — suelo del registro (por defecto `info` en producción).
- `SESION_DIAS` / `SESION_INACTIVIDAD_HORAS` — los dos plazos de caducidad de
  la sesión. ⚠ **Cambio de comportamiento**: la inactividad viene a **48 h** por
  defecto, así que una sesión que nadie toque dos días se cerrará sola (antes
  aguantaba los 7 días completos). Ponerla a `0` la desactiva.

Las diez migraciones están **aplicadas en la BD local** (`migrate diff` contra
la BD: sin drift). En producción siguen pendientes: van con el paso `migrate`.

⚠ Una vez desplegado, el cron **apuntará movimientos solo** en cuanto haya
recurrentes dados de alta (a las 8:00 y en la pasada de arranque), y empezará a
**muestrear la infraestructura** una vez al día: el bloque «Evolución» de la
pestaña Servidor necesita dos muestras, así que el primer día sale vacío y al
segundo ya hay línea.

⚠ El healthcheck de `web` ahora apunta a **`/api/health`** (antes,
`/robots.txt`). Es un cambio en `docker-compose.yml`, así que el `up -d`
recreará el contenedor — nada que hacer a mano.

### Primer token de la API, tras desplegar

La API de los Atajos no funciona hasta que exista un token, y solo se puede
crear desde la interfaz: **Panel de control → Usuarios → API → Nuevo token**.
El valor se muestra una sola vez; se pega en el Atajo y listo. Receta completa
en `API.md`.

## De la auditoría del 28/08/2026

Repaso completo (seguridad, código, dependencias y despliegue): nada crítico y
ningún agujero de autorización. Esto es lo que queda pendiente. Nada corre
prisa.

### Endurecimiento

Todo cerrado (ver `CHANGELOG.md`, 31/08 y 02/09): los cinco puntos originales,
las cabeceras de seguridad revisadas y **los avisos de `mariadb`**, que se
desbloquearon al publicarse el parche en la misma minor que el pin del adapter
(3.4.7, no el 3.5.1 que se temía). `pnpm audit` está **en cero**.

### Operación en el VPS

Healthcheck de `web`, techo a los logs y `.env.example` están **hechos** (ver
`CHANGELOG.md`, 31/08 y 02/09). Queda medio abierto uno:

- [ ] **Fijar el `mem_limit` de `db` y `web`**: el bloque está ya en
      `docker-compose.yml` **comentado**, con su cifra por decidir. No se puso a
      ciegas porque un límite por debajo de lo que consume el contenedor provoca
      justo el OOM que se quiere evitar. Solo falta mirar la RAM del VPS
      (`free -m`) y descomentar con un valor que deje aire a los dos.

## Ideas para cuando toque

- [ ] **Facturación: presupuestos y facturas propias.** Hoy no factura por su
      cuenta, así que no corre prisa; queda apuntado para cuando sí. El módulo
      sería la continuación natural del **pipeline**, que hoy se corta en
      "cerrada": presupuesto (número, cliente, líneas, validez) que al
      aceptarse se convierte en factura, con numeración por serie y año,
      IVA/IRPF, estado (emitida / cobrada), KPI de **por cobrar** y aviso del
      cron para las vencidas. `exceljs` ya está en el proyecto, y la plantilla
      de correo de la casa serviría para enviarlas.
      ⚠ Ojo con el idioma: en finanzas "presupuesto" ya significa otra cosa,
      así que los topes de gasto se llaman **topes** para no chocar con estos.

- [ ] **Límites y sanitizado de subidas de ficheros**, si algún día se añaden
      adjuntos. Hoy el proyecto **no tiene ninguna subida** —ni formulario, ni
      endpoint, ni almacenamiento—, así que escribirlos ahora sería código
      muerto. Cuando toque, el patrón está: el tope de cuerpo de la API v1
      (`_comun.ts`) y el saneado del HTML de las notas.

- [ ] **Mayores de las dependencias**: eslint 10, TypeScript 7, `@types/node`
      26 y Prisma 8 (en RC). Son migraciones deliberadas, cada una con sus
      cambios de ruptura; no entran en un `pnpm up`. Prisma es la más delicada
      (adapter, generated client y la BD con baseline).
---

Cómo funciona este fichero:

- Aquí vive **solo lo pendiente**. Al cerrar algo, se cuenta bien contado en
  `CHANGELOG.md` y se retira de aquí.
- Lo **recurrente** (dependencias, backups, GA4, dominio) no va aquí: vive en
  el módulo de **Mantenimiento** del Panel de control, que vence las tareas
  solo y avisa por correo desde el cron.
- Los descartes razonados (CSP con nonces, rate limit en Caddy, monitorización
  externa) están en `CHANGELOG.md`: no reabrirlos sin motivo. El módulo de
  notas fue uno de ellos y se reabrió a petición: hecho el 31/08 (ver
  `CHANGELOG.md`).
