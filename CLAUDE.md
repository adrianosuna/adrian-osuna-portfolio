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
del monitor de infraestructura (TLS/fs/reloj simulados), validaciones/guardas
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
compartidas (modal, campos, sub-pestañas). `server-only` se alias-ea a un stub
y `next-auth` se procesa inline en `vitest.config.mts`.
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
quede el rastro— y en el calendario a 12 meses sale UNA vez (o en el mes en
curso marcado como atrasado, si ya pasó). En el formulario es
**Repetición: «Se repite» / «Una vez»**, y con "Una vez" el campo de los meses
desaparece; en la lista se lee «Una vez».

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
no se borra**, igual que las categorías de gastos. El filtro por ámbito **solo
aparece cuando hay más de uno en uso**; el nombre de cada tarea sale del `include`
de la relación, y el correo de vencidas abre cada tarjeta con él.

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
