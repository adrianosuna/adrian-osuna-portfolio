# CLAUDE.md

Orientación para Claude (y para el desarrollo) al trabajar en este repositorio.
Las tareas pendientes viven en `docs/TAREAS.md` y **lo terminado se documenta
en `docs/CHANGELOG.md`** (bien explicado, con fecha) retirándolo de TAREAS —
mantener esa pareja al cerrar cualquier trabajo. Las **ideas sin comprometer**
viven en `docs/SUGERENCIAS.md` (pozo de ideas con casillas); cuando una se
decide, pasa a TAREAS bien redactada y al terminar al CHANGELOG. La
documentación adicional va siempre en `docs/`; en la raíz solo README y CLAUDE.
Hoy hay además `docs/DESPLIEGUE.md` (procedimiento en el VPS) y
`docs/API.md` (la API v1 y la receta del Atajo de iOS).

## Comandos

Gestor de paquetes: `pnpm`.

```bash
pnpm dev                 # desarrollo (puerto 9444, Turbopack; prod: 9443)
pnpm build               # build de producción (incluye type-check)
pnpm build:aislado       # igual, en .next-aparte: NO mata al dev server
pnpm test                # tests unitarios (Vitest, carpeta tests/)
pnpm lint                # ESLint
pnpm exec tsc --noEmit   # solo type-check
pnpm prisma generate     # regenerar el cliente (tras tocar schema.prisma)
pnpm prisma db seed      # asegura ADMIN_EMAIL como admin activo
pnpm deps                # lista dependencias desactualizadas (pnpm outdated)
pnpm test:e2e            # tests e2e (Playwright, carpeta e2e/) — hace el build
pnpm analyze             # build + treemap del bundle (ANALYZE=1)
```

Los e2e necesitan Chromium una vez: `pnpm exec playwright install chromium`.

⚠ **El dev server y el build comparten `.next`**: un `pnpm build` con `pnpm
dev` levantado MATA el dev server, y lo que se ve luego es que "no carga
nada" en el 9444 — el navegador, el móvil en la red local o una extensión de
vista responsive—. Por eso `distDir` sale de `NEXT_DIST_DIR` y hay dos
atajos que construyen en `.next-aparte`: **`pnpm build:aislado`** y
`pnpm analyze`; los **e2e ya lo hacen solos** (`webServer.env` de
`playwright.config.ts`). `pnpm build` se queda en `.next` a propósito: es lo
que ejecutan el CI y el Dockerfile.

⚠ Las dos variables van por **`env`** y no como `VAR=valor comando`: en
Windows los scripts de pnpm corren en cmd, donde esa sintaxis no existe (por
eso `analyze` y `build:aislado` son scripts de Node y no una línea del
`package.json`). Y **una sola** carpeta alternativa, no una por tarea: `next
build` añade dos entradas a `include` de `tsconfig.json` por cada nombre
nuevo que vea.

Los tests (Vitest, `tests/`) cubren la lógica crítica sin BD ni red: fórmulas
del ahorro, fechas de la experiencia, **aritmética de meses** (meses cortos,
febrero bisiesto, cruce de año) con los **topes** y los **recurrentes** —cargos
atrasados, ancla del día, apuntar a mano—, el **color automático** de las
categorías, parsers de GA (API mockeada), umbrales
del monitor de infraestructura (TLS/fs/reloj simulados), la **presentación
de las categorías con grupos** (`categorias.test.ts`: qué se ofrece al
apuntar —sueltas y agrupadas sí, grupos nunca— y la etiqueta «Coche › Taller»),
validaciones/guardas
de todas las server actions, la lógica del pipeline (métricas del embudo y
aviso de seguimientos), los callbacks de `auth.ts` (la config se exporta
como `authConfig` precisamente para poder invocarlos con mocks), las
los **esquemas de validación** (Zod: las dos trampas del `coerce` con `null` y
del `.transform()` obligatorio), el **tope de peticiones** (ventana
deslizante, claves independientes y el `X-Forwarded-For`), los **recordatorios
puntuales** del calendario,
las superficies GEO (robots + llms.txt), el **saneado del HTML** de las notas
(allowlist y vectores de inyección: `<script>`, `on*`, `javascript:`) y los
campos custom de `fields.tsx` y el `Modal` común —con su trampa de foco— (jsdom
+ Testing Library; el resto corre en node), la **API v1** (tokens Bearer:
rechazos por cuenta deshabilitada/no admin, BD caída, coma decimal, tope del
cuerpo y categoría por nombre), el **registro por niveles** (`lib/log.ts`: el
suelo, el JSON de producción y la serialización de un `Error`), los **dos
plazos de caducidad** de la sesión y una **auditoría axe** de las piezas
compartidas (modal, campos, sub-pestañas y el **calendario**, que es la rejilla
más densa: 35 botones con nombre propio). `server-only` se alias-ea a un stub
y `next-auth` se procesa inline en `vitest.config.mts`.
**`tests/setup.ts`** rellena lo que jsdom no implementa y el dashboard sí usa
(`matchMedia` para `prefers-reduced-motion`, `scrollIntoView`); va con guarda
de `window` porque corre también en las suites de entorno `node`. Se hace ahí y
no con guardas en el componente: un `el.scrollIntoView?.()` no protege de nada
real y esconde el fallo si algún día se llama sobre lo que no es un elemento.
Antes de dar algo por terminado: `pnpm test`, `pnpm lint` y `pnpm build`.

Los **e2e (Playwright, `e2e/`)** son otra cosa y no sustituyen a los
unitarios: corren contra un build de **producción** y comprueban las
invariantes que se ven DESDE FUERA —que ninguna ruta de `/app/*` suelte
contenido sin sesión, que la API rechace sin token, que las cabeceras y la
salud respondan—, que es justo lo que los unitarios no pueden afirmar porque
allí `auth()` está mockeado. Los flujos autenticados **no se cubren a
propósito**: automatizar el OAuth de Google es una fuente de falsos rojos.
⚠ Ojo con dos cosas que ya descubrieron los e2e y están asentadas en sus
aserciones: `/app/panel` y `/app/pipeline` resuelven el redirect con un **200
+ `NEXT_REDIRECT` en el payload**, no con un 307 (viaja el `<title>`, ningún
dato), y los endpoints que tocan la BD **aceptan 503** porque en el CI no hay
base de datos.

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

⚠ **Tras una migración, REINICIAR el dev server.** El `pnpm dev` que estuviera
levantado sigue con el cliente de Prisma anterior, y una columna nueva llega
entonces como **`undefined` en vez de `null`** — no revienta nada, así que el
síntoma es una comprobación que falla sin motivo aparente (`c.parentUuid ===
null` descartando TODAS las filas) y se diagnostica como un bug del código
recién escrito. Pasó el 04/09/2026 con las subcategorías: `prisma generate`
regenera el cliente en disco, pero no el proceso que ya lo tenía cargado.

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
  `aria-label` son más accesibles que un canvas). Es el ÚNICO sitio que
  construye HTML a mano y lo inyecta con `innerHTML`, así que **escapa el texto
  que recibe** (nombre, valor, título): aquí no vale la premisa de "React escapa
  todo" con la que se descartó la CSP con nonces, y escaparlo la mantiene cierta.
  El color no se escapa (viene del código, va en un atributo `style`).
  Los modales usan siempre `src/components/ui/modal.tsx` (cabecera y pie
  fijos, cuerpo con scroll, y **atrapa el foco**: entra al primer campo, Tab da
  la vuelta dentro y al cerrar vuelve a quien lo abrió — salvo con un popover de
  `fields.tsx` abierto, cuyo foco vive en un portal fuera del panel); los
  popovers de `fields.tsx` (select, calendario) se renderizan en un portal con
  posición fija — nunca los recorta un contenedor con overflow. La etiqueta
  sobre cada campo es `Field` de `fields.tsx` (un `<label>` de verdad; antes
  había cuatro copias).
  ⚠ **Los modales se APILAN** —una confirmación se pinta sobre el modal que la
  pidió, como al borrar un ámbito— y por eso `modal.tsx` lleva una **pila de
  módulo**. Dos cosas dependían de ella y estaban mal hasta el 05/09/2026:
  **Escape** llegaba a los dos listeners de `document` y cerraba también el de
  debajo (cancelas una confirmación y se te va la pantalla de detrás), y el
  **`overflow: hidden`** del body lo restauraba cada modal desde su propia
  copia — la del segundo ES "hidden", así que si se desmontaba después del
  primero la página se quedaba **sin scroll para siempre**. Ahora solo el modal
  de arriba atiende las teclas, y el overflow original lo guarda el primero de
  la pila y lo devuelve el último al salir. Lo segundo lo encontró un test, no
  el navegador: depende del orden de desmontaje.
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
en todo el flujo. **El callback `jwt` reverifica el usuario en BD en cada
petición**: deshabilitar/eliminar corta la sesión al instante y los cambios de
rol aplican en vivo.

