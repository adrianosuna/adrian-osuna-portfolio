# CLAUDE.md

Orientación para Claude (y para el desarrollo) al trabajar en este repositorio.
Las tareas pendientes viven en `docs/TAREAS.md` y **lo terminado se documenta
en `docs/CHANGELOG.md`** (bien explicado, con fecha) retirándolo de TAREAS —
mantener esa pareja al cerrar cualquier trabajo. La documentación adicional va
siempre en `docs/`; en la raíz solo README y CLAUDE.

## Comandos

Gestor de paquetes: `pnpm`.

```bash
pnpm dev                 # desarrollo (puerto 9444, Turbopack; prod: 9443)
pnpm build               # build de producción (incluye type-check)
pnpm test                # tests unitarios (Vitest, carpeta tests/)
pnpm lint                # ESLint
pnpm exec tsc --noEmit   # solo type-check
pnpm prisma generate     # regenerar el cliente (tras tocar schema.prisma)
pnpm prisma db seed      # asegura ADMIN_EMAIL como admin activo
pnpm deps                # lista dependencias desactualizadas (pnpm outdated)
```

Los tests (Vitest, `tests/`) cubren la lógica crítica sin BD ni red: fórmulas
del ahorro, fechas de la experiencia, parsers de GA (API mockeada), umbrales
del monitor de infraestructura (TLS/fs/reloj simulados), validaciones/guardas
de todas las server actions, la lógica del pipeline (métricas del embudo y
aviso de seguimientos), los callbacks de `auth.ts` (la config se exporta
como `authConfig` precisamente para poder invocarlos con mocks), las
superficies GEO (robots + llms.txt) y los campos custom de `fields.tsx` y el
`Modal` común (jsdom + Testing Library; el resto corre en node). `server-only` se alias-ea a
un stub y `next-auth` se procesa inline en `vitest.config.mts`.
Antes de dar algo por terminado: `pnpm test`, `pnpm lint` y `pnpm build`.

⚠ **Gotcha del optimizador de imágenes**: al sustituir una imagen de `public/`
por otra con el mismo nombre, Turbopack sigue sirviendo la vieja — su caché
(`.next/dev/cache/images`, ojo: bajo `dev/`) no se invalida ni reiniciando el
servidor. Solución: parar el dev server, borrar esa carpeta y arrancar.

## ⚠️ Base de datos: heredada y con baseline

La BD de desarrollo local es `ao_test` en el MySQL local, **heredada del
Portfolio antiguo (Express + SQL raw), que ya no existe**: sus tablas y datos
reales siguen ahí y ahora solo los usa esta app. El usuario MySQL `aosuna`
solo tiene permisos sobre `ao_test` (no puede crear otras bases de datos).
En **producción** la BD es propia y empieza vacía: contenedor MySQL del
`docker-compose.yml`, creada con `migrate deploy` + seed.

- **NUNCA ejecutar `prisma migrate dev` ni `prisma migrate reset` a la ligera**:
  detectarían drift y propondrían resetear una BD con datos reales.
- El esquema se adoptó con baseline: `prisma/migrations/0_init` está marcado como
  aplicado (`prisma migrate resolve --applied 0_init`), sin ejecutarse.
- La tabla `migrations` es una huérfana de db-migrate (del Portfolio antiguo)
  que sigue en la BD local; está declarada **externa** en `prisma.config.ts`
  (`tables.external` + `experimental.externalTables`) para que Prisma la ignore.
  Puede eliminarse (`DROP TABLE migrations`) retirando entonces esa declaración.
- Para cambios de esquema (flujo ya rodado): generar el SQL con
  `prisma migrate diff --from-schema <copia previa> --to-schema prisma/schema.prisma
  --script` (sin tocar la BD; en PowerShell redirigir con `cmd /c` para evitar
  el BOM), revisarlo, y aplicarlo con `prisma migrate deploy` (en producción,
  vía el servicio `migrate` del compose).
- El schema refleja la BD exacta (via `prisma db pull` en su día): `TIMESTAMP(0)`,
  nombres de índice, `onUpdate: NoAction`. Mantener esa fidelidad al editarlo.

## Arquitectura

