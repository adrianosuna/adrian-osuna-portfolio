# Changelog

Historial de lo hecho en el proyecto, en orden inverso (lo más reciente
arriba). Funciona en pareja con `TAREAS.md`: allí vive **solo lo pendiente**;
cuando algo se termina, se cuenta aquí con su porqué y desaparece de allí.

---

## 26/08/2026

### KPIs del Resumen de finanzas, y mantenimiento más limpio

- **KPIs del Resumen rehechos**: los de antes eran agregados históricos que no
  hacían pensar nada (total ahorrado, media anual, mejor año...). Ahora miran
  el **año en curso**: lo ahorrado con lo que falta para el objetivo,
  **proyección a cierre** con veredicto ("a este ritmo se queda a 1.950 €"),
  **comparación con el año anterior a la misma altura del calendario** (±€ con
  su contexto) y **ritmo mensual** frente al del año pasado, con la tasa de
  ahorro. Los agregados históricos siguen en la tabla y la gráfica de abajo, y
  vuelven como tarjetas solo si no hay año en curso. `YearSummary` gana
  `generalPorMes` (12 valores) para poder comparar y proyectar.
- **Fuera el botón "Probar correo"** de Mantenimiento (se pulsaba sin querer;
  el SMTP ya quedó verificado en producción) y con él su server action.
- **Lista de mantenimiento legible en móvil**: tarjeta en bloque con el chip de
  estado junto al título, las notas recortadas a dos líneas y las acciones en
  su propia fila con el botón "Hecha" etiquetado; desde `sm`, la fila de
  siempre. "Nueva tarea" a ancho completo en móvil. Con un título largo el
  chip se aplastaba: le faltaba `shrink-0` a su envoltorio (y `min-w-0` al
  título, que ahora es el que se ajusta).
