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
del ahorro, fechas de la experiencia, **aritmética de meses** (meses cortos,
febrero bisiesto, cruce de año) con los **topes** y los **recurrentes** —cargos
atrasados, ancla del día, apuntar a mano—, el **color automático** de las
categorías, parsers de GA (API mockeada), umbrales
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
- **Dashboard** (`/app/*`): componentes en `src/components/dashboard/`. El
  inicio es un **centro de mando**: franja de avisos accionables (seguimientos
  vencidos, mantenimiento, meses de ahorro sin rellenar), KPIs con dato real y
  actividad reciente; sus datos salen de `src/lib/inicio.ts` en una pasada
  paralela de consultas acotadas (nunca traer módulos enteros para pintar
  cifras) y el pulso de visitas va en Suspense.
  **Las gráficas van sobre Chart.js** (27/08/2026; antes eran SVG a mano). Los
  componentes genéricos están en `src/components/ui/charts/` —
  `GraficaBarras`, `GraficaLinea`, `GraficaDonut` y `comun.ts` (registro
  SELECTIVO de Chart.js: `chart.js/auto` mete todos los controllers) — y sobre
  ellos, los envoltorios del proyecto, nombrados por lo que muestran:
  `AhorroPorMes`, `AhorroAcumulado` (`savings/charts.tsx`),
  `MovimientosPorMes` (`savings/gastos.tsx`) y `VisitasPorDia`
  (`panel/visitas.tsx`).
  ⚠ **Tres trampas del canvas**, todas ya pagadas: (1) no entiende
  `var(--token)` y lo pinta NEGRO, así que todo color pasa por
  `resolverColor`; (2) el registro selectivo obliga a acordarse de los
  elementos (`ArcElement` para el donut, o la página entera revienta); (3) el
  texto se dibuja, no es DOM, así que lo que deba ser legible o accesible va en
  HTML al lado — la leyenda del donut y su total central son propios.
  La serie de visitas usa `src/lib/serie-diaria.ts` (port de `dailyTrend`):
  rellena los huecos, marca los meses en un eje superior y **agrupa por semana
  ISO por encima de 45 días** (90 barras no se leen; 14 sí). Devuelve GRUPOS de
  índices, no valores: quien la usa suma lo que necesite.
  El **tooltip es compartido** (`ui/charts/tooltip.ts`): un div global fijo que
  usan tanto Chart.js como el mapa de calor de visitas, que **sigue siendo CSS
  Grid a propósito** (Chart.js no tiene tipo matriz, y 168 divs con
  `aria-label` son más accesibles que un canvas).
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
columnas eliminadas: el módulo controla solo el ahorro). Organización en CUATRO
secciones por URL (`?s=`): **Panel** (por defecto, `panel-finanzas.tsx`: lo
importante del ahorro y del mes de movimientos en una pantalla), **Ahorro**
(`?s=ahorro`: sin `year` el Resumen histórico de `resumen-general.tsx`, con
`&year=2026` ese año en `savings-module.tsx`), **Gastos** y **Ajustes**
(`?s=ajustes`: categorías, recurrentes y años — ver más abajo).
La nav de secciones y las pestañas de años son `FinanzasNav` y `AhorroTabs`, y
las dos **solo navegan**: TODA la gestión de años (crear, renombrar, objetivo,
exportar a Excel, eliminar) vive en la **sección Ajustes** — en ningún otro
sitio. Estuvo en un modal «Gestionar años» de `finanzas-tabs.tsx` hasta el
28/08/2026. Las utilidades comunes están en
`savings/comun.tsx` (incluidas las fórmulas puras del asistente del año en
curso: `proyeccionDe` y `esperadoHoy` — proyección a fin de año, necesario
mensual y objetivo prorrateado a hoy). KPIs, "restante" y proyecciones se
calculan en el cliente sobre el borrador editable. Gráficas: Chart.js con los
componentes de `ui/charts` (ver Arquitectura). El cron diario recuerda por correo los meses
cerrados sin rellenar (`avisarMesSinRellenar`, reaviso semanal vía
`saving_year.last_reminded`). Cada año se exporta a Excel desde «Gestionar
años» (`GET /app/finance/exportar?year=`, exceljs, guarda de admin propia:
los route handlers no los protege el layout).