**Caducidad: DOS plazos** (`src/lib/sesion-caducidad.ts`, fuente única para
`auth.ts` y para el Panel). El **tope absoluto** desde el login
(`SESION_DIAS`, 7) y el **cierre por inactividad** desde la última petición
(`SESION_INACTIVIDAD_HORAS`, 48; 0 lo desactiva). El segundo existe porque el
primero deja fuera el caso que importa —una sesión olvidada en un navegador
ajeno—: los 7 días corren igual la uses o no. Al pasarse de inactividad se
**borra la fila**, no solo se rechaza el token; si no, seguiría figurando como
activa en el Panel para siempre. El plazo va en HORAS y no en minutos porque
`last_seen` se refresca con freno de 5 min: un umbral por debajo de ese freno
cerraría sesiones en uso.
**Registro de sesiones** (`user_session`): cada login crea una fila (uuid en el
JWT como `sessionUuid`, user-agent, `last_seen` con freno de 5 min) y el
callback la comprueba por petición — borrarla desde la pestaña Usuarios del
Panel de control cierra esa sesión remotamente; el logout retira la suya
(evento `signOut`). **«Cerrar todas»** (`closeAllSessions`) es el botón de
pánico y **excluye la propia**: cerrarla también dejaría al admin fuera de la
pantalla desde la que acaba de pulsar, sin ver el resultado. Un JWT sin `sessionUuid` (anterior a esta feature) se
invalida. La tabla **no tiene FK física** a `user`: la colación de `user`
difiere entre la BD local (0900_ai_ci, herencia del Portfolio antiguo) y producción
(unicode_ci); la integridad la mantiene la aplicación (`removeUser` borra las
sesiones del usuario, purga de caducadas al listar). Guardas: `requireSession()` /
`requireAdmin()` para server actions — lanzan `AppError` (`src/lib/errors.ts`),
la clase cuyos mensajes sí pueden mostrarse al cliente. Las páginas del
dashboard deben protegerse a sí mismas con `auth()` + `redirect` (layout y
página renderizan en paralelo: el redirect del layout no protege a la página).

### Atajo de login en desarrollo (`src/lib/dev-login.ts`)

Con **`DEV_LOGIN_EMAIL`** puesta, `/login` enseña un botón «Entrar como
\<correo\>» que entra **sin Google**: un clic, sin teclear el correo ni abrir la
cuenta. Pensado para las pruebas del día a día.

Lo que NO se salta: el correo pasa por la **misma allowlist** y el mismo
callback `signIn` que Google (INVITED → ACTIVE, DISABLED rechazado), registra
su fila en `user_session` y en `login_event`, y caduca igual. Solo se ahorra el
OAuth — así lo que se prueba con el atajo es lo mismo que verá el usuario real.

⚠ **Dos candados para que no pueda existir en producción**, y hacen falta los
dos:

1. `NODE_ENV !== 'production'`. El build de producción lo fija, así que aunque
   la variable se colara en el `.env` del VPS, `correoDevLogin()` devuelve null
   y **el proveedor ni se registra** en la ruta de auth.
2. La variable puesta. Opt-in explícito, no "si hay `ADMIN_EMAIL`": un atajo
   que salta la autenticación se activa a sabiendas.

Y una tercera comprobación en el callback: por el proveedor `dev` solo se
admite **su** correo, aunque otro esté en la allowlist. Cubierto por
`tests/dev-login.test.ts`, que reimporta `@/auth` con distintos entornos —los
providers se construyen al importar el módulo— y comprueba que en producción
la lista de proveedores es solo `['google']`.

### Mutaciones: server actions por módulo

Cada módulo tiene sus actions en `src/app/app/<módulo>/actions.ts` (`'use server'`),
que validan sesión/rol, devuelven `{ ok, message? }` (mismo contrato que el
backend original) y llaman a `revalidatePath`. Las **entradas se validan con
los esquemas de `lib/esquemas.ts`** (Zod), no a mano; el `guarded` de cada
módulo aplica además el **tope de peticiones por usuario**. En los `catch`, al cliente solo
llegan mensajes de `AppError`; cualquier otra excepción (Prisma...) se registra
con `console.error` y devuelve un "Error inesperado" genérico. Los datos se leen
en la página (server component) y se pasan como props planas (convertir
`Decimal` a `number` y `Date` a ISO string) a componentes cliente.

### Módulo de finanzas (`src/lib/finance.ts` + `/app/finance`)

**Personal del administrador**: página y actions exigen rol ADMIN, y el módulo
se oculta (inicio y top-nav) a los usuarios invitados. (El "modo privado" que
difuminaba los importes se retiró el 31/08/2026 —de raíz, incluida la columna
`user.prefs`—: no compensaba su complejidad.)
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
sección Ajustes; borrarlas NO borra sus movimientos (FK `SetNull`: quedan
"sin categoría"). La tarjeta "Gastos del mes" del inicio sale de
`gastadoEnMesDe`.

#### Categorías en DOS niveles: grupos y categorías

Un **grupo** ("Coche") con las categorías que se le asignan ("Taller",
"Gasolina") y **categorías sueltas** que no están en ninguno. Las dos cosas
viven en `expense_category` y las distingue **`is_group`**, con
`parent_uuid` (FK a sí misma, `Restrict`) para la pertenencia. Migración
`grupos_de_categorias` (04/09/2026; unificó las dos que hubo ese día antes de
llegar a producción).

**El grupo es un CONTENEDOR: se crea, no emerge.** Esto es lo que decide todo
lo demás, y la primera versión del día lo tenía al revés (grupo = categoría
con hijas). Dos cosas que aquello dejaba mal:

- **Un grupo vacío no existía**, y el flujo natural es crear "Coche" primero y
  asignarle categorías después. Sin la marca, un grupo recién creado es
  indistinguible de una categoría suelta: se ofrecería al apuntar un
  movimiento. Por eso `esGrupo` lee `is_group` y **nunca** "tiene hijas".
- **Agrupar una categoría con historial era un trámite.** Había que
  "convertirla en grupo" moviendo sus movimientos a una subcategoría nueva
  (una acción `convertirEnGrupo` que se retiró). Con el grupo como contenedor,
  asignar mueve la CATEGORÍA y sus movimientos se quedan donde estaban — así
  que asignar no tiene reglas especiales, y eso es justo lo que se buscaba.

De ahí, las reglas que quedan:

- **Los movimientos cuelgan SIEMPRE de una categoría.** Un grupo no se ofrece
  al apuntar (ni en el alta, ni en la edición, ni en un recurrente, ni en la
  división, ni por la API). Así cada gasto cuenta una vez y ninguna suma tiene
  que decidir si incluye "lo del padre" — que es por donde se descuadra un
  desglose.