- **Las tareas de mantenimiento se leen en lenguaje natural**: "cada 1 mes ·
  vence el 25/09/2026 · última vez el 25/08/2026" obligaba a restar fechas de
  cabeza. Ahora el **chip dice cuándo** (con su color de urgencia: "Hace 6
  días", "Vence hoy", "En 3 días", "En 1 año") y la línea de detalle es
  "Mensual · hecha hace un mes"; las fechas exactas quedan en el tooltip.
  Helpers `periodicidad`/`cuando`/`antiguedad` con tests (161 en total).
- **Los tabs del Panel scrolleaban también en vertical**: `overflow-x-auto`
  deja `overflow-y` en `auto`, y el `-mb-px` de los enlaces dejaba el
  contenido 1px más alto que la caja (38 en 37) — de ahí el temblor vertical.
  Arreglado moviendo la línea inferior al envoltorio y el `-mb-px` al propio
  scroller, con `overflow-y-hidden` de seguro (también en la barra de años de
  Finanzas). Ahora solo hay scroll horizontal.

### Inicio del dashboard: de folleto a centro de mando

El inicio era una portada: de sus tres KPIs uno estaba vacío ("Gastos del
mes — En desarrollo") y otro era inútil ("Módulos activos: 3"), y media
página la ocupaban una "Hoja de ruta" con cinco filas de *Disponible* y un
"Tu cuenta" que repetía datos ya sabidos — documentación de proyecto en un
panel privado al que solo entra su dueño. Rehecho alrededor de una pregunta:
**¿qué requiere mi atención hoy?**

- **Franja "Requiere tu atención"** al principio, con avisos accionables que
  enlazan a su módulo: seguimientos del pipeline vencidos (rojo), tareas de
  mantenimiento vencidas o de esta semana, y meses de ahorro ya cerrados sin
  rellenar. Sin nada pendiente, un estado "Todo al día" en verde. Es el mismo
  conocimiento que ya mandaba el cron por correo, ahora también al entrar.
- **KPIs con dato real**: ahorro del año con barra de progreso del objetivo,
  valor del pipeline abierto con nº de oportunidades vivas, y pulso de
  visitas de 7 días con su tendencia. Los importes respetan el modo privado.
- **Actividad reciente**: los últimos movimientos del historial del pipeline
  ("Conversación → Propuesta · hace 2 h"), y los módulos como lista compacta
  en vez de cuatro tarjetas que duplicaban el menú superior.
- **Eficiencia**: los datos salen de `lib/inicio.ts` en cuatro consultas
  acotadas y paralelas — antes se traía `listYears()` (todos los años con sus
  meses, extras y viajes) para pintar una cifra. El pulso de visitas usa un
  informe nuevo de GA (`pulsoVisitas`, uno en vez de los doce del panel) y va
  en Suspense: la red externa no retrasa el pintado. Piezas visuales
  separadas en `components/dashboard/inicio.tsx`.

### Modo privado en Finanzas, tabs con scroll y miles con punto

- **Modo privado**: los importes de Finanzas salen **ocultos por defecto**
  (difuminados y sin poder tocarse: editar sin ver sería un error fácil) y se
  revelan con el botón del ojo de la barra de pestañas, que queda fuera del
  difuminado para poder navegar. El modal de «Gestionar años» enmascara los
  objetivos (`••••`) al quedar fuera, y la tarjeta de ahorro del inicio del
  dashboard respeta la misma elección. Estado en `sessionStorage` vía
  `useSyncExternalStore` (almacén de módulo, sin contexto ni `setState` en
  efecto): se mantiene al navegar y cada sesión nueva empieza oculta.
- **Tabs con scroll en móvil**: la barra del Panel de control se cortaba con
  sus 4 pestañas en 375px — ahora scrollea (`overflow-x-auto` + `shrink-0` y
  `whitespace-nowrap`, el patrón que ya usaba Finanzas).
- **Separador de miles siempre**: `es-ES` no agrupa los números de 4 cifras
  (daba "3950 €" junto a "12.750 €"), así que todos los formateadores de
  dinero y de visitas llevan `useGrouping: 'always'`.
- De paso, el botón de descarga del Excel vuelve a ser un `<a href>` (lo
  canónico, y sin el aviso de lint de `location.assign`): el doble de
  descargas era la herramienta de vista responsive, no el enlace.

### 🚀 Desplegado en producción todo el trabajo del 25-26/08

Pipeline v2, Panel de control completo, finanzas reformadas, avisos por
correo, GEO y paleta unificada — todo en adrianosuna.com. Extras del
despliegue: migración consolidada `modulos_post_lanzamiento` aplicada +
seed, `.env.production` con el `AUTH_GOOGLE_SECRET` rotado (el login de
producción estuvo roto con el viejo desde el 25/08) y las variables nuevas
de GA y SMTP; todas las sesiones pidieron relogin (a propósito). Tropiezo
cazado y documentado: `docker compose build` **no reconstruye los servicios
de perfiles inactivos** — la imagen de `migrate` se quedó en la del
lanzamiento y decía "No pending migrations"; el build con migraciones debe
llevar `--profile setup` (corregido en DESPLIEGUE.md y TAREAS).

### Migraciones consolidadas y verificadas desde cero

Las 8 migraciones del 25-26/08 nunca llegaron a producción, así que se
consolidaron en una sola (`modulos_post_lanzamiento`, con el seed de las 5
tareas de mantenimiento incluido) — el despliegue aplicará baseline +
consolidada. El registro de migraciones de la BD local se re-sincronizó sin
tocar los datos (`DELETE` de las 8 en `_prisma_migrations` + `migrate resolve
--applied`). **Verificación desde cero** contra un MySQL 8.4 desechable en
Docker (misma imagen y colación que producción): `migrate deploy` + seed
sobre BD vacía → 10 tablas, 4 FKs en cascada, 5 tareas sembradas con UTF-8
correcto y admin activo.

### Finanzas: tasa de ahorro y exportación a Excel

- **Tasa de ahorro** (qué parte de lo ingresado se ahorra, con la semántica
  del sobrante incluida): KPI nuevo en la pestaña del año (en vivo sobre el
  borrador), y en el Resumen como KPI histórico, columna de la tabla (con la
  fila TOTAL) y dato de las tarjetas móviles. `YearSummary` gana
  `incomeTotal`; fórmulas `tasaAhorroDe`/`pct` en `savings/comun.tsx`.
- **Exportar a Excel por año** desde «Gestionar años» (icono de descarga por
  fila): route handler `GET /app/finance/exportar?year=` con guarda de admin
  propia, generado con **exceljs** (mantenida y sin CVEs en `pnpm audit`, al
  contrario que el paquete `xlsx` de npm). El .xlsx lleva el control mensual
  con restante y totales, extras, gastos de viajes y el resumen del año
  (sobrante, ahorro anual, objetivo y tasa). Con tests (153 en total,
  incluida la generación real del fichero). La descarga usa navegación
  programática (`location.assign` desde un botón). Nota de una caza de
  fantasmas: una "descarga doble" resultó no ser de la app — un registro
  temporal de cabeceras en el servidor reveló que la segunda petición venía
  de un iframe con user-agent de iPhone: una herramienta de vista responsive
  del navegador que espeja los clics. Un clic real = una petición.

### Sin ejemplos enumerados en los formularios

Retirados de todo el dashboard los ejemplos en labels y placeholders —
"Concepto (vuelos, hotel...)", "Título (rol, encargo...)", "Contacto (nombre,
email...)", "persona@gmail.com", etc.: etiquetas escuetas y placeholders solo
funcionales. Regla anotada en CLAUDE.md para que no vuelvan.

### Finanzas, fase 2 del asistente: recordatorio de mes sin rellenar

El cron diario de las 8:00 gana un tercer aviso (`avisarMesSinRellenar` en
`lib/finance.ts`): mira el año del mes natural anterior (en enero, el
diciembre del año pasado) y, si tiene meses ya cerrados sin ningún dato,
manda un correo `[Panel AO]` con sus nombres y botón a Finanzas. Reaviso
semanal vía la columna nueva `last_reminded` (migración
`add_saving_reminder`), no diario. Un mes con cualquier dato (aunque sea un
0) cuenta como relleno y calla el aviso. Con tests (148 en total).

### Finanzas: el sobrante de viajes cuenta, donut de composición y limpieza

- **Semántica nueva del ahorro anual** = mensual + extras + **sobrante de
  viajes** (ahorrado − gastado): al cerrar el año lo no gastado se suma y los
  viajes del siguiente empiezan de cero (si se gastó de más, el exceso
  resta). Atraviesa todo: tarjeta del año ("Ahorro anual (con sobrante)"),
  objetivo y desvío, proyección (los "fijos" ahora son extras + sobrante),
  Resumen (tabla y acumulado) — fórmula única en `ahorroAnualDe`.
- **Donut "Composición del ahorro"** (SVG a mano, `DonutAhorro`): pesos de
  ahorro mensual / ingresos extraordinarios / sobrante de viajes, con total
  en el centro y leyenda con importes y porcentajes.
- **Fuera la gráfica "Acumulado mensual"** (no aportaba) y con ella la carga
  del año anterior en la página.
- **Fuera la fecha de los gastos de viaje** (concepto e importe bastan):
  UI, actions y columna `expense_date` eliminada (migración
  `drop_travel_expense_date`).
- **"Evolución mensual" legible en móvil**: variante compacta de la gráfica
  de barras (lienzo estrecho, meses a una letra, eje abreviado "1,2k") que
  cabe entera en pantalla; la ancha queda para escritorio. Y fuera la nota
  "Se cambia en «Gestionar años»" de la tarjeta del objetivo.

### Finanzas, fase "asistente": proyección, ritmo y acumulado

El módulo deja de ser un espejo del Excel y empieza a contarte cosas — todo
cálculo en cliente sobre el borrador editable, sin tocar la BD (fórmulas
puras `proyeccionDe`/`esperadoHoy` en `savings/comun.tsx`, con tests):

- **Asistente del año en curso** (en la tarjeta del objetivo): ritmo actual
  (media €/mes de los meses rellenos), **proyección a fin de año** (lo actual
  + la media por los meses que faltan, con veredicto "da para el objetivo /
  se queda corta") y **cuánto hace falta al mes** para cumplir el objetivo en
  los meses que quedan (los pasados sin rellenar se dan por perdidos).
- **Objetivo con ritmo temporal**: marca vertical en la barra con el objetivo
  prorrateado a día de hoy y chip de desvío (▲ por delante / ▼ por detrás).
- **Gráfica "Acumulado mensual"** nueva: la línea del año contra la recta del
  objetivo prorrateado y la sombra del año anterior (comparativa entre años
  de un vistazo). La línea solo llega hasta donde hay datos.
- **Control mensual con contexto**: el mes actual se resalta y los meses
  pasados sin rellenar llevan un punto ámbar.
- **Modal «Gestionar años»**: la gestión de años se concentra en un único
  sitio — un botón en la barra de pestañas abre la lista de años con edición
  inline (año y objetivo), borrado con confirmación y alta al pie. Fuera los
  botones sueltos (Nuevo/Editar/Eliminar año) y la edición del objetivo
  dentro de la tarjeta del año: el objetivo solo se cambia desde ahí. Si se
  renombra o borra el año activo, la navegación sigue sola (al nuevo o al
  Resumen).
- **Tablas usables en móvil** (mismo patrón que usuarios y pipeline): el
  control mensual pasa a una tarjeta por mes (sus 3 campos etiquetados +
  restante en la cabecera, y tarjeta de totales) y "Todos los años" del
  Resumen a una tarjeta por año que enlaza a su pestaña — las tablas quedan
  solo en escritorio, se acabó el scroll horizontal a ciegas.

### Finanzas sin capital: solo se controla el ahorro

Decisión de producto: el capital inicial/final no aporta ("solo quiero
controlar el ahorro anual") y se retira del todo — columna `initial_capital`
eliminada (migración `drop_initial_capital`, pérdida de datos asumida), fuera
el encadenado de capital entre años y el campo de los modales.

- Las tarjetas del año pasan a ser **Ingresos del año · Ahorro general anual
  (destacada) · Ahorro para viajes · Restante uso diario** — todo sale del
  control mensual.
- El Resumen cambia "capital actual" por **media anual de ahorro**, la tabla
  gana la columna **Ahorro acumulado** (suma corrida) y la gráfica de capital
  pasa a ser la curva de **ahorro acumulado** (`AcumuladoChart`).

### Finanzas por pestañas: Resumen + un tab por año

El módulo de ahorro se reorganiza al patrón de pestañas (como el Panel de
control): **Resumen** (sin `?year` en la URL) + **una pestaña por año**
(`?year=2026`), con scroll horizontal si algún día son muchos.

- **Resumen**: la foto global que antes vivía enterrada al fondo del año,
  promovida y enriquecida — KPIs históricos (capital actual, ahorro total,
  viajes, mejor año), la tabla comparativa (cada año enlaza a su pestaña) y
  la curva de capital acumulado. Solo lectura.
- **Gestión de años centralizada**: crear, editar y eliminar año viven en la
  barra de pestañas (`finanzas-tabs.tsx`, sobre el Modal común), no
  repartidos por el módulo. El tab del año queda para trabajar: control
  mensual, objetivo, extras y viajes.
- Reparto en componentes: `finanzas-tabs` + `resumen-general` +
  `savings-module` (solo el año) con utilidades comunes en `comun.tsx`.
- De regalo, **bug de móvil preexistente arreglado**: las columnas del grid
  interno del año no tenían `min-w-0` y la tabla mensual (560 px de mínimo)
  desbordaba la página entera en vez de scrollear en su contenedor.

### Pipeline de oportunidades v2: de kanban a mini-CRM

El kanban inicial servía para estrenar el módulo, pero no era cómodo en el
tiempo: sin fechas ni memoria, con los cerrados acumulándose en el tablero
para siempre. La v2 le añade el "sistema nervioso" alrededor (migración
`pipeline_seguimiento_e_historial`; ⚠ pendiente de aplicar en producción):

- **Seguimientos**: cada oportunidad tiene *próxima acción* + *fecha de
  seguimiento*. La tarjeta lo muestra como chip con urgencia (rojo vencido,
  ámbar ≤7 días) y el **cron diario de las 8:00 avisa por correo** de los
  seguimientos vencidos (`avisarSeguimientos` en `src/lib/pipeline.ts`),
  con reaviso semanal vía `next_action_notified` — el mismo patrón que el
  mantenimiento. El sistema te persigue a ti, no al revés.
- **Ciclo de cierre**: pasar a Cerrado/Descartado sella `closed_at` y retira
  el seguimiento (ya no hay nada que perseguir); reabrir limpia el cierre y
  desarchiva.
- **Archivado + vista Histórico**: las terminadas se archivan y salen del
  tablero a una tabla con buscador (tarjetas en móvil), desde la que se
  restauran o eliminan. El tablero queda siempre limpio sin perder nada.
- **Historial por tarjeta**: tabla nueva `opportunity_event` (FK real con
  borrado en cascada). Los cambios de estado se apuntan solos y no se pueden
  borrar (trazabilidad del embudo); el timeline del modal admite además
  notas, llamadas, emails y reuniones manuales (estas sí borrables). Añadir
  actividad refresca `update_ts` y sube la tarjeta.
- **Métricas de cabecera**: valor abierto, abiertas, tasa de cierre y días
  medios hasta el cierre (`metricasPipeline`, calculadas también sobre lo
  archivado: la historia cuenta).
- **Drag&drop** nativo entre columnas en escritorio (los ←/→ se quedan) y
  **vista Tabla**: el listado completo (activas y archivadas) por última
  actividad, con seguimiento y acciones por fila — el mismo componente
  `tabla-oportunidades` sirve la Tabla y el Histórico.
- Componentes divididos en
  `dashboard/pipeline/{comun,pipeline-board,oportunidad-modal,tabla-oportunidades}`.

### Pipeline usable en móvil (y bug de layout de raíz)

- **Bug real**: el ancho mínimo del tablero (1040 px) desbordaba el layout
  ENTERO del dashboard en móvil — `body` y el layout son columnas flex y sus
  hijos, sin `min-w-0`, no pueden encoger por debajo de su contenido mínimo.
  Arreglado de raíz con `min-w-0` en la cadena del layout de `/app`
  (inmuniza a cualquier módulo futuro con contenido ancho).
- **El kanban no existe en móvil** (no es cómodo con el pulgar): la vista de
  trabajo ahí es la **Tabla**, cuyas tarjetas cambian de estado con un
  selector directo (las archivadas mantienen el chip: se restauran antes).
  El conmutador ni ofrece "Tablero" en pantallas pequeñas — resuelto con CSS
  puro (`max-md:`), sin líos de hidratación — y los controles se apilan.
  Desde `md`, kanban de 5 columnas como siempre.

### Modal común y popovers en portal

Los cuatro modales del dashboard (ahorro, mantenimiento, invitar usuario,
oportunidades) tenían el mismo defecto: panel con `overflow-y-auto` y
popovers posicionados dentro — el calendario se salía del modal y generaba
scroll. Dos piezas nuevas:

- `src/components/ui/modal.tsx`: **Modal común** con cabecera fija (título +
  botón ✕), cuerpo con scroll propio, pie de acciones siempre visible,
  Escape, clic en el fondo y bloqueo del scroll de la página.
- Los popovers de `fields.tsx` (calendario y select) se renderizan en un
  **portal con `position: fixed`** sobre `<body>`: no los recorta ningún
  contenedor con overflow, se voltean hacia arriba si abajo no caben, se
  recolocan si cambia su alto (ResizeObserver) y se cierran al hacer scroll
  fuera. Escape con popover abierto cierra el popover, no el modal (la tecla
  se frena en captura).

### Backups fuera del VPS (Google Drive)

El cron de las 4:00 sube `~/backups` a Google Drive con `rclone copy` →
`vps-backups/adrianosuna.com` (un subdirectorio por dominio, pensando en
futuros proyectos en el mismo servidor). Cliente OAuth propio (el compartido
de rclone se retira en 2026), scope mínimo `drive.file`, probado de punta a
punta; montaje documentado en `DESPLIEGUE.md`. De paso quedó **publicada la
pantalla de consentimiento OAuth** del proyecto de Google (estaba en
"Prueba": habría bloqueado a cualquier invitado del dashboard y caducado los
tokens de rclone cada 7 días).

### Plantilla con estilos para los correos del panel

Plantilla clara email-safe (tablas + estilos inline: Gmail elimina los
`<style>`; los clientes castigan los fondos oscuros) con logo AO., esmeralda
de acento, tarjetas con borde según gravedad (ámbar vencida / rojo con ≥7
días de retraso), botón al panel y footer común. Centralizada en
`src/lib/correo.ts` (`plantilla`, `tarjetaHtml`, `botonHtml`): cualquier
correo futuro la hereda.

### Contador animado en la landing

Componente `Contador` (`landing/contador.tsx`) en la franja de cifras:
cuenta de 0 al valor al entrar en viewport (una vez, easeOutCubic ~0,9 s).
El servidor renderiza el valor final (SEO y sin-JS ven la cifra real) y con
`prefers-reduced-motion` no se anima.

### Mantenimiento del VPS y adiós al Portfolio antiguo

- **Limpieza del sitio viejo**: eliminados `/var/www/adrianosuna` y
  `/etc/caddy/Caddyfile.old`.
- **Primer backup automático comprobado**: `portfolio-3.sql.gz` de las 4:00
  en `~/backups/` — la rotación del cron funciona.
- **El Portfolio antiguo (Express) ya no existe** y la BD local `ao_test`
  dejó de estar compartida: ahora solo la usa esta app (conserva sus tablas
  y datos). Corregidos docs y comentarios que hablaban de convivencia o
  transición (CLAUDE.md, schema, prisma.config, .env.example). La tabla
  huérfana `migrations` (db-migrate) sigue declarada externa; puede
  eliminarse con `DROP TABLE` cuando se quiera.

### Tests

La suite creció hasta **135 tests en 16 ficheros** con el trabajo del día:
ciclo de cierre/archivado/timeline del pipeline, métricas del embudo, aviso
de seguimientos, Modal común (incluida la regresión del Escape y la del
portal). Además se cazó un test intermitente: el del contador dependía del
`requestAnimationFrame` real de jsdom (se moría de hambre con la suite en
paralelo) — ahora controla los frames a mano y la suite corre ~3 s más rápida.

### Descartes razonados (para no reabrirlos sin motivo)

- **CSP completa con nonces**: sin superficie XSS real (React escapa todo y
  no hay contenido de terceros); la CSP mínima segura ya está puesta.
  Retomar solo si algún día se renderiza contenido ajeno.
- **Rate limit por IP en Caddy**: exigía build custom de Caddy y los
  endpoints de auth ya los protege Google.
- **Monitorización externa (UptimeRobot o similar)**: decisión de proyecto —
  no se quiere monitorizar con servicios externos.

---

## 25/08/2026

### Lanzamiento de adrianosuna.com 🚀

En producción en el VPS de OVH: Docker multi-stage (Next standalone) +
MySQL propio + Caddy con HTTPS automático, GA4 con consentimiento RGPD y
backup diario con rotación. Procedimiento completo en `DESPLIEGUE.md`
(validado en local ese mismo día).

### Panel de control (`/app/panel`, solo admin)

Cuatro pestañas por URL (`?tab=`) dentro de un Suspense con esqueleto:

- **Servidor** (fusión de las antiguas Monitor + Servidor): SSL del dominio,
  latencia pública (fetch al dominio real: la vuelta completa por Caddy),
  MySQL a fondo (ping, versión, uptime del motor, conexiones, tamaño de BD y
  top de tablas), edad del último backup y disco del VPS (carpeta
  `~/backups` montada de solo lectura) y versión desplegada (fecha de build
  horneada en `next.config`) — más recursos EN VIVO con auto-refresco cada
  40 s: CPU, memoria y swap (`/proc/meminfo`, que en Docker es el host),
  disco, proceso Node y sistema.
- **Visitas**: GA4 vía Data API con service account (JWT RS256 firmado a
  mano en `src/lib/ga.ts`, sin SDK; lotes con `batchRunReports`). Rango
  7/30/90 días (`?dias=`), KPIs con comparativa del periodo previo, tiempo
  real (45 s), gráfica diaria con tooltip táctil, conversiones de la landing
  (eventos `clic_*` por delegación `data-ga`), fuentes, canales, páginas
  (rutas internas excluidas), geografía, dispositivos, nuevos/recurrentes,
  mapa horario día×hora (transpuesto en móvil) y caché de 60 s. Higiene:
  GA_ID vacío en dev y filtro de IP interno activado en GA4.
- **Usuarios** (mudada desde `/app/system/users`, ruta eliminada): tarjetas
  en móvil, sin acciones sobre la propia fila del admin, y **sesiones
  activas** (tabla `user_session`, sin FK físico por colaciones distintas
  local/producción): cada login crea una fila que el callback `jwt`
  comprueba en cada petición — borrarla cierra esa sesión remotamente al
  instante; el logout retira la suya y las caducadas se purgan al listar.
  Los JWT antiguos sin registro se invalidan.
- **Mantenimiento**: ver sistema de avisos, abajo.

### Sistema de mantenimiento con avisos por correo

- Tabla `maintenance_task` + pestaña en el Panel (crear/editar/borrar,
  "Hecho" encadena el siguiente vencimiento con recorte a fin de mes, chips
  vencida/esta semana/al día, correo de prueba).
- **Cron interno** (node-cron arrancado por `src/instrumentation.ts`):
  diario a las 8:00 (Madrid) + pasada de arranque; digest de vencidas por
  correo (nodemailer) con reaviso semanal. Sin SMTP configurado queda
  inactivo sin romper. Asuntos con prefijo `[Panel AO]` (filtro de carpeta).
- **SMTP**: Zimbra de OVH con `info@adrianosuna.com` —
  `smtp.mail.ovh.net:465`, usuario = correo completo (endpoints y
  certificado verificados por sondeo). Probado con correo real.
- **5 tareas iniciales** vía migración idempotente (`seed_maintenance_tasks`):
  deps mensual, backups y contenedores mensual, GA/Search Console mensual,
  restauración de backup semestral y dominio anual.

### Pipeline de oportunidades v1

Tabla `opportunity` (migración `add_opportunity`) y kanban de 5 estados
(Contacto → Conversación → Propuesta → Cerrado/Descartado) con
crear/editar/mover/eliminar, enlace en nav e inicio.

### Paleta unificada en todo el sitio

El dashboard abandonó el azul `#1570ef` heredado: los tokens de `:root`
pasan a la esmeralda/teal del Portfolio original (`--primary: #10b981`,
fondo `#0a1512`) y `.pf-public` queda solo con los extras de la landing.
`--primary-foreground` es oscuro (el blanco sobre esmeralda no da AA).
Tema único oscuro: el selector claro/oscuro se retiró.

### Preparación para buscadores de IA (GEO)

robots.txt con los agentes de IA permitidos explícitamente (OpenAI,
Anthropic, Perplexity, Google-Extended, Apple, Meta, Mistral, CCBot...),
`/llms.txt` generado en build desde `content.ts` (nunca se desincroniza),
JSON-LD enriquecido (ProfilePage + proyectos como CreativeWork enlazados por
`@id` a la Person) y meta robots `max-snippet:-1` + `max-image-preview:large`
para citas generativas sin recortes.

### Suite de tests de la lógica crítica (Vitest)

Arrancó con 102 tests, sin BD ni red: fórmulas del ahorro (los viajes no
engordan el capital, encadenado de años), fechas de la experiencia (conteo
inclusivo estilo LinkedIn, reloj congelado), parsers de GA contra API
simulada, fechas del mantenimiento, guardas de TODAS las server actions
(saneado, autoprotecciones del admin, whitelist de estados, contrato
`AppError` vs. "Error inesperado"), callbacks de auth (`authConfig`
exportada para testearlos con mocks), umbrales del monitor (TLS/fs/reloj
simulados), superficies GEO y campos custom de `fields.tsx` (jsdom).

### Re-pasada de Lighthouse/accesibilidad

Contra el build de producción en local: **móvil 93/100/100/100, escritorio
100/100/100/100**. Arreglos: botones de la landing oscurecidos a `#047857`
(el blanco sobre `#059669` daba 3.76:1; WCAG pide 4.5), `aria-label` del
logo contiene su texto visible ("AO."), el hero usa `Reveal inmediata`
(animación CSS pura sin esperar a la hidratación — LCP móvil de 3.6 → 3.1 s
y Speed Index de 3.8 → 2.3 s) y la foto del hero lleva `sizes` (el móvil
bajaba 828 px para pintar 176 px).

### Nav del dashboard rehecho en móvil

Menú de hamburguesa con el usuario dentro del panel (antes se veía roto);
tabla de usuarios como tarjetas en móvil; gráficas con variante compacta,
mapa horario transpuesto y tooltip táctil en la gráfica diaria.

### Descartes del día

- **Módulo de notas/TIL**: no encaja con el flujo de trabajo de Adrián.
- **Redis para sesiones**: se eligió tabla MySQL (una pieza menos que
  operar; la escala no lo justifica).