### Control de gastos e ingresos (`src/lib/gastos.ts` + `/app/finance?s=gastos`)

Dentro de Finanzas, pestaña **Gastos**: réplica del Excel "Control de gastos"
de Adrián — cada movimiento es un **ingreso o un gasto** (`MovementType`) con
**fecha propia** (no cuelga de `saving_year`), así que el mes se deriva de la
fecha. Dos sub-vistas: **mes** (`?mes=2026-08`: ingresos/gastos/balance/gasto
medio al día, lista con alta rápida y los dos desgloses "en qué se va" / "de
dónde viene") y **año** (`&vista=anio`: mes a mes con balance, barras y
desgloses anuales). Las **categorías son libres y propias de cada tipo**
(tabla `expense_category`, 19 sembradas en la migración) y se gestionan en la
sección Ajustes; su nombre es único DENTRO del tipo y borrarlas
NO borra sus movimientos (FK `SetNull`: quedan "sin categoría"). Los donuts
reutilizan `GraficaDonut` con `centro`/`vacio`/`titulo`; la tarjeta "Gastos del mes"
del inicio sale de `gastadoEnMesDe`.

La vista del mes lleva además dos tarjetas que miran hacia DELANTE (los donuts
solo cuentan lo que ya pasó):

- **Topes por categoría** (`src/lib/topes.ts`): límite mensual opcional por
  categoría de gasto (`expense_category.budget`, null = sin tope), barras
  coloreadas por estado y **aviso por correo al 80 % y al pasarse**. Ese aviso
  **no se repite semanalmente** como los demás: sale una vez por mes y por
  nivel, recordado en `budget_notified` como `'YYYY-MM:nivel'` — un gasto ya
  hecho no se puede "marcar como hecho", así que insistir solo enseñaría a
  ignorarlo. Cambiar el tope limpia esa marca.
- **Recurrentes** (`src/lib/recurrentes.ts` + tabla `recurring_expense`):
  alquiler, suscripciones, seguros, la nómina... El cron diario los apunta
  solos en `expense` y adelanta `next_date`; lo generado es un movimiento
  normal, editable y borrable. Dos detalles que ya costaron pensarse:
  `day_anchor` guarda el día original (1-31) para que un recibo del 31 no se
  quede clavado en el 28 tras pasar por febrero, y `cargosPendientes` recupera
  TODOS los cargos atrasados (servidor parado) con un freno de `MAX_CARGOS`
  para que una fecha de alta disparatada no inunde el histórico. La cifra de
  cabecera es el **equivalente mensual** (un seguro de 600 €/año son 50 €/mes):
  sumar solo los mensuales dejaría fuera justo los recibos gordos.

`topes.ts` y `recurrentes.ts` NO llevan `server-only` a propósito: sus umbrales
y cálculos los usan el cron (servidor) y las tarjetas (cliente), y duplicarlos
es justo cómo se desincronizan — mismo criterio que `fechas.ts`.

**La GESTIÓN vive en la sección Ajustes** (`?s=ajustes`, `savings/ajustes.tsx`),
no en modales: **tres bloques — Categorías, Recurrentes y Años de ahorro**; los
dos primeros con buscador —sin tildes ni mayúsculas: "cafe" encuentra "Café"— y
filtros (los años son cuatro, no necesitan buscador). Es el único sitio de
configuración del módulo: las demás vistas solo consultan y dan de alta
movimientos. Lo que aporta la sección sobre los modales que sustituyó:

- **Fusionar** dos categorías del mismo tipo (`fusionarCategorias`): sus
  movimientos y recurrentes pasan a la de destino en una transacción y la de
  origen desaparece. Es la salida a los nombres parecidos que se acumulan.
- **Una categoría en uso NO se borra** (`deleteCategoria` lo rechaza contando
  movimientos y recurrentes; en la lista el botón sale apagado con el motivo).
  El FK es `SetNull`, así que técnicamente podría borrarse dejando el historial
  "sin categoría" — perder la clasificación de años de gasto en un clic no es
  una opción, y para eso está fusionar. Los `usos` de `CategoriaRow` cuentan
  las dos cosas (`usosRecurrentes`).