- **Dos niveles**: una categoría solo entra en un grupo (no en otra
  categoría), un grupo no entra en ningún sitio, y las dos tienen que ser del
  mismo tipo.
- **El nombre es único entre HERMANAS**, no en todo el tipo: "Varios" tiene
  que caber en Coche y en Casa. Índice `uq_expense_category_name_type_parent`.
  En el primer nivel compiten los grupos con las categorías sueltas, que es lo
  que se quiere.
  ⚠ MySQL trata los NULL como distintos, así que ese índice **no protege el
  primer nivel**: dos "Coche" ahí pasarían por la BD y quien lo impide es la
  aplicación (mismo criterio que la integridad de `user_session`).
- **Un grupo VACÍO se borra; con categorías dentro, no** (lo rechaza la
  action; el FK también, pero con un "Error inesperado" que no explica nada).
  Y **no se fusiona** por ninguno de los dos lados: fusionar grupos es
  fusionar las categorías que tienen dentro.
- **Presentación compartida** en `src/lib/categorias.ts` — `esGrupo`,
  `etiquetaCategoria` ("Coche › Taller") y `opcionesDeCategoria`—, **sin
  `server-only`** a propósito (como `topes.ts` y `fechas.ts`): las mismas
  reglas las usan los desplegables de tres pantallas, la lista de Ajustes y el
  correo de los topes. **El desplegable de categoría es un ÁRBOL**
  (`TreeSelectField` de `fields.tsx` + `arbolDeCategoria`): los grupos como
  cabeceras no seleccionables y sus categorías sangradas debajo; las sueltas,
  al primer nivel; un grupo vacío no sale. Su buscador filtra por la hoja Y
  por el nombre del grupo —escribir "coche" saca Taller y Gasolina bajo su
  cabecera—, que era la razón por la que antes la lista era plana ("Coche ›
  Taller") y ahora se conserva. El disparador sí enseña la ruta completa, y
  **con `Tooltip` cuando se recorta**: en el hueco de la rejilla del alta,
  "aaaaa › Comer fuera / Cafés" no cabe (medido: 181 px de texto en 162), y es
  justo ahí donde se pierde de qué grupo era. Solo si la elegida está en un
  grupo: en una suelta, repetir su nombre no aporta.
  `opcionesDeCategoria` (plana) queda para lo que necesita una lista lineal.
- En las tablas se ve el nombre de la CATEGORÍA y el grupo va en el `title`:
  "Coche › Taller" no cabe en la celda.
- ⚠ **Grupo y categoría comparten formulario, modal y acciones**, así que los
  TEXTOS tienen que ramificar: "Grupo creado" y no "Categoría creada",
  "Eliminar el grupo" y no "la categoría". Se descubrió probándolo, y es lo
  primero que se rompe al añadir algo ahí.

**Los donuts enseñan grupos, con desglose al pulsar.** `desglose()` suma por
la categoría del movimiento pero atribuye la porción a su grupo y guarda el
detalle en `ParteCategoria.hijas`; el envoltorio `Desglose` de `gastos.tsx`
baja a ese detalle y vuelve. La capacidad genérica es `onParte` +
`ParteDonut.pulsable` en `GraficaDonut`, que no sabe qué es un grupo: solo
avisa de que una porción se ha activado.
⚠ El desglose se abre desde las **filas de la leyenda, que son botones de
verdad**, y no solo desde el arco: el canvas DIBUJA su texto, así que un clic
en el arco no existe para el teclado ni para un lector de pantalla (y apuntar
a un arco de 20 px con el pulgar no es una interfaz). El clic en el arco se
queda como extra para el ratón.

⚠ **Y la columna de cifras tiene que quedar a plomo.** En un donut con
desglose, TODAS las filas de la leyenda reservan la columna del chevron (hueco
vacío las que no lo llevan) y TODAS llevan el mismo padding — nunca solo la
pulsable. Los dos detalles vienen del mismo fallo, que Adrián vio al momento:
el chevron dentro de la fila y un `-mx-1` sobre un `w-full` (que no crece con
el margen negativo) dejaban el importe del grupo 30 px a la izquierda del
resto. En una leyenda de cifras, una columna desalineada es lo primero que
canta. Los donuts SIN desglose no reservan nada y quedan idénticos.

La vista del mes lleva además dos tarjetas que miran hacia DELANTE (los donuts
solo cuentan lo que ya pasó):

- **Topes por categoría** (`src/lib/topes.ts`): límite mensual opcional por
  categoría de gasto (`expense_category.budget`, null = sin tope), barras
  coloreadas por estado y **aviso por correo al 80 % y al pasarse**. Ese aviso
  **no se repite semanalmente** como los demás: sale una vez por mes y por
  nivel, recordado en `budget_notified` como `'YYYY-MM:nivel'` — un gasto ya
  hecho no se puede "marcar como hecho", así que insistir solo enseñaría a
  ignorarlo. Cambiar el tope limpia esa marca.
  Con grupos, el tope se puede poner en los DOS niveles: el de un grupo se
  compara con la **suma de sus categorías** ("el coche, 200 al mes") y cada
  categoría puede tener el suyo. Por eso `topesDelMes` necesita **todas** las
  categorías del tipo y no solo las que tienen tope — si no, el gasto de una
  categoría sin tope no se podría sumar al de su grupo.
  ⚠ Y `resumenTopes` **no suma dos veces un tope anidado**: si Coche tiene 200
  y Gasolina 120, el techo del conjunto son 200, porque la gasolina ya va
  dentro. Los CONTADORES sí cuentan todos (que la gasolina se haya pasado
  importa aunque el coche vaya bien).
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
  La **periodicidad es libre**: el formulario ofrece las comunes
  (`PERIODICIDADES`) y un "Personalizado" con número + unidad (meses/años) hasta
  120 meses; `etiquetaPeriodo` lee los múltiplos de 12 en años. El tope de
  `periodoValido` (120) es solo una cota: quien frena de verdad es `MAX_CARGOS`.

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
- **Gasto e ingreso son dos PESTAÑAS** dentro de Categorías (píldora de
  `sub-tabs.tsx` con estado local, con la cuenta de cada tipo), no dos bloques
  de una lista: son dos listas independientes y enseñarlas juntas con cabeceras
  no las separaba (se probó dos veces el 05/09/2026). La pestaña fija el tipo
  al crear, y el filtro «Con tope» solo sale en Gasto.
- **Grupos**: **dos altas separadas** («Nuevo grupo» y «Nueva»), porque crear
  un grupo y crear una categoría son dos gestos distintos y el grupo es lo que
  se crea PRIMERO cuando se va a ordenar la lista. La lista va en orden de
  ÁRBOL (lo devuelve ya `listCategorias`), el grupo lleva icono de carpeta en
  vez de punto de color y chip «Grupo · N» / «Grupo vacío», y sus categorías
  van sangradas debajo. **Elegir y cambiar de grupo se hacen en el formulario
  de la categoría** (campo «Grupo», el primero del modal: trae el grupo actual
  y ofrece «Sin grupo» para sacarla), y **sacar del grupo es además una acción
  de fila de un clic**: meter exige elegir cuál, sacar no tiene nada que
  elegir.
  ⚠ Ese campo se pinta SIEMPRE en una categoría, y **apagado con su aviso**
  cuando aún no hay ningún grupo de su tipo. Escondiéndolo —que es como estaba
  al principio— editar una categoría no enseñaba ninguna forma de agruparla y
  la función no se descubría. De ahí también el `disabled` de `SelectField`.

**Listas largas: dos técnicas distintas, y a propósito.** La **búsqueda de
movimientos** pagina en el SERVIDOR (`POR_PAGINA = 50`, `skip`/`take`, `?p=`)
y las sumas se siguen calculando sobre TODAS las coincidencias, que es el dato
que se venía a ver; antes devolvía las 200 primeras y avisaba de que había
recortado, lo que dejaba el resto inalcanzable. La **tabla del pipeline**, en
cambio, pinta por tandas en el CLIENTE («Ver más», 50): su filtro busca en
seis campos incluidas las notas, así que paginar en el servidor rompería la
búsqueda — allí lo que se recorta es lo que se PINTA, no lo que se consulta.

### Mantenimiento (`src/lib/mantenimiento.ts` + `/app/panel?tab=mantenimiento`)

Tareas con fecha de vencimiento; "Hecha" encadena el siguiente vencimiento y
el cron diario avisa por correo de las vencidas (reaviso semanal vía
`last_notified`).

`intervalMonths` es **nullable**, y `null` significa **"no se repite"**: es un
recordatorio puntual («renovar el dominio el 12/03/2027»). Al marcarlo hecho
se queda hecho —`lastDone` puesto y `nextDue` sin mover, no se borra para que
quede el rastro—. En el formulario es
**Repetición: «Se repite» / «Una vez»**, y con "Una vez" el campo de los meses
desaparece; en la lista se lee «Una vez».

⚠ **En el BORRADOR del formulario, «se repite» es un booleano aparte
(`repite`), no `intervalMonths === null`.** En la BD `null` significa "no se
repite", pero en un campo de texto `null` es también "está vacío mientras
escribo" — y con las dos cosas en la misma variable, seleccionar el contenido
de «Cada (meses)» para escribir otro número hacía CUATRO cosas de golpe: el
campo desaparecía bajo el cursor, «Repetición» saltaba sola a «Una vez», la
etiqueta de la fecha cambiaba y el botón Crear seguía activo, así que se
guardaba una puntual creyendo que era mensual. El valor de la BD se compone al
guardar (`repite ? intervalMonths : null`), y `borradorValido` —compartida por
el botón y por `guardar`— exige un número **entre 1 y 120** cuando se repite,
con el aviso en el propio campo en vez de esperar al error del servidor.

**Enter guarda**, y solo desde los dos campos de UNA línea (título y meses): en
las Notas el Enter es un salto de línea, y en los selects y la fecha la tecla
abre o elige dentro de su popover. ⚠ Las funciones que llama el Enter miran
también **`pending`**, no solo la validez: el botón se apaga mientras se
guarda, pero la tecla no, así que dos Enter seguidos crearían la tarea dos
veces. Mismo criterio en `crear` y `renombrar` del modal de Ámbitos.

⚠ Y **cambiarle la FECHA a una puntual ya cumplida la vuelve a poner
pendiente** (`updateMaintenance` limpia `lastDone`). El caso natural es
«renovar el dominio», hecho, y al año siguiente ponerle la fecha nueva en vez
de crearlo otra vez: sin esto se quedaba apagado como «Hecha» para siempre,
fuera del calendario y sin avisar. Solo con la fecha — corregir el título no
resucita nada — y solo en las puntuales: en una que se repite, `lastDone` es su
historial.

⚠ **Y por eso existe `src/lib/tareas.ts`** (puro, sin `server-only`, como
`topes.ts` y `fechas.ts`): `estadoDe` y **`cumplida`** — una puntual con
`lastDone` está CUMPLIDA y no vuelve a salir en ningún sitio. Sin ese
predicado, y así estuvo hasta el 05/09/2026, una puntual marcada como hecha no
se callaba nunca: su `nextDue` se queda en el pasado a propósito, así que
figuraba «Vencida» en la lista, contaba en los avisos del inicio, se arrastraba
a hoy en el calendario **y el cron mandaba su correo cada semana sin forma de
silenciarlo**. Las CUATRO superficies lo miran ahora desde el mismo sitio
(`avisarVencidas` lo filtra en SQL con `OR: [{ intervalMonths: { not: null } },
{ lastDone: null }]`); en la lista sale con chip «Hecha» y el tooltip dice
cuándo. Una tarea que se REPITE es otra cosa: al marcarla hecha su `nextDue`
avanza, y volver a vencer es su trabajo.
`estadoDe` estaba además DUPLICADO entre el cron y la lista, con un comentario
diciendo "mismo criterio que": esa es la copia que se desincroniza.

Vive aquí y no en un módulo nuevo por el mismo motivo que la ITV y las
dependencias comparten módulo: es el mismo problema —algo con fecha de lo que
hay que acordarse— y una tabla aparte obligaría a duplicar el calendario, los
ámbitos, los avisos del cron y la interfaz. **Decisión confirmada por Adrián
el 02/09/2026**, cuando se le ofreció separarlo en su propia sección: no
reabrirlo sin un motivo nuevo. Van separadas por **ÁMBITO**: la ITV, el seguro de casa o
la revisión de la caldera son el mismo problema que revisar dependencias —algo
que caduca cada N meses—, así que comparten módulo en vez de tener uno nuevo.

Los ámbitos son una **tabla editable** (`maintenance_scope` + FK `scope_uuid`,
migración `ambitos_editables`), no una lista fija: nacieron como enum de tres el
28/08/2026 y pasaron a tabla el mismo día, porque la lista la decide quien usa
la app. Se gestionan en el modal «Ámbitos» de la pestaña (crear, renombrar,
borrar) — renombrar es seguro (las tareas apuntan por uuid) y **un ámbito en uso
no se borra**, igual que las categorías de gastos. El nombre de cada tarea sale
del `include` de la relación, y el correo de vencidas abre cada tarjeta con él.

Del modal, tres detalles:

- El nombre es **único** en la BD (`uq_maintenance_scope_name`, y la colación
  de MySQL es `_ci`: "casa" choca con "Casa"), pero las actions comprueban el
  duplicado ANTES para poder decir «Ya existe un ámbito con ese nombre» — si lo
  cazara el índice, al cliente llegaría un «Error inesperado» que no explica
  nada. Mismo criterio que en el resto del proyecto.
- **Borrar pide confirmación** (`clave: 'borrar-ambito'`), como el grupo de
  categorías vacío. Aquí no se pierde ninguna tarea —solo se puede borrar el
  vacío— pero sí un nombre que hay que volver a escribir, y era un clic sin
  red. ⚠ Es lo que hace que se APILEN dos modales; ver la trampa de la pila en
  `modal.tsx` (sección de Arquitectura).
- Un ámbito con tareas **solo se vacía tarea por tarea**: no hay "fusionar
  ámbitos" como en las categorías de gastos. Con cuatro o cinco ámbitos y pocas
  tareas cada uno no ha hecho falta; si algún día molesta, el modelo a copiar es
  `fusionarCategorias`.

El filtro por ámbito **solo aparece cuando hay más de uno en uso**, y sus chips
son **solo los ámbitos EN USO** — pintaba todos, así que uno recién creado y
todavía vacío daba un filtro que no encontraba nada. Si alguna tarea se queda
sin ámbito (el FK es `SetNull`, y la action lo impide, pero un borrado directo
en la BD no), aparece un chip «Sin ámbito» para poder llegar a ella: si no,
sería invisible salvo en «Todos».

### La vista de LISTA: dos reglas que salieron de revisarla

- **Lo CUMPLIDO se hunde.** La consulta trae las tareas por `nextDue`
  ascendente y una puntual cumplida se queda con su fecha en el pasado a
  propósito, así que salía la PRIMERA de la lista —encima de lo urgente y con
  su chip apagado—. El orden se remata en el cliente: cumplidas al final.
- ⚠ **El «no hay nada» es de la LISTA, no de la pestaña.** Estuvo delante del
  calendario y lo tapaba: sin tareas —o filtrando por un ámbito sin ellas—
  desaparecía la rejilla entera con sus cargos recurrentes y sus seguimientos,
  que no son tareas ni les afecta ese filtro. Un Panel recién estrenado no
  podía ni ver el calendario.
- La acción principal de la fila **cambia con el estado**: en una puntual ya
  cumplida no es «Hecha» otra vez (no haría nada que signifique algo) sino
  **«Reabrir»** (`reopenMaintenance`), que le quita `lastDone` y la deja
  pendiente. Existe porque «Hecha» es un clic sin confirmación y en una puntual
  era una puerta de una sola dirección: la única salida era borrarla y volver a
  escribirla. En una que se repite no se admite —habría que saber a qué fecha
  volver, y eso es editar—. Y el toast no promete un vencimiento que no va a
  haber: en una puntual dice «Hecha» y no «siguiente vencimiento programado».
- ⚠ Ese botón **necesita `aria-label`**: su único texto es un `<span sm:hidden>`,
  así que a partir de `sm` se quedaba **sin nombre accesible** —el tooltip
  describe, no nombra— y era justo la acción principal de cada fila. Lo cazó un
  test que lo buscaba por su nombre; ahora la lista está en la auditoría axe
  (dentro de `mantenimiento-lista.dom.test.tsx`, porque montarla arrastra sus
  server actions y hay que mockearlas; el ayudante `auditar` es compartido en
  `tests/axe.ts`).
- La lista va en **`ul`/`li`** y no divs apilados, para que se anuncie cuántas
  tareas hay. Es una lista de TARJETAS y no una tabla a propósito: la nota es
  texto de varias líneas.

### Calendario (`lib/calendario.ts` + `panel/calendario.tsx`)

La pestaña Mantenimiento tiene DOS vistas: **Lista** y **Calendario** (la
rejilla de días de un mes). Hubo una tercera, **Año** —la rejilla de 12 meses
que ya existía antes del calendario—, retirada el 05/09/2026 a petición de
Adrián: "lo del año no me gusta nada, prefiero solo meses". No reabrirla; su
`CalendarioAnual` y sus tests se borraron con ella.

El calendario **reúne las TRES fuentes con fecha** de la aplicación, que hasta
entonces solo se veían cada una en su módulo:

| Fuente | Campo | Repite |
|---|---|---|
| Tareas de mantenimiento | `next_due` | cada N meses, o nunca (puntual) |
| Cargos recurrentes | `next_date` + `day_anchor` | cada N meses |
| Seguimientos del pipeline | `next_action_date` | no |

⚠ **Qué se puede hacer aquí y qué no.** Solo las TAREAS se crean y editan
desde el calendario (pulsar un día vacío da de alta con esa fecha; pulsar una
tarea la abre). Un recurrente o un seguimiento enlazan a su módulo: sus
formularios tienen reglas propias —periodicidad e importe, oportunidad y
estado— y una segunda copia aquí es exactamente como se desincronizan. Es el
mismo criterio que el resto del proyecto.

⚠ **El atraso NO se trata igual en las tres**, y es deliberado:

- Una **tarea** vencida antes del mes se arrastra al día de HOY: es lo que hay
  que hacer ya, y dejarla caer fuera del calendario sería lo contrario de lo
  que se busca. Si venció DENTRO del mes que se está viendo no se arrastra
  —su día está a la vista— pero **sí se marca** (`atrasado: f < hoy`): estuvo
  puesto a `false` a secas, así que una tarea que venció el día 3 estando hoy a
  5 se pintaba como una cualquiera, que es perder de vista justo lo urgente.
  Solo se proyectan fechas desde `nextDue`, que es la próxima pendiente, así
  que una ocurrencia anterior a hoy está vencida por definición.
- Un **cargo** atrasado NO se arrastra ni se marca: lo apunta el cron en cuanto
  corra, así que no es algo que nadie tenga que hacer.
- Un **seguimiento** dentro del mes se queda en su día, marcado como vencido.

`lib/calendario.ts` es PURO y sin `server-only` (lo usan el cliente y sus
tests): la aritmética de meses cortos, el ancla del día y el cruce de año son
donde esto se rompe, y ahí hay 17 tests. Ojo con cuatro cosas ya pagadas:

- El importe de un recurrente va por **`eurEntero`** y no por un
  `toLocaleString('es-ES')` a mano: es-ES no agrupa los miles de cuatro cifras
  y una nómina de 1850 salía "1850 €" al lado de un "12.750 €".
- **En móvil las celdas solo llevan PUNTOS de color, sin títulos.** A 375 px una
  columna mide 47 px y los títulos quedaban en "Por…", "Tie…": texto recortado
  hasta ser inútil. El día se toca y se lee entero en el panel de detalle.
- ⚠ **La celda es `flex flex-col`, y eso no es decorativo**: un `<button>`
  centra su contenido en VERTICAL, así que el número del día bailaba entre los
  6 px de una celda cargada y los 41 px de una vacía — cada fila de la rejilla
  a una altura distinta. `text-left` solo arreglaba el eje horizontal y
  `align-top` no pinta nada aquí (alinea el botón en SU línea, no lo de
  dentro). Medido: con flex, las 35 celdas dan el número en (6, 6).
- La cabecera lleva el **nombre completo** del día («Lunes», «Martes») y en
  móvil `diaCorto` de `fechas.ts` («Lun», «Mié»: 27 px en una columna de 48).
  La **inicial suelta no vale para los días**, que es como estaba: Martes y
  Miércoles rotulaban dos columnas con la misma M. Por eso hay `diaCorto` y no
  un `diaInicial` gemelo de `mesInicial`.
  ⚠ El nombre largo va en el **DOM con `sr-only`** en móvil, NO en un
  `aria-label` del div: ahí estaba, y en un div sin rol ese atributo no existe
  —la trampa que ya documenta este mismo fichero—, así que la cabecera parecía
  accesible y en móvil solo se anunciaba "MIÉ".
- **Teclado: UNA parada de tabulador y flechas.** Las 35 celdas son botones, así
  que cruzar el calendario con el tabulador eran 35 paradas. Con tabindex
  rotatorio solo entra en el orden el día de hoy (o el 1 si se ve otro mes) y
  desde ahí las flechas mueven día a día, Inicio/Fin a los extremos de la
  semana y RePág/AvPág al mes de al lado; al salirse del mes se cambia de mes y
  el foco viaja (un `useEffect` sobre `mes`, porque el botón de destino no
  existe todavía cuando se pulsa la tecla). **Sin `role="grid"` a propósito**:
  las celdas son botones de verdad y `gridcell` les quitaría eso.
- **Un día VECINO lleva a su mes**, no da de alta ahí. `eventosDelMes` acota al
  mes, así que la celda del 31 de agosto sale SIEMPRE vacía aunque ese día
  tenga algo: no puede decir la verdad sobre ese día, pero sí llevar a donde se
  ve. Y `aria-pressed` solo va en las celdas que de verdad abren y cierran el
  detalle — en una vacía o vecina el clic hace otra cosa.
- **El detalle se trae a la vista al abrirlo** (`scrollIntoView` con
  `block: 'nearest'`, respetando `prefers-reduced-motion`). En móvil la rejilla
  ocupa más que la pantalla y el panel nacía fuera —medido: y = 935 con una
  ventana de 812—, así que tocar un día parecía no hacer nada. Y es justo donde
  el panel es la ÚNICA forma de leer el día: las celdas solo llevan puntos.

### Notas (`src/lib/notas.ts` + `/app/panel?tab=notas`)

Quinta pestaña del Panel: apuntes propios del admin con formato (tabla `note`,
migración `notas_y_unicidad`). Se editan en un **editor visual** tipo Word
(`contentEditable` + `document.execCommand` en `panel/notas.tsx`: siempre se ve
el formato) y se **guardan como HTML**. La seguridad de guardar HTML está en que
**se SANEA en el servidor antes de guardarlo** (`src/lib/sanitizar-html.ts`,
sobre `sanitize-html`): es el punto de confianza —no el cliente, que se salta—,
con una allowlist que tira `<script>`, `on*`, estilos y el `javascript:` de un
href. Como lo guardado ya está saneado, pintarlo con `dangerouslySetInnerHTML`
(editor y tarjetas, con la clase `.contenido-nota` de `globals.css`) es seguro.
Reabrió el «módulo de notas» que estaba descartado (25/08); su primera versión
del día guardaba Markdown, y se pasó a HTML/WYSIWYG a petición.
⚠ Un saneador de HTML NO se escribe a mano: va sobre `sanitize-html`, igual que
las gráficas van sobre Chart.js.

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

### API v1 para los Atajos de iOS (`/api/v1/*`)

Cuatro endpoints para apuntar cosas **sin abrir el navegador** (`POST
/movimientos`, `POST /notas`, `GET /resumen`, `GET /categorias`). El contrato
y la receta del Atajo están en **`docs/API.md`**; aquí, lo que hay que saber
para tocarla:

- **Tokens Bearer** en `src/lib/api-token.ts` + tabla `api_token`, gestionados
  en **Panel → Usuarios → API** (`users/api-tokens.tsx`). Se guarda **solo el
  SHA-256**, así que el valor se muestra UNA vez: si se pierde, se revoca y se
  crea otro. SHA-256 y no bcrypt a propósito (256 bits aleatorios, y se
  comprueba en cada petición). Un token solo vale con su cuenta **ACTIVE y
  ADMIN** — misma reverificación en vivo que la sesión del navegador.
- **La validación es COMPARTIDA con el dashboard**: `src/lib/alta-movimiento.ts`
  y `src/lib/alta-nota.ts` los usan tanto la API como `createGasto` /
  `createNote`. Es la regla que no se salta: dos puertas al mismo dato con
  reglas propias es como se descuadra un mes en silencio. En `alta-nota` eso
  incluye el **saneado del HTML**, que es justo lo que no puede tener dos
  definiciones.
- `identificar()` devuelve **tres estados** (`ok` / `invalido` /
  `indisponible`), no dos: con la BD caída, un 401 le diría a su dueño que su
  token está mal —y lo revocaría para nada—. `indisponible` sale como **503**.
  La autenticación lleva **tope de 5 s** (`_comun.ts`) porque el pool de
  Prisma esperaba 10 s por consulta y la petición se quedaba 20 s colgada.
- Pensada para un Atajo, no para un cliente HTTP: importe con **coma
  decimal**, categoría **por nombre** (sin tildes ni mayúsculas), `tipo` y
  `fecha` con valor por defecto, no se mira el `Content-Type` (los Atajos lo
  ponen mal) y cada escritura devuelve un `mensaje` listo para leer en voz alta.
- **Sin CORS a propósito**: la consumen Atajos y scripts. Sin
  `Access-Control-Allow-Origin`, una web ajena no puede leer la respuesta
  aunque tuviera el token.
- La API **no edita ni borra**, y no expone ahorro ni pipeline: cada endpoint
  es superficie que hay que defender.

### Validación de entradas (`src/lib/esquemas.ts`)

TODO lo que entra por una server action o por la API se valida con **Zod**,
desde esquemas que viven en un solo sitio y se aplican con `validar(Esquema,
datos)` → `{ ok: true, datos } | { ok: false, message }`. Los límites son los
de las columnas de la BD y se declaran una vez; los mensajes van en español y
**dicen qué pasa**, porque viajan tal cual al cliente en `{ ok, message }`.

Los comparten las actions y **`alta-movimiento.ts` / `alta-nota.ts`**, que son
la puerta de la API v1: por eso la API valida igual sin escribir nada aparte.

⚠ **Dos trampas de Zod**, las dos con test propio porque ya costaron un fallo:

- `z.coerce.number()` en una unión con `z.null()` convierte **`null` en 0**
  (`Number(null) === 0`, y la unión prueba las opciones en orden). En el
  control mensual del ahorro eso escribe un cero donde el mes estaba SIN
  RELLENAR, que es justo lo que el módulo distingue para avisar. Por eso aquí
  no se usa `coerce` en uniones: el null se atiende primero, a mano.
- Un campo con `.transform()` **sigue siendo obligatorio**: sin `.nullish()`
  antes, omitir la clave falla con "expected nonoptional".

Dos criterios más: lo que llega **mal en una celda de una tabla que se envía
completa se SANEA a null** en vez de tumbar la fila (`cifraMes`: doce meses no
pueden perderse por un NaN suelto), y el **identificador no valida el formato
canónico de un uuid** — Prisma parametriza, la BD heredada mezcla v1 y v4, y
donde el id viene de fuera de verdad lo que se comprueba es que la fila
EXISTA. Sí se rechaza el vacío, el null y las cadenas absurdas.

### Rate limiting (`src/lib/rate-limit.ts`)

Ventana **deslizante** en memoria, con tope en tres sitios: la **API v1** (por
token, y por IP lo que no entra), el **login** (`/api/auth/*`) y las
**escrituras del dashboard** (por usuario, dentro de cada `guarded`).

⚠ No contradice el descarte del 28/08: lo descartado fue el rate limit **en
Caddy** (exigía un build propio). Esto va en la aplicación.

- **Sin Redis a propósito**: el despliegue es UN contenedor, así que un
  contador en memoria ve todas las peticiones — la condición que hace válida
  la técnica. Con dos réplicas el límite efectivo se duplicaría, y ahí sí
  tocaría Redis.
- **Deslizante y no por bloques**: con bloques se cuelan `2 × max` a caballo
  entre dos ventanas, que es el fallo clásico.
- El del **login no es contra la fuerza bruta** (es OAuth de Google, no hay
  contraseña): es contra el machaque de `/api/auth/*`, que en cada intento
  consulta la allowlist y escribe en `user_session` y `login_event`.
- El **503 de la API cuenta** para el tope estrecho por IP. Lo encontró el
  e2e: con la BD caída la rama `indisponible` salía antes del freno, y como
  cada intento se come el tope de 5 s de la autenticación, una caída de la BD
  dejaba la API en barra libre justo cuando atender sale más caro.
- Las cifras no las nota un uso normal (30 logins, 60 de API, 120 escrituras
  por minuto). Un frenazo sale como **429 con `Retry-After`** y se registra a
  `warn` con la clave, que es lo único que distingue un bucle propio de un
  tercero. `reiniciarLimites()` existe para los tests: el contador es del
  proceso y sin reiniciarlo un fichero agotaría la ventana de los siguientes.

### Registro (`src/lib/log.ts`)

Cuatro niveles (`debug` < `info` < `warn` < `error`) con el suelo en
`LOG_LEVEL` (por defecto `debug` en desarrollo, `info` en producción). En
**producción, una línea JSON por evento** —para poder hacer
`docker compose logs web | jq 'select(.nivel=="error")'`—; en desarrollo, el
formato corto `[scope] mensaje`. Sustituye a los ~45 `console.*` con prefijo a
mano que había repartidos, y el prefijo pasa a ser el campo `scope`.

Al registrar, **los números van como campos, no dentro de la frase**
(`log.info('cron', 'recurrentes apuntados', { movimientos: n })`): es lo que
permite filtrar sin parsear texto. Un `Error` se serializa con nombre y
mensaje (`JSON.stringify` lo deja en `{}`) y la **traza solo fuera de
producción**. Los componentes de **cliente se quedan en `console`**: el
navegador es donde se miran. Sin `server-only` (mismo criterio que `fechas.ts`).

### Salud del despliegue (`/api/health`, `/api/ready`)

Dos rutas públicas y deliberadamente mudas (solo dicen sí o no: ni el error,
ni la versión, ni el tiempo).

- `/api/health` — **vivo**. No toca la BD. Es lo que mira el healthcheck de
  `docker-compose.yml`.
- `/api/ready` — **listo**. `SELECT 1` con tope de 3 s y **503** si falla.

⚠ Están separadas por una razón concreta: un healthcheck de Docker que
comprobara la BD **reiniciaría `web` cada vez que la BD tarda en arrancar**,
que es justo el bucle que se quiere evitar. `/api/ready` es para un
balanceador, no para reiniciar nada.

### Cabeceras de seguridad (`next.config.ts`)

CSP que fija el **origen de cada tipo de recurso** (`default-src`,
`script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `worker-src`,
`manifest-src`, `frame-src`, `form-action`, `object-src`, `base-uri`,
`frame-ancestors`), más HSTS, `nosniff`, `Referrer-Policy`,
`X-Frame-Options` y `Permissions-Policy`.

⚠ `script-src` lleva **`'unsafe-inline'` a propósito**: Next hidrata con
scripts en línea y una CSP estricta necesitaría **nonces**, que están
descartados (exigen middleware, y aquí React escapa el contenido). Lo que sí
aporta esta CSP es cerrar la **exfiltración a un servidor ajeno** vía
`connect-src`, que es el remate de casi cualquier XSS. HSTS **sin `preload`**:
entrar en la lista es fácil y salir tarda meses.

**En desarrollo NADA de esto se aplica**, y es deliberado: la CSP se manda
como `Content-Security-Policy-Report-Only` (avisa en la consola, no bloquea)
y no se manda `X-Frame-Options`, ni `frame-ancestors`. El motivo tiene
nombre: `XFO: DENY` + `frame-ancestors 'none'` + `frame-src 'none'` impiden
cargar la página **dentro de un iframe**, que es exactamente cómo funcionan
las extensiones de vista responsive (varios móviles a la vez con los clics
espejados) — y en local esas cabeceras no protegen de nada. Report-only en vez
de quitarla del todo para no perder lo único que aportaba en dev: que una
violación real se vea aquí y no se descubra en producción. Turbopack y el HMR
necesitan además `'unsafe-eval'` y `ws:`, que solo se añaden en desarrollo.

⚠ Quien toque este bloque: los **e2e comprueban la versión aplicada** (corren
contra un build de producción), así que un cambio aquí se ve allí.

### Accesibilidad: tres reglas que ya costaron un fallo

- **Nada de `text-muted-foreground/70` (ni /60, ni /50).** Medido sobre el CSS
  compilado: `/70` da 3,97:1, `/60` 3,24 y `/50` 2,62 — todos por debajo del
  4,5 de AA. Sin opacidad son 6,9. Se colaba porque el token base sí pasa y la
  opacidad la aplica Tailwind aparte.
- **`aria-label` en un `div` sin rol NO existe**: la especificación lo prohíbe
  y el lector de pantalla se lo salta. Si una celda o un adorno tiene que
  anunciarse, necesita rol — el mapa de calor de Visitas usa `role="img"` en
  sus 336 celdas justo por esto.
- **El título de una tarjeta es `h2`**, no `h3`: va bajo el `h1` de la página
  y saltarse un nivel rompe el orden de encabezados.

⚠ Y dos trampas al MEDIR, que dan falsos positivos:

- Auditar **mientras Next revela el streaming**: el árbol nuevo viaja en un
  `div[hidden]` y axe dirá que no hay `main` ni `h1`. Se comprueba con
  `document.querySelector("main").closest("[hidden]")`. Forzar una captura
  antes de auditar lo asienta; un bucle de espera dentro de la página lo
  EMPEORA (bloquea el hilo y el revelado no llega a ejecutarse).
- Comprobar el foco con **`.focus()` por script**: no activa `:focus-visible`,
  así que parece que no hay anillo. Hace falta un Tab de verdad.

### Tablas (`src/components/ui/tabla.tsx`)

**Todas las tablas del dashboard salen de aquí**, y la referencia es la del
**Control mensual** de Ahorro: cabecera en versalitas apagadas, separador por
fila (`border-border/50`), celdas compactas (`px-3 py-1.5`) y el contenedor
con `overflow-x-auto` + `min-w-*` para que en móvil se desplace la tabla y no
la página.

Piezas: `TarjetaTabla` (tarjeta + cabecera con título, icono, cifra y
acciones), `Tabla` (contenedor, `thead` desde un array de `Columna`),
`Fila`, `Celda` y `FilaVacia`. Y `thClass` / `tdClass` para las tablas que
mantienen su propio marcado.

⚠ Nació el 02/09/2026 porque las clases de `th`/`td` estaban copiadas en
**cuatro ficheros con tres variantes** de padding (`py-1.5`, `py-2`,
`py-2.5` y una responsive), y porque sesiones, accesos y los tokens de la API
se pintaban como `div` apilados aunque son tabulares. Parecidas de lejos,
distintas de cerca. Al añadir una tabla, **usar estas piezas**: si hace falta
algo que no dan, se añade aquí, no en el componente.

**En móvil, la misma estética con `CabeceraMovil` + `FilaMovil`**: una REJILLA
con la gramática de la tabla (cabecera en versalitas, separador por fila,
importes a plomo en su columna).

Es una rejilla y no un `<table>` porque en 375 px la tabla tendría que
desplazarse en horizontal para enseñar el importe, y eso en una lista que se
recorre con el pulgar no vale: la rejilla reparte las cuatro columnas en el
ancho que hay.

⚠ Cada fila es su PROPIA rejilla, así que la plantilla de columnas
(`grid-cols-[...]`) tiene que ser la misma en la cabecera y en las filas: se
declara una vez como constante (`PLANTILLA_MOV`). Van cuatro columnas y no
cinco porque en 375 px la categoría no cabe — su punto de color viaja pegado
al concepto, con el nombre en el tooltip.

Lo que NO se duplica entre las dos vistas: el formulario de edición
(`formularioEdicion(m)`) y las acciones de fila (`accionesDe(m)`). Son seis
campos y tres acciones; una segunda copia es la que se queda sin el campo que
se añada mañana.

⚠ Los paneles flotantes van con **`bg-popover`**, nunca `bg-card`: las
tarjetas del proyecto son translúcidas a propósito (`--card` es un blanco al
4 %), así que un menú con ese fondo **se ve transparente** y deja leer la lista
de debajo. Pasó con el menú «⋯» de las acciones de fila.

Dos criterios: el aviso de "no hay nada" va como **fila dentro de la tabla**
(`FilaVacia`) para que la cabecera siga enseñando qué columnas tendrá cuando
haya datos, y la tabla del año de Gastos **perdió su padding apretado de
móvil** a cambio de verse como las demás — en pantalla estrecha ahora
desplaza, que es lo que ya hacía la del Ahorro.

### Tooltips (`src/components/ui/tooltip.tsx`)

**Ningún `title` nativo en el dashboard**: todos los tooltips van por
`Tooltip`, que envuelve UN elemento y le engancha los eventos con
`cloneElement` (el DOM no cambia: nada de spans que rompan un `truncate` o una
fila flex). Se abre con retardo al pasar el ratón y al instante con el foco,
se cierra al salir y con Escape, y mientras está visible el hijo lo referencia
con `aria-describedby`. El **nombre accesible sigue siendo el `aria-label`
del hijo**: el tooltip describe, no nombra. Mismo aspecto que el tooltip de
las gráficas (`ui/charts/tooltip.ts`), que es otra pieza a propósito (aquel
inyecta HTML con filas y colores; este es React puro).

⚠ **Un botón `disabled` no recibe el ratón** (Chrome se lo traga, y el padre
tampoco lo ve), y justo ahí es donde el tooltip más importa: dice POR QUÉ una
acción está apagada. Para esos, `envuelto`: un `span` alrededor que sí recibe
los eventos, con el hijo en `pointer-events-none`. Es lo que usa
`MenuAcciones` con el `motivo` de cada acción.

⚠ **Solo UN globo visible a la vez** (registro de módulo) y **se cierra al
pulsar**. Los dos salieron revisándolo en el navegador, y ninguno se ve
leyendo el código: el ratón sobre un icono y Tab al siguiente dejaba DOS
globos (el primero nunca recibe `mouseleave` porque el ratón no se ha movido),
y tras hacer clic el botón se queda con el foco, así que el globo permanecía
colgado aunque el cursor ya estuviera lejos.
Excepción: con `envuelto` el clic NO lo cierra — ahí el hijo está apagado, el
clic no hace nada y el tooltip es justo la explicación de por qué.

⚠ Los `title=` que quedan en el código son PROPS de componentes (`Modal`,
`CheckCard`, `TarjetaSerie`), no atributos HTML. Al añadir un atributo `title`
a un elemento, usar `Tooltip`.

### Acciones de fila (`src/components/dashboard/menu-acciones.tsx`)

Las acciones de una fila se **declaran** (`AccionFila[]`: id, nombre, icono,
`onClick`, `disabled`, `motivo`, `destructiva`) y `MenuAcciones` decide cómo
pintarlas: **iconos en línea en escritorio** y un **«⋯» con menú en móvil**.
Una sola definición, no dos maquetaciones.

El umbral es un parámetro (`desde`, 3 por defecto) porque con una o dos
acciones el menú EMPEORA la cosa: son dos toques donde había uno. Por eso
las notas, las sesiones, los tokens y las aportaciones del ahorro siguen con
sus iconos a la vista.

Dos criterios que conviene respetar al añadir uno:

- En el menú, las acciones van **por su nombre**, no por su icono: en móvil no
  hay `title` que enseñar al pasar el dedo. Y una acción apagada **explica el
  motivo** ahí mismo (`motivo`), que en un icono solo cabía en un `title`.
- Lo que NO es una acción se queda fuera: el chevron de un recurrente (es un
  despliegue) y el botón «Hecha» de una tarea de mantenimiento (es LA acción
  de su tarjeta, y en móvil lleva etiqueta).

El popover se reutiliza de `ui/fields.tsx` (`usePopover` + `PopoverPanel`,
exportados para esto): portal con posición fija, así no lo recorta ninguna
tabla con overflow ni el cuerpo de un modal, y hereda el cierre con Escape,
con clic fuera y al hacer scroll.

⚠ Hubo un conmutador de **densidad** (tablas normales o compactas) el
02/09/2026, retirado el mismo día con sus reglas de CSS: apretar las filas no
quedaba estético. No reabrirlo sin una idea distinta.

### Esqueletos y Suspense (`src/components/dashboard/esqueletos.tsx`)

Las páginas pesadas (inicio, finanzas, panel, pipeline) envuelven su bloque de
datos en `Suspense` con un esqueleto: el título y la navegación se pintan al
instante y solo los datos esperan. Los esqueletos son comunes
(`EsqueletoTarjetas`, `EsqueletoPanel`, `EsqueletoLista`, `EsqueletoTablero`)
porque el del Panel ya estaba copiado. Todos con `aria-hidden`: son un hueco
visual, no información.

Dos detalles que importan al añadir uno: el componente `async` tiene que estar
**separado** (si la consulta vive en la propia página, no hay nada que
esperar), y la `key` del `Suspense` debe llevar los parámetros de la vista, o
al cambiar de sección se queda congelada la anterior en vez de salir el
esqueleto.

### Iconos y metadata (`src/app/layout.tsx`)

⚠ Trampa ya pagada: **declarar `metadata.icons` hace que Next deje de inyectar
los iconos por convención de fichero** (`app/icon.svg`, `app/apple-icon.tsx`).
Añadir ahí las splash de iOS (`icons.other`) borró el favicon de la pestaña sin
ningún aviso. Los tres van explícitos —`icon`, `apple`, `other`— y quien toque
ese bloque tiene que dejarlos.

### Mapa de las visitas (`panel/mapa-visitas.tsx`)

La tarjeta de Geografía tiene un botón «Ver en el mapa» que abre el informe
sobre un mundo en SVG: **países en burbuja** sobre su centroide (área
proporcional a las visitas, no radio: si no, el doble parece cuatro veces) y
**ciudades con pin** encima.

⚠ **Sin dependencia de mapas y sin red**, y es lo que decide el diseño. GA4
devuelve solo NOMBRES (`country`, `city`), no coordenadas, así que un mapa de
teselas habría exigido abrir `img-src` y `connect-src` en la CSP —lo que se
acababa de cerrar en la auditoría del 03/09— y geocodificar contra un tercero,
mandándole de dónde son las visitas del sitio. En su lugar:

- La silueta es una ruta incrustada en `panel/mundo-path.ts`, generada a mano
  desde Natural Earth 110m (dominio público) en la misma proyección
  equirectangular que `lib/geo-visitas.ts`. Los polígonos que cruzan el
  antimeridiano vienen ya CORTADOS: sin eso salen rayas de lado a lado.
- Las coordenadas salen de una tabla local (`lib/geo-visitas.ts`): países,
  capitales de provincia españolas y los municipios grandes. Creció al ver
  datos reales — las visitas venían de Algeciras y Castelldefels, que no son
  capitales.
- Lo que no está en la tabla **no se pierde**: no sale con pin, pero el mapa lo
  dice al pie con su nombre y su cifra, y sigue en el ranking de la tarjeta.

⚠ **Dos trampas del encuadre**, las dos ya pagadas:

- El `viewBox` se **ajusta a las marcas** (con proporción 2:1 y un ancho
  mínimo). Con el tráfico de este sitio —España y poco más— el mundo completo
  es 95 % de océano con las burbujas amontonadas en una esquina. Un botón
  devuelve el planeta cuando hace falta la referencia.
- Al hacer zoom con el `viewBox` **escala TODO**, radios y grosores incluidos,
  así que se compensan por el factor `k`: un pin mide lo mismo en pantalla
  encuadrado en España que en el planeta.

Y la leyenda va en HTML al lado, por lo mismo que la de los donuts: las marcas
de un SVG no son texto que se pueda leer, ordenar ni anunciar.

⚠ El nombre accesible del `role="img"` **concuerda singular y plural** ("1
país", no "1 países"): se lee en voz alta, y ahí un plural mal puesto canta
más que en ningún otro sitio. Con test propio.

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
**Importes: decimales solo si los hay, y en los KPI nunca.** `eur()` de
`lib/euros.ts` pinta "12,50 €" y "60 €" (la regla general: en tablas y listas
los céntimos descuadran las cuentas a ojo si faltan). La cifra grande de una
tarjeta KPI va con **`eurEntero()`** —"1.374 €", nunca "1.373,72 €"—: a 24 px
los céntimos no aportan lectura, la ensucian (petición de Adrián, 05/09/2026).
Y vale para la tarjeta ENTERA, pie incluido ("−27 % frente a 1.887 €"): la
primera versión dejó la comparativa con céntimos y Adrián la señaló al momento.
Las filas `Dato` del bloque de Ahorro del Panel se quedan con `eur()`: no son
una tarjeta KPI.
**Porcentajes con espacio, como prescribe la RAE** ("67 %", no "67%") y con
espacio **irrompible** (` ` / `&nbsp;`), para que la cifra y el símbolo no
se separen en un salto de línea. En finanzas lo pone `pct()` de `savings/comun`
(vía `Intl`, que en es-ES ya usa ese espacio) — usarlo siempre que se pueda en
lugar de componer el texto a mano.
**Sin ejemplos enumerados en labels ni placeholders** — nada de "Concepto
(vuelos, hotel...)" o "Título (rol, encargo...)": etiquetas escuetas
("Concepto", "Título"). Los placeholders solo si son funcionales ("Buscar...",
"Importe", "Sin objetivo"), nunca de ejemplo (preferencia de Adrián, 26/08/2026).