Proyecto Next.js App Router con `src/`. **Paleta única en todo el sitio**
(unificada el 25/08/2026: el dashboard abandonó el azul #1570ef heredado):

- **Tokens de `:root`** en `globals.css`: la esmeralda/teal del `_palette.scss`
  del Portfolio original (`--primary: #10b981`, fondo `#0a1512`, tarjetas
  translúcidas), más los tokens semánticos del dashboard (`--success`,
  `--warning`, `--danger`, `--viajes` con sus `-bg`). `--primary-foreground`
  es oscuro: el blanco sobre esmeralda no da contraste AA.
- **Páginas públicas** (landing `/`, login `/login`, `/privacidad`): la clase
  `.pf-public` ya solo aporta tokens extra propios de la landing (`--pf-btn`,
  `--pf-accent`, glow, nav...). La landing gira alrededor de los **proyectos
  como casos de estudio** (reto → qué construí → resultado); sus componentes
  viven en `src/components/landing/` y su contenido (perfil, experiencia,
  textos, casos) en `src/lib/landing/content.ts` — la única fuente de verdad
  del contenido.
- **Dashboard** (`/app/*`): componentes en `src/components/dashboard/`.
  Los modales usan siempre `src/components/ui/modal.tsx` (cabecera y pie
  fijos, cuerpo con scroll); los popovers de `fields.tsx` (select, calendario)
  se renderizan en un portal con posición fija — nunca los recorta un
  contenedor con overflow.
- **Tema único oscuro**: el selector claro/oscuro se retiró; los tokens de
  `:root` ya son los oscuros (sin clase `dark` ni `next-themes`).

### Convenciones de datos (heredadas del proyecto original)

- Toda tabla: `id` autoincremental + `uuid` único (identificador de negocio,
  usado en URLs y FKs) + `create_ts`/`update_ts`. Las FKs referencian `uuid`.
- Campos camelCase en Prisma mapeados a columnas snake_case (`@map`).
- Nombres de tabla/columna en inglés (compatibilidad con la BD del viejo);
  UI, comentarios y textos siempre en **español**.

### Autenticación (`src/auth.ts`)

NextAuth v5, solo Google, allowlist en la tabla `user`: si el correo no existe,
está `DISABLED` o Google no lo trae verificado (`email_verified`), se rechaza;
`INVITED` pasa a `ACTIVE` al primer login. El correo se normaliza a minúsculas
en todo el flujo. Sesión JWT de 7 días, pero **el callback `jwt` reverifica el
usuario en BD en cada petición**: deshabilitar/eliminar corta la sesión al
instante y los cambios de rol aplican en vivo.
**Registro de sesiones** (`user_session`): cada login crea una fila (uuid en el
JWT como `sessionUuid`, user-agent, `last_seen` con freno de 5 min) y el
callback la comprueba por petición — borrarla desde la pestaña Usuarios del
Panel de control cierra esa sesión remotamente; el logout retira la suya
(evento `signOut`). Un JWT sin `sessionUuid` (anterior a esta feature) se
invalida. La tabla **no tiene FK física** a `user`: la colación de `user`
difiere entre la BD local (0900_ai_ci, herencia del Portfolio antiguo) y producción
(unicode_ci); la integridad la mantiene la aplicación (`removeUser` borra las
sesiones del usuario, purga de caducadas al listar). Guardas: `requireSession()` /
`requireAdmin()` para server actions — lanzan `AppError` (`src/lib/errors.ts`),
la clase cuyos mensajes sí pueden mostrarse al cliente. Las páginas del
dashboard deben protegerse a sí mismas con `auth()` + `redirect` (layout y
página renderizan en paralelo: el redirect del layout no protege a la página).

### Mutaciones: server actions por módulo

Cada módulo tiene sus actions en `src/app/app/<módulo>/actions.ts` (`'use server'`),
que validan sesión/rol, devuelven `{ ok, message? }` (mismo contrato que el
backend original) y llaman a `revalidatePath`. En los `catch`, al cliente solo
llegan mensajes de `AppError`; cualquier otra excepción (Prisma...) se registra
con `console.error` y devuelve un "Error inesperado" genérico. Los datos se leen
en la página (server component) y se pasan como props planas (convertir
`Decimal` a `number` y `Date` a ISO string) a componentes cliente.

### Módulo de finanzas (`src/lib/finance.ts` + `/app/finance`)

**Personal del administrador**: página y actions exigen rol ADMIN, y el módulo
se oculta (inicio y top-nav) a los usuarios invitados.
Semántica del ahorro anual: **mensual + ingresos extra + sobrante de viajes**
(ahorrado − gastado: lo no gastado se suma al cierre y los viajes del año
siguiente empiezan de cero; gastar de más resta). **Sin capital
inicial/final** ni fecha en los gastos de viaje (retirados el 26/08/2026,
columnas eliminadas: el módulo controla solo el ahorro). Organización en
pestañas por URL: sin `?year` se abre **Resumen** (`resumen-general.tsx`,
KPIs históricos + tabla + capital acumulado, solo lectura) y `?year=2026`
abre ese año (`savings-module.tsx`); TODA la gestión de años (crear,
renombrar, objetivo, eliminar) vive en el modal «Gestionar años» de la barra
`finanzas-tabs.tsx` — en ningún otro sitio — y las utilidades comunes en
`savings/comun.tsx` (incluidas las fórmulas puras del asistente del año en
curso: `proyeccionDe` y `esperadoHoy` — proyección a fin de año, necesario
mensual y objetivo prorrateado a hoy). KPIs, "restante" y proyecciones se
calculan en el cliente sobre el borrador editable. Gráficas: SVG a mano en
`charts` (sin librerías). El cron diario recuerda por correo los meses
cerrados sin rellenar (`avisarMesSinRellenar`, reaviso semanal vía
`saving_year.last_reminded`). Cada año se exporta a Excel desde «Gestionar
años» (`GET /app/finance/exportar?year=`, exceljs, guarda de admin propia:
los route handlers no los protege el layout).

### Pipeline de oportunidades (`src/lib/pipeline.ts` + `/app/pipeline`)

**Personal del administrador** (como finanzas). Kanban de 5 estados con
drag&drop + botones ←/→ en escritorio — en móvil (< md) el kanban no existe:
se trabaja desde la vista Tabla, con selector de estado por tarjeta —,
seguimientos (próxima acción con fecha: chip de
urgencia en la tarjeta y aviso por correo desde el cron diario, reaviso
semanal), historial por tarjeta (`opportunity_event`: los cambios de estado
los apunta el sistema y no se borran; el timeline admite notas/llamadas/
emails/reuniones), métricas de cabecera y tres vistas: tablero, **Tabla**
(todas las oportunidades por última actividad) e **Histórico** (archivadas)
— las dos últimas comparten `tabla-oportunidades.tsx`. Cerrar o descartar
sella `closed_at` y retira el seguimiento; reabrir lo limpia y desarchiva.
Componentes en `src/components/dashboard/pipeline/` (constantes compartidas
en `comun.ts`).

### Analítica (`src/components/landing/analytics.tsx`)

Google Analytics 4 con consentimiento previo RGPD: sin `NEXT_PUBLIC_GA_ID` no
se renderiza nada; con él, el banner pide consentimiento y **ningún script de
Google se carga hasta aceptar**. La elección vive en localStorage (`pf_cookies`)
y se retira desde `/privacidad` (botón `CookieReset`). La variable se hornea en
el build (cambiarla exige rebuild; en Docker es build-arg).

## Producción (Docker)

`Dockerfile` multi-stage (Next standalone, activado por `BUILD_STANDALONE=1` —
por eso `pnpm start` local sigue funcionando) + `docker-compose.yml` con MySQL
propio (BD desde cero, volumen `db-data`) y un servicio `migrate`
one-shot (`--profile setup`) que aplica la migración baseline y el seed.
`NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_GA_ID` se hornean como build-args. Guía
completa: `docs/DESPLIEGUE.md` (procedimiento validado en local el 25/08/2026).

## Idioma y textos de la UI

Todo el texto de la UI, comentarios de código, mensajes y documentación de este
proyecto están en **español**. El sitio es monolingüe (el multiidioma ES/EN se
retiró antes del lanzamiento).
**Sin ejemplos enumerados en labels ni placeholders** — nada de "Concepto
(vuelos, hotel...)" o "Título (rol, encargo...)": etiquetas escuetas
("Concepto", "Título"). Los placeholders solo si son funcionales ("Buscar...",
"Importe", "Sin objetivo"), nunca de ejemplo (preferencia de Adrián, 26/08/2026).