- **El color lo elige la aplicación** (`src/lib/colores.ts`, `colorLibre`):
  el tono más alejado de los que ya se usan, con saturación y luminosidad
  fijas. Elegirlo a mano no aportaba nada y con una paleta de ocho había
  repetidos desde la novena categoría. La lista va **siempre alfabética**
  dentro de su tipo (hubo un orden manual el 28/08/2026, retirado el mismo día
  con su columna: no aportaba).
- **Altas y ediciones, en el modal común** y con el MISMO formulario (el tipo
  solo se ofrece al crear: cambiarlo después no tiene sentido). En la fila
  quedan las acciones de un clic —pausar, fusionar, borrar— y la fusión, que
  se despliega en línea porque necesita ver la lista de al lado.
- **Cada recurrente despliega su detalle** (chevron): **apuntar el cargo ya**
  sin esperar al cron, **duplicarlo** y **ver lo que ha apuntado**. El origen
  de cada movimiento se guarda en `expense.recurring_uuid` (`SetNull`: borrar
  el recurrente no borra su gasto real, solo pierde el origen). "Apuntar ahora"
  y el cron comparten la MISMA rutina (`apuntarCargos`) y apuntan el cargo con
  **su propia fecha**, no con la de hoy: así no se duplica cuando llegue el
  día. Duplicar no escribe nada: abre el alta con los valores copiados.
- **Sin atajos desde la vista de Gastos**: sus tarjetas de topes y recurrentes
  solo informan; para gestionar se va a Ajustes por la nav.

### Mantenimiento (`src/lib/mantenimiento.ts` + `/app/panel?tab=mantenimiento`)

Tareas recurrentes con periodicidad en meses; "Hecha" encadena el siguiente
vencimiento y el cron diario avisa por correo de las vencidas (reaviso semanal
vía `last_notified`). Van separadas por **ÁMBITO**: la ITV, el seguro de casa o
la revisión de la caldera son el mismo problema que revisar dependencias —algo
que caduca cada N meses—, así que comparten módulo en vez de tener uno nuevo.

Los ámbitos son una **tabla editable** (`maintenance_scope` + FK `scope_uuid`,
migración `ambitos_editables`), no una lista fija: nacieron como enum de tres el
28/08/2026 y pasaron a tabla el mismo día, porque la lista la decide quien usa
la app. Se gestionan en el modal «Ámbitos» de la pestaña (crear, renombrar,
borrar) — renombrar es seguro (las tareas apuntan por uuid) y **un ámbito en uso
no se borra**, igual que las categorías de gastos. El filtro por ámbito **solo
aparece cuando hay más de uno en uso**; el nombre de cada tarea sale del `include`
de la relación, y el correo de vencidas abre cada tarjeta con él.

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
**Nombres de meses y días: una sola fuente**, `src/lib/fechas.ts` (`MESES`,
`DIAS`). Van SIN abreviar y con inicial mayúscula; las abreviaturas se DERIVAN
(`mesCorto` = las tres primeras letras, `mesInicial` para ejes muy estrechos),
nunca se duplica la lista. Había diez copias repartidas con cinco nombres
distintos antes de unificarlas (27/08/2026). En ese mismo fichero vive
`sumarMeses` (suma meses recortando a fin de mes, con `ancla` opcional para que
un recibo del 31 no se quede clavado en el 28): la comparten el vencimiento de
las tareas de mantenimiento y la fecha de los cargos recurrentes, que tuvieron
una copia cada uno hasta el 28/08/2026.
**Porcentajes con espacio, como prescribe la RAE** ("67 %", no "67%") y con
espacio **irrompible** (` ` / `&nbsp;`), para que la cifra y el símbolo no
se separen en un salto de línea. En finanzas lo pone `pct()` de `savings/comun`
(vía `Intl`, que en es-ES ya usa ese espacio) — usarlo siempre que se pueda en
lugar de componer el texto a mano.
**Sin ejemplos enumerados en labels ni placeholders** — nada de "Concepto
(vuelos, hotel...)" o "Título (rol, encargo...)": etiquetas escuetas
("Concepto", "Título"). Los placeholders solo si son funcionales ("Buscar...",
"Importe", "Sin objetivo"), nunca de ejemplo (preferencia de Adrián, 26/08/2026).
