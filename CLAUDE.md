# CLAUDE.md

Orientación para Claude (y para el desarrollo) al trabajar en este repositorio.
Las tareas pendientes del proyecto viven en `docs/TAREAS.md` (la documentación
adicional del proyecto va siempre en `docs/`; en la raíz solo README y CLAUDE).

## Comandos

Gestor de paquetes: `pnpm`.

```bash
pnpm dev                 # desarrollo (puerto 9444, Turbopack; prod: 9443)
pnpm build               # build de producción (incluye type-check)
pnpm lint                # ESLint
pnpm exec tsc --noEmit   # solo type-check
pnpm prisma generate     # regenerar el cliente (tras tocar schema.prisma)
pnpm prisma db seed      # asegura ADMIN_EMAIL como admin activo
pnpm deps                # lista dependencias desactualizadas (pnpm outdated)
```

No hay tests automatizados. Antes de dar algo por terminado: `pnpm lint` y `pnpm build`.

⚠ **Gotcha del optimizador de imágenes**: al sustituir una imagen de `public/`
por otra con el mismo nombre, Turbopack sigue sirviendo la vieja — su caché
(`.next/dev/cache/images`, ojo: bajo `dev/`) no se invalida ni reiniciando el
servidor. Solución: parar el dev server, borrar esa carpeta y arrancar.

## ⚠️ Base de datos: compartida y con baseline

**Solo en desarrollo local**: la BD (`ao_test` en el MySQL local) **se comparte
con el Portfolio original** (`../Portfolio`, Express + SQL raw): mismas tablas,
ambas apps conviven durante la transición. El usuario MySQL `aosuna` solo tiene
permisos sobre `ao_test` (no puede crear otras bases de datos).
En **producción** la BD es propia y empieza vacía: contenedor MySQL del
`docker-compose.yml`, creada con `migrate deploy` + seed (ver `docs/TAREAS.md`).

- **NUNCA ejecutar `prisma migrate dev` ni `prisma migrate reset` a la ligera**:
  detectarían drift y propondrían resetear una BD con datos reales.
- El esquema se adoptó con baseline: `prisma/migrations/0_init` está marcado como
  aplicado (`prisma migrate resolve --applied 0_init`), sin ejecutarse.
- La tabla `migrations` es de db-migrate (proyecto viejo) y está declarada
  **externa** en `prisma.config.ts` (`tables.external` + `experimental.externalTables`):
  Prisma no debe gestionarla.
- Para cambios de esquema futuros: valorar `prisma db push` contra una BD de
  prueba o baseline manual; coordinar con el proyecto viejo si sigue vivo.
- El schema refleja la BD exacta (via `prisma db pull`): `TIMESTAMP(0)`, nombres
  de índice, `onUpdate: NoAction`. Mantener esa fidelidad al editarlo.

## Arquitectura

Proyecto Next.js App Router con `src/`. Dos zonas con paletas distintas:

- **Páginas públicas** (landing `/`, login `/login`, `/privacidad`): paleta
  esmeralda/teal del `_palette.scss` original, scoped bajo la clase `.pf-public`
  en `globals.css`. La landing gira alrededor de los **proyectos como casos de
  estudio** (reto → qué construí → resultado); sus componentes viven en
  `src/components/landing/` y su contenido (perfil, experiencia, textos, casos)
  en `src/lib/landing/content.ts` — la única fuente de verdad del contenido.
- **Dashboard** (`/app/*`): paleta azul (#1570ef) en los tokens de `:root`, más
  tokens semánticos (`--success`, `--warning`, `--danger`, `--viajes` con sus
  `-bg`). Componentes en `src/components/dashboard/`.
- **Tema único oscuro**: el selector claro/oscuro se retiró; los tokens de
  `:root` y `.pf-public` ya son los oscuros (sin clase `dark` ni `next-themes`).

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
instante y los cambios de rol aplican en vivo. Guardas: `requireSession()` /
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
Semántica del Excel "Ahorro Anual": ahorro general anual = ahorro general
mensual + ingresos extra; capital final = capital inicial + ahorro general (el
ahorro de viajes se gasta, no engrosa capital); al crear un año sin capital
inicial se encadena el capital final del año anterior. El año activo va en la
URL (`?year=`). KPIs y "restante" se calculan en el cliente sobre el borrador
editable. Gráficas: SVG a mano en `savings-module`/`charts` (sin librerías).

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

## Idioma

Todo el texto de la UI, comentarios de código, mensajes y documentación de este
proyecto están en **español**. El sitio es monolingüe (el multiidioma ES/EN se
retiró antes del lanzamiento).
