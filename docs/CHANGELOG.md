# Changelog

Historial de lo hecho en el proyecto, en orden inverso (lo más reciente
arriba). Funciona en pareja con `TAREAS.md`: allí vive **solo lo pendiente**;
cuando algo se termina, se cuenta aquí con su porqué y desaparece de allí.

---

## 02/09/2026 (auditoría del dashboard con sesión)

### Recorrido completo del dashboard, escritorio y móvil

Con sesión de verdad en el panel Browser (la extensión de Chrome no estaba
conectada, y no hacía falta). axe-core sobre cada ruta, a 974 px y a 375 px,
con datos reales.

**Cinco fallos encontrados y arreglados** — cuatro de accesibilidad y uno de
contenido:

1. **Contraste insuficiente** (serious). `text-muted-foreground/70` daba
   **3,63:1** sobre la tarjeta, por debajo del 4,5 de AA. Medidos los tres
   niveles: `/70` → 3,97 · `/60` → 3,24 · `/50` → 2,62; **sin opacidad, 6,9**.
   Ninguno pasaba, así que se han quitado las **30 ocurrencias** de 14
   ficheros. Se colaba porque el token base sí pasa y la opacidad la aplicaba
   Tailwind aparte.
2. **168 `aria-label` que nadie leía** (serious). El mapa de calor de Visitas
   los pone en `div` sin rol, y ahí `aria-label` está PROHIBIDO por la
   especificación: el lector de pantalla se los salta. La intención estaba en
   el código («168 divs con aria-label son más accesibles que un canvas») pero
   no funcionaba. Con `role="img"` cada celda es un gráfico con descripción:
   336 celdas, «Lunes a las 00:00 — 0 usuarios».
3. **Aviso de novedades fuera de todo landmark** (`region`): su texto quedaba
   inalcanzable navegando por landmarks. Envuelto en un `<aside>` con nombre,
   y el `role="status"` en la franja para que se anuncie al aparecer.
   ⚠ Primero le puse el `role` al `aside` y eso introdujo otro fallo
   (`aria-allowed-role`): el rol implícito de `aside` es `complementary` y no
   admite que se le sobrescriba con uno de live region.
4. **Orden de encabezados roto** (`heading-order`): las tarjetas titulaban con
   `h3` bajo el `h1` de la página, saltándose el `h2`; y el bloque «Cómo
   usarla desde un Atajo» era `h4` bajo un `h2`. Corregidos en `TarjetaTabla`,
   en las tarjetas del panel de finanzas y en la de tokens.
5. El ejemplo de la API en pantalla usaba `"categoria": "Compra"`, que **no
   existe** entre las categorías. Ahora dice `"Supermercado"`, igual que
   `API.md`.

**Lo que salió limpio, con la medida:**

- **Cero violaciones** en las 11 rutas tras los arreglos: inicio, las cuatro
  secciones de Finanzas, las cinco pestañas del Panel (con sus cuatro
  sub-pestañas de Usuarios) y las tres vistas del pipeline.
- **Las tablas, con datos reales**: los 12 importes de movimientos y su
  cabecera terminan **todos en x=764** en escritorio; en móvil, la tabla se
  oculta, la rejilla pinta las 12 filas y los importes quedan a plomo en
  x=302. La columna de acciones ya se anuncia como «Acciones».
- **Sin desborde horizontal** en ninguna ruta, ni a 974 px ni a 375.
- **Ningún campo por debajo de 16 px**, así que iOS no hace zoom al enfocar.

⚠ **Dos trampas del método**, que costaron falsos positivos y quedan
apuntadas:

- **Auditar mientras Next revela el streaming.** El árbol nuevo viaja dentro
  de un `div[hidden]` (`S:0`), así que axe informa de «no hay main» y «no hay
  h1» de una página que sí los tiene. Lo delata
  `document.querySelector("main").closest("[hidden]")`. Forzar una captura
  antes de auditar asienta la página; **un bucle de espera largo en la propia
  página es peor que el problema** — bloquea el hilo y el revelado no llega a
  ejecutarse (dejó la pestaña colgada).
- **Comprobar el foco con `.focus()` por script** dice que no hay anillo
  aunque lo haya: el foco programático no activa `:focus-visible`. Con un Tab
  de verdad el anillo sale.

---

## 02/09/2026 (auditoría de accesibilidad)

### Auditoría completa, escritorio y móvil

Pasada con **axe-core 4.13** sobre las rutas públicas en el navegador real (a
1280 px y a 375 px) y sobre los componentes del dashboard en jsdom, más
medidas a mano de contraste, objetivos táctiles, foco y zoom de iOS.

**Tres fallos encontrados y arreglados:**

1. **`/login` y el 404 no tenían landmark `<main>`** (axe:
   `landmark-one-main` + `region`, 6 nodos). Sin un landmark, un lector de
   pantalla no puede saltar al contenido. Los dos contenedores pasan de `div`
   a `main`.
2. **Diez objetivos táctiles por debajo de 24 px** en la landing (WCAG 2.2 AA,
   2.5.8): los siete enlaces del footer, los dos de cada caso de estudio
   («Probarla en vivo», «Ver el código») y el de la política. Medían 20-21 px
   porque su caja pulsable era justo la del texto; con `py-1` suben a 28-29 sin
   mover nada de sitio (los contenedores usan `gap`).
3. **La columna de acciones dejaba un `<th>` vacío** (axe:
   `empty-table-header`), así que el lector anunciaba una columna sin nombre.
   `Columna` gana `oculta`: la cabecera se llama "Acciones" para quien la
   escucha y sigue sin título para quien la ve. Arreglado en la pieza común y
   en la tabla del pipeline, que tiene marcado propio.

**Lo que salió limpio, con la medida:**

- **Contraste**: los 13 pares de tokens que se usan de verdad, calculados
   sobre el CSS compilado (componiendo los translúcidos sobre su fondo). El
   peor es `--viajes` a **6,03:1**, sobre el 4,5 que pide AA; el mejor, 17,25.
- **axe en las cuatro rutas públicas**, a 1280 y a 375 px: **cero
   violaciones** tras los arreglos.
- **Sin desborde horizontal** a 375 px en ninguna ruta.
- **Zoom de iOS**: ningún campo por debajo de 16 px (es lo que dispara el zoom
   automático al enfocar).
- **Movimiento reducido**: `prefers-reduced-motion` ya se respeta en
   `globals.css`, en el contador y en `Reveal`.
- **Foco visible**: anillo global de 2 px en `--primary`. ⚠ Aquí me equivoqué
   primero: una comprobación con `.focus()` por script dijo que 26 elementos no
   tenían anillo, y era **falso** — el foco por script no activa
   `:focus-visible`. Con un Tab de verdad el anillo sale
   (`solid 2px rgb(16,185,129)`). Queda apuntado porque el error es fácil de
   repetir.
- **Sin imágenes sin `alt`, sin ids duplicados**, `lang="es"` en el html y el
   primer tabulable es «Saltar al contenido».

**Nuevo `tests/auditoria-a11y.dom.test.tsx`** (8 casos): axe sobre la tabla
común con datos y vacía, la rejilla móvil, el histórico de accesos, y las
comprobaciones que no son de axe — que los `th` llevan `scope`, que la
cabecera de la rejilla va `aria-hidden` (es visual, no una tabla semántica) y
que la foto de perfil va con `alt` vacío por ser decorativa.

⚠ **Lo que esta auditoría NO cubre**: el dashboard **pulsado a mano**. Vive
detrás del OAuth de Google y Claude in Chrome no estaba conectado, así que sus
pantallas se auditaron por componente (jsdom + axe) y por lectura de código,
no clicando. Lo que sí se comprueba de extremo a extremo son las invariantes
de los e2e (24 tests).

---

## 02/09/2026 (fuera los gestos)

### Retirados los gestos táctiles de toda la plataforma

A petición de Adrián. Se van los dos componentes y sus usos:

- **`FilaDeslizable`** — el swipe de la lista de movimientos (→ editar,
  ← eliminar). Editar y borrar salen ahora del menú «⋯» de la fila, que es el
  único camino y ya llevaba las tres acciones, así que no se pierde nada: lo
  que había era un atajo, no la única puerta.
- **`PullToRefresh`** — el tirón para recargar del dashboard. En el navegador
  esto lo da el sistema; en la PWA instalada queda el botón de recargar de la
  pestaña Servidor y la propia navegación.

Con ellos desaparece todo el manejo de `onTouchStart` / `onTouchMove` del
proyecto: no queda ningún gesto táctil (comprobado con un grep). La rejilla
móvil de las tablas **se queda**: nació para convivir con el swipe, pero se
sostiene por sí sola — en 375 px un `<table>` obligaría a desplazarse en
horizontal para ver el importe, y la rejilla reparte las cuatro columnas en el
ancho que hay.

⚠ Lo que NO se ha tocado: el **drag & drop del kanban** del pipeline. Es de
ratón, es de escritorio (en móvil el tablero no existe) y tiene los botones
←/→ al lado. Si también sobra, se retira en un minuto.

---

## 02/09/2026 (tablas unificadas)

### Todas las tablas iguales, con la del Ahorro como referencia

Nuevo `src/components/ui/tabla.tsx`. Las clases de `th` y `td` estaban
copiadas en **cuatro ficheros con TRES variantes** de padding (`py-1.5`,
`py-2`, `py-2.5` y una responsive), y encima sesiones, accesos y los tokens
de la API se pintaban como **`div` apilados** aunque son tabulares: parecidas
de lejos y distintas de cerca, que es lo que se nota al abrir dos pestañas
seguidas.

Ahora todo sale de la misma pieza, con la estructura de la tabla del
**Control mensual** de Ahorro: cabecera en versalitas apagadas, separador por
fila, celdas compactas y scroll horizontal propio.

- **Convertidas a tabla de verdad** (eran listas de `div`): los tokens de la
  API —la que peor estaba, y la más reciente—, las sesiones activas y el
  histórico de accesos. Ganan columnas con nombre en vez de una línea de
  texto con puntos de separación: `Nombre · Token · Creado · Último uso`,
  `Usuario · Dispositivo · Inicio · Última actividad`.
- **Unificadas las cinco que ya eran tablas**: Control mensual, Resumen
  histórico, Usuarios, Gastos (vista año) y la tabla del pipeline. Con eso
  desaparecen las cuatro copias de clases.
- **La lista de movimientos del mes**, que es la más usada del dashboard y la
  que peor quedaba: era una fila de `span` con la fecha, el concepto, un punto
  de color y el importe apretados en un flex, sin cabecera ni columnas. Ahora
  en escritorio es la tabla común (`Fecha · Concepto · Categoría · Importe`,
  con los importes alineados a la derecha en su columna) y **en móvil la misma
  estética** con una rejilla (`CabeceraMovil` + `FilaMovil`): cabecera en
  versalitas, separador por fila e importes a plomo — medido a 375 px, los
  cuatro terminan en el mismo píxel que la cabecera. La rejilla existe porque
  la fila lleva **gesto de swipe** y un `<tr>` no se puede arrastrar con el
  dedo. En móvil van cuatro columnas y no cinco: la categoría no cabe, así que
  su punto de color viaja pegado al concepto.
  El formulario de edición y las acciones de fila se extrajeron a
  `formularioEdicion(m)` y `accionesDe(m)`: los usan las dos vistas, y al
  partirlas los había duplicado — seis campos y tres acciones por duplicado
  es justo como se queda una sin el cambio de la otra.
- **El menú «⋯» se veía transparente en móvil.** Llevaba `bg-card`, y las
  tarjetas del proyecto son translúcidas a propósito (`--card` es un blanco al
  4 %): sobre una lista, el panel dejaba leer las filas de debajo. Ahora usa
  `bg-popover`, el token opaco que ya usaban el modal y los popovers de
  `fields.tsx` — el proyecto tenía el token bueno y yo puse el otro.
- El aviso de "aquí no hay nada" pasa a ser una **fila dentro de la tabla**,
  no un párrafo al lado: así la cabecera sigue enseñando qué columnas tendrá
  cuando haya datos.

Un cambio de comportamiento a cambio de la consistencia: la tabla del año de
Gastos tenía el padding y el texto apretados en móvil para que sus cuatro
columnas cupieran en 375 px sin scroll. Se ha retirado — en pantalla estrecha
ahora se desplaza, que es lo que ya hacía la del Ahorro.

---

## 02/09/2026 (validación, límites y recordatorios)

### Validación con Zod en TODAS las server actions

Nueva dependencia (`zod`) y un módulo nuevo: **`src/lib/esquemas.ts`**, donde
vive ahora la validación de todo lo que entra por una action o por la API.
Antes cada una traía su propia tanda de comprobaciones a mano
(`Number.isFinite`, `.trim().slice(255)`, un regex de fecha, un `includes`
para el enum), repetida de fichero en fichero con variaciones — y así es como
los topes se van separando de las columnas de la BD: cuando eso pasa, el fallo
llega como el "Error inesperado" genérico en vez de un mensaje que se entienda.

Ahora los límites son los de las columnas y se declaran una vez. Los mensajes
van en español y **dicen qué pasa** («El importe no puede ser negativo» en vez
de «Importe no válido»), porque viajan tal cual al aviso del cliente; los tests
que fijaban el texto viejo se actualizaron.

Migradas las **60 actions** de los cuatro módulos, y también
`alta-movimiento.ts` y `alta-nota.ts`, que es lo que hace que **la API v1 gane
la misma validación sin escribir nada aparte** — eran ya el punto compartido.

**Dos trampas de Zod costaron un fallo real cada una**, las dos con test propio
para que un refactor no las reintroduzca:

1. `z.coerce.number()` dentro de un `union` con `z.null()` **convierte `null`
   en 0** (`Number(null) === 0`, y la unión prueba las opciones en orden). En
   el control mensual del ahorro eso escribe un cero donde el mes estaba SIN
   RELLENAR — que es justo lo que el módulo distingue para avisar por correo.
   Se detectó probando los esquemas en caliente antes de enchufarlos.
2. Un campo con `.transform()` **sigue siendo obligatorio**: omitir la clave
   falla con "expected nonoptional". Hay que marcarlo `.nullish()` antes.

Y una decisión que se tomó a la baja: el identificador **no valida el formato
canónico de un uuid**. Prisma parametriza, así que un id con mala pinta no
inyecta nada —en el peor caso no encuentra fila—, la BD heredada mezcla uuids
v1 y v4, y exigirlo obligaba a reescribir 255 fixtures de los tests a cambio de
nada. Lo que sí se comprueba es el vacío, el null y las cadenas absurdas. Donde
el id viene de fuera de verdad —la API— lo que se verifica es que la fila
**exista**, que es la garantía que importa.

### Rate limiting

`src/lib/rate-limit.ts`: ventana **deslizante** en memoria, con tope en tres
sitios — la API v1 (por token, y por IP los intentos que no entran), el login
(`/api/auth/*`) y las escrituras del dashboard (por usuario).

⚠ Esto **no reabre el descarte del 28/08**: lo que se descartó fue el rate
limit *en Caddy*, porque exigía compilar un Caddy propio. Esto va en la
aplicación y no necesita nada instalado.

Decisiones que conviene recordar:

- **En memoria, sin Redis**, porque el despliegue es un solo contenedor y ahí
  un contador en memoria ve todas las peticiones — la condición que hace válida
  la técnica. Con dos réplicas el límite efectivo se duplicaría; entonces, y
  solo entonces, tocaría Redis.
- **Ventana deslizante y no por bloques**: con bloques se cuelan `2 × max`
  peticiones a caballo entre dos, que es el fallo clásico. Hay test.
- El límite del **login no es contra la fuerza bruta** (no hay contraseña que
  probar: es OAuth de Google); es contra el machaque de `/api/auth/*`, que en
  cada intento consulta la allowlist y escribe en `user_session` y
  `login_event`.
- Las cifras están puestas para que **no las note un uso normal**: 30 logins,
  60 llamadas de API y 120 escrituras por minuto. Un frenazo sale como `429`
  con `Retry-After` (o como aviso «Vas muy rápido» en una action) y se registra
  a nivel `warn` con la clave, que es lo único que distingue un bucle propio de
  un tercero.

**El e2e encontró un agujero de esto mismo**: con la base de datos caída, el
freno no se aplicaba —la rama `indisponible` salía antes— y cada intento se
come el tope de 5 s de la autenticación. Es decir: una caída de la BD
convertía la API en barra libre, y justo cuando atender sale más caro. Ahora el
**503 cuenta también** para el tope estrecho por IP.

### Recordatorios puntuales («renovar el dominio»)

Migración `recordatorios_puntuales`: `maintenance_task.interval_months` pasa a
admitir NULL, y **null significa "no se repite"**. Una tarea así es un
recordatorio suelto: al marcarla como hecha se queda hecha en vez de encadenar
el siguiente vencimiento (`lastDone` puesto, `nextDue` sin mover — no se borra,
para que quede el rastro de cuándo se hizo).

Se reutiliza el **módulo de Mantenimiento** en vez de crear una tabla y una
pantalla nuevas, por el mismo motivo por el que la ITV y las dependencias ya
comparten módulo: es el mismo problema —algo con fecha de lo que hay que
acordarse— y una tabla aparte obligaría a duplicar el calendario, los avisos
del cron, los ámbitos y la interfaz. En el formulario aparece **Repetición:
«Se repite» / «Una vez»**, y con "Una vez" el campo de los meses desaparece.
En la lista su periodicidad se lee **«Una vez»**.

Se ofreció sacarlo a una sección propia y **Adrián confirmó dejarlo en
Mantenimiento**: queda cerrado, no es un pendiente.

En el calendario a 12 meses sale **una sola vez**, en su mes; si ya se pasó,
en el mes en curso marcado como atrasado; y si cae fuera de la ventana, no
aparece. Los tres casos con test.

---

## 02/09/2026 (repaso final)

### Correcciones de interfaz

- **Retirada la densidad compacta.** El conmutador «Densidad» del menú de
  perfil y sus reglas de CSS ya no están: apretar las filas de todas las tablas
  ahorraba unos píxeles y estropeaba el aspecto, que es un mal cambio. Con él se
  va la clase `fila-lista`, que solo existía para que la densidad alcanzara a
  las listas que no son `<table>`. `vista-preferencias.tsx` se queda solo con
  el aviso de novedades.
- **Acciones de fila en un menú, en móvil** (`components/dashboard/menu-acciones.tsx`).
  Con tres o cuatro iconos por fila, en 375 px se comían el ancho: empujaban el
  concepto y el importe y quedaban tan juntos que se pulsaba el de al lado.
  Ahora las acciones **se declaran** y el componente decide cómo pintarlas —
  iconos en línea en escritorio, un «⋯» con menú en móvil—, así que hay una
  sola definición por fila y no dos maquetaciones. **Medido** a 375 px en la
  lista de movimientos: el concepto pasa de 105 a **177 px** de ancho útil
  (+69 %) y el bloque de acciones baja de 106 a 34.
  En el menú las acciones salen **por su nombre**, no por su icono: en móvil no
  hay `title` que enseñar al pasar el dedo, así que un icono suelto es una
  adivinanza. Y una acción apagada **explica el motivo** ahí mismo (por ejemplo,
  por qué no se puede borrar una categoría en uso), que en un icono solo cabía
  en un `title` invisible.
  Aplicado donde de verdad se acumulaban: movimientos de Gastos, categorías y
  recurrentes de Ajustes, tabla e histórico del pipeline, cuentas de Usuarios y
  tareas de Mantenimiento. **No** donde hay una o dos acciones (notas, sesiones,
  tokens, aportaciones del ahorro): esconder dos iconos detrás de un menú son
  dos toques donde había uno, y por eso el umbral es un parámetro (`desde`).
  Dos decisiones que se ven en el código: el chevron de un recurrente y el botón
  «Hecha» de una tarea **se quedan fuera** del menú — el primero es un
  despliegue, no una acción, y el segundo es LA acción de su tarjeta.
  El popover se reutiliza de `ui/fields.tsx` (portal con posición fija, ahora
  exportado): no lo recorta ninguna tabla con overflow ni el cuerpo de un modal,
  y hereda el cierre con Escape, con clic fuera y al hacer scroll.
  De paso, las acciones de la tabla de usuarios ganan **nombre accesible**: solo
  tenían `title`, que un lector de pantalla usa como último recurso y un móvil
  no enseña nunca.
- **Recuperado el favicon de la pestaña.** Se perdió el 02/09 al añadir las
  splash de iOS: **declarar `metadata.icons` hace que Next deje de inyectar los
  iconos por convención de fichero** (`app/icon.svg`, `app/apple-icon.tsx`), y
  el `<link rel="icon">` desapareció sin ningún aviso. Ahora los tres van
  explícitos (`icon`, `apple`, `other`) y queda escrito en el propio fichero
  para que no vuelva a pasar.

### Y dos de herramientas, que salieron de un «no me carga»

- **El dev server ya no se muere al construir.** `pnpm build` y `pnpm dev`
  comparten `.next`, así que construir con el dev server levantado lo mataba —
  y con nada escuchando en el 9444, lo siguiente que falla es todo lo que
  apunta ahí: el navegador, el móvil en la red local o la extensión de vista
  responsive. Ahora `distDir` sale de `NEXT_DIST_DIR`, los **e2e construyen en
  `.next-aparte`** por su cuenta y hay `pnpm build:aislado` para un build a
  mano sin cortar nada. `pnpm build` se queda en `.next`: es lo que esperan el
  CI y el Dockerfile.
  Dos remates de Windows por el camino: las variables van por `env` y no como
  `VAR=valor comando` —los scripts de pnpm corren en cmd, donde eso no existe,
  y así estaba **roto el `pnpm analyze`** que se añadió ese mismo día—, y la
  carpeta alternativa es **una sola**, porque `next build` añade dos entradas a
  `tsconfig.json` por cada nombre nuevo que ve. `.next-*` también se ignora en
  ESLint: sin eso, entraba a analizar el código generado (33 000 avisos).
- **Next ya no escribe en `CLAUDE.md`** (`agentRules: false`). La 16.3.4 —la
  versión a la que se subió hoy— añade un bloque propio al final del fichero
  en cada `next dev`. `CLAUDE.md` se mantiene a mano, en español y versionado:
  una herramienta que lo reescribe sola ensucia el diff en cada arranque.
  Comprobado con el hash del fichero antes y después de reiniciar: idéntico.
- **En desarrollo la CSP ya no bloquea.** Va como
  `Content-Security-Policy-Report-Only` y no se manda `X-Frame-Options` ni
  `frame-ancestors`. `XFO: DENY` + `frame-ancestors 'none'` + el `frame-src
  'none'` nuevo impiden cargar la página dentro de un **iframe**, que es cómo
  funcionan las extensiones de vista responsive; en local esas cabeceras no
  protegen de nada. Report-only y no "fuera del todo" para conservar lo que sí
  aportaban en dev: que una violación real se vea aquí y no en producción.
  Comprobado: en el 9444 la página **ya se carga en un iframe**, y los e2e
  siguen verificando la versión aplicada contra un build de producción.

---
## 02/09/2026 (cierre del día)

### API propia para los Atajos de iOS, y el bloque de plataforma

Catorce puntos: la API que se pidió («quiero usar atajos de iOS») y trece de
endurecimiento, operación y calidad. Una migración nueva (`api_tokens`), tres
dependencias de desarrollo y **tres variables de entorno opcionales**
(`LOG_LEVEL`, `SESION_DIAS`, `SESION_INACTIVIDAD_HORAS`).

#### API v1 (`/api/v1/*`) — el motivo de todo esto

Cuatro endpoints para apuntar cosas **sin abrir el navegador**: `POST
/movimientos`, `POST /notas`, `GET /resumen` y `GET /categorias`. Documentación
y receta del Atajo en `docs/API.md`.

- **Tokens Bearer** (`lib/api-token.ts` + tabla `api_token`), gestionados en la
  nueva sub-pestaña **Panel → Usuarios → API**. Se guarda **solo el SHA-256**,
  nunca el token: por eso el valor se muestra UNA vez y, si se pierde, se revoca
  y se crea otro. SHA-256 a secas y no bcrypt a propósito — un token son 256
  bits aleatorios, no una contraseña adivinable, y el hash se comprueba en cada
  petición. Un token solo vale mientras su cuenta esté **activa y admin**:
  deshabilitarla los invalida al instante, igual que su sesión del navegador.
- **La validación es COMPARTIDA con el dashboard** (`lib/alta-movimiento.ts`,
  `lib/alta-nota.ts`): `createGasto` y `createNote` ahora llaman a las mismas
  rutinas que la API. Es lo único que evita que dos puertas al mismo dato se
  separen — el día que cambie el tope del importe o el saneado del HTML, cambia
  en un sitio porque es un sitio. De paso salió un fallo latente: el alta NO
  comprobaba que la categoría existiera, y como el FK es `SET NULL`, un uuid
  inventado se guardaba **sin categoría en silencio**. Ahora se rechaza, y
  también si la categoría es del tipo contrario.
- **Detalles pensados para un Atajo, no para un cliente HTTP**: el importe
  acepta `"12,50"` con coma decimal (es lo que manda iOS); la `categoria` se
  puede dar **por nombre** —sin tildes ni mayúsculas— porque teclear un uuid en
  un Atajo no es realista; `tipo` cae a "gasto" y `fecha` a hoy; no se mira el
  `Content-Type` (los Atajos lo ponen mal); y cada escritura devuelve un
  `mensaje` ya redactado para que Siri lo lea en voz alta.
- **Sin CORS a propósito**: la consumen Atajos y scripts, no páginas de
  terceros. Sin `Access-Control-Allow-Origin`, una web ajena no puede leer la
  respuesta aunque tuviera el token.

#### Sesiones

- **«Cerrar todas las sesiones»** en la pestaña Sesiones: el botón de pánico
  para un portátil perdido o un navegador ajeno. **La propia se excluye** —
  cerrarla también dejaría al admin fuera de la pantalla desde la que acaba de
  pulsar, sin poder comprobar el resultado. Solo aparece si hay algo que cerrar.
- **Caducidad más granular** (`lib/sesion-caducidad.ts`). Antes había UN plazo:
  el JWT vivía 7 días y punto, que deja fuera justo el caso que importa (una
  sesión olvidada, porque los 7 días corren igual la uses o no). Ahora hay dos:
  el **tope absoluto** (`SESION_DIAS`, 7) y el **cierre por inactividad**
  (`SESION_INACTIVIDAD_HORAS`, **48 por defecto** — es un cambio de
  comportamiento, y se asume porque con Google volver a entrar son dos clics).
  Al pasarse de inactividad se **borra la fila**, no solo se rechaza el token:
  si no, seguiría figurando como activa en el Panel para siempre. La política
  vigente se enseña en la propia pestaña.

#### Seguridad y plataforma

- **CSP ampliada** (`next.config.ts`). Era mínima (`object-src`, `base-uri`,
  `frame-ancestors`) porque una completa con `script-src` pedía nonces, que
  están descartados. Ahora fija el **origen de cada tipo de recurso**:
  `default-src 'self'`, `script-src` (con GTM), `style-src`, `img-src`,
  `font-src`, `connect-src`, `worker-src`, `manifest-src`, `frame-src 'none'` y
  `form-action 'self'`. `script-src` sigue con `'unsafe-inline'` —Next hidrata
  con scripts en línea— pero lo que se gana es lo que remata casi cualquier XSS:
  **la exfiltración a un servidor ajeno**, que ahora la bloquea `connect-src`.
  En desarrollo se afloja lo justo (`'unsafe-eval'` y el websocket del HMR), o
  la CSP de producción rompería el dev server y se descubriría tarde.
  HSTS revisado: se queda **sin `preload`** a propósito (entrar es fácil, salir
  tarda meses, y afectaría a cualquier subdominio futuro sin HTTPS).
- **Healthcheck y readiness**: `/api/health` (vivo, sin tocar la BD) y
  `/api/ready` (`SELECT 1` con tope de 3 s, **503** si la BD no contesta). Son
  dos preguntas distintas y mezclarlas tiene consecuencias: el healthcheck de
  Docker apunta a `/api/health` —antes a `/robots.txt`— porque uno que
  comprobara la BD **reiniciaría `web` cada vez que la BD tarda en arrancar**,
  que es el bucle que se quiere evitar. Los dos son públicos y por eso solo
  dicen sí o no: ni el error, ni la versión, ni cuánto tardó.
- **Logs estructurados** (`lib/log.ts`): cuatro niveles (`debug` < `info` <
  `warn` < `error`) con el suelo en `LOG_LEVEL`. En producción, **una línea JSON
  por evento** (`docker compose logs web | jq 'select(.nivel=="error")'`); en
  desarrollo, el formato corto de siempre. Migrados los ~45 `console.log` /
  `console.error` con prefijo a mano que había repartidos, y los recuentos del
  cron pasan a ser **campos** en vez de texto ("cuántos" sin parsear la frase).
  Un `Error` se serializa con nombre y mensaje —`JSON.stringify` lo deja en
  `{}`— y la traza solo fuera de producción. Los componentes de cliente se
  quedan en `console`: el navegador es donde se miran.
- **`mariadb` a 3.4.7** (override en `pnpm-workspace.yaml`), que cierra los
  cuatro avisos que quedaban abiertos. Lo que lo desbloqueó: el parche salió en
  la **misma minor** que el pin exacto del adapter (3.4.5), no en el 3.5.1 que
  se temía — un patch, no un salto de versión que Prisma no ha probado. Y
  `mysql2` a >=3.22.0 (llega vía el CLI de Prisma), **verificado ejercitando la
  BD de verdad** (`migrate status` y `migrate diff`, que es lo que usa mysql2).
  `pnpm audit` queda **en cero**. Subidas también `next` 16.3.4,
  `lucide-react`, `nodemailer`, `tsx` y `shadcn`; los mayores (eslint 10,
  TypeScript 7, @types/node 26, Prisma 8 RC) se quedan: son migraciones
  deliberadas, no un `pnpm up`.
- **Índice `idx_opportunity_updated`** en `opportunity.update_ts`, con
  `EXPLAIN` delante: la tabla y el histórico se ordenan por última actividad y
  salía `type: ALL` + `Using filesort`. Los otros dos que se pidieron **no se
  ponen, y por evidencia**: `concept LIKE '%x%'` no puede usar un índice BTREE
  (`key: null`), y `expense_date` ya resuelve por `idx_expense_date`.

#### Calidad

- **Tests e2e (Playwright)**, en `e2e/`, contra un build de **producción**. No
  cubren los flujos autenticados —meter un navegador por el OAuth de Google con
  su captcha no es un test, es una fuente de falsos rojos— sino **las
  invariantes que se ven desde fuera**, que son justo lo que los unitarios no
  pueden afirmar porque ahí `auth()` está mockeado: que ninguna ruta del
  dashboard suelte contenido sin sesión, que la API rechace sin token, que las
  cabeceras estén puestas y que la salud responda. 23 tests.
  **Y encontraron dos cosas reales**: (1) con la BD caída la API devolvía **500**
  en vez de un 503 —`identificar()` ahora distingue "token inválido" de "no he
  podido comprobarlo", porque un 401 le diría a su dueño que revoque el token y
  cree otro, y el nuevo tampoco funcionaría—; y (2) esa misma petición se
  quedaba **20 segundos** colgada esperando al pool de Prisma, así que la
  autenticación lleva tope de 5 s (un Atajo que no responde ya ha fallado para
  quien lo pulsó). De paso quedó documentado que Next resuelve el redirect de
  `/app/panel` con un 200 + `NEXT_REDIRECT` en el payload, no con un 307:
  viaja el `<title>` de la página (metadata) y **ningún dato**, y el test lo
  comprueba marcador por marcador.
- **Auditoría axe** (`tests/accesibilidad.dom.test.tsx`): axe-core sobre el
  modal común, los campos de `fields.tsx` y las sub-pestañas. Se auditan los
  **cimientos** y no cada pantalla porque un fallo de rol o de nombre accesible
  está casi siempre en la pieza reutilizada, y probarla una vez cubre las veinte
  que la montan. Sin violaciones. `color-contrast` va desactivada —jsdom no
  calcula estilos, así que no es evaluable— y el contraste ya se midió a mano en
  el navegador (de ahí salió el blanco sobre `--danger`, 2,77:1, corregido).
  `region` también, que es una regla de página y aquí se audita un fragmento.
- **Paginación de verdad en las listas largas.** La búsqueda de movimientos
  devolvía las 200 primeras coincidencias y avisaba de que había recortado: con
  un histórico de años, "los primeros 200 de 1.340" deja el resto
  **inalcanzable**. Ahora pagina de 50 en el servidor (`skip`/`take`, `?p=`),
  con las sumas seguidas calculándose sobre TODAS las coincidencias, que es el
  dato que se venía a ver. La tabla del pipeline pinta de 50 en 50 con «Ver
  más»: ahí el filtro es de cliente (busca en seis campos), así que paginar en
  el servidor rompería la búsqueda — lo que se recorta es lo que se PINTA.
- **Más Suspense** (`components/dashboard/esqueletos.tsx`): finanzas y pipeline
  bloqueaban la página entera hasta la última consulta. Ahora el título y la
  navegación salen al instante y solo el bloque de datos espera, con esqueleto
  por forma de vista (panel, lista, tarjetas, tablero). Los esqueletos viven en
  un módulo común porque el del Panel ya estaba copiado.
- **Analizador de bundle**: `pnpm analyze` (`@next/bundle-analyzer` tras
  `ANALYZE=1`, apagado en el build normal para no abrir tres pestañas en cada
  `pnpm build`).
- **CI en dos jobs**: `verificar` (lint + tsc + test + build, más un
  `pnpm audit` **informativo** que no rompe el CI — un aviso en una transitiva
  que aún no se puede subir no debe bloquear un despliegue) y `e2e` aparte,
  porque necesita navegador y build de producción; solo corre si `verificar`
  pasa, y sube el informe de Playwright si falla.

#### Lo que NO se hizo, y por qué

- **Límites y sanitizado de subidas**: el proyecto **no tiene subidas de
  ficheros** en ninguna parte (se comprobó). No hay formulario, ni endpoint, ni
  almacenamiento. Escribir límites para algo que no existe sería código muerto
  que envejece; queda para cuando se añadan adjuntos de verdad — y entonces el
  sitio natural es el mismo patrón del tope de 8 KB de la API.

---

## 02/09/2026 (noche)

### Móvil y PWA: push, offline, gestos y los remates de iPhone

Nueve del bloque «Móvil / PWA» de `SUGERENCIAS.md`. Una migración nueva
(`notificaciones_push`), una dependencia (`web-push`) y **dos variables de
entorno opcionales**.

- **Notificaciones push web** — `lib/push.ts` + `push-actions.ts` + tabla
  `push_subscription` + el service worker. Es el mismo aviso que ya manda el
  cron por correo, pero llegando al móvil en el momento; el correo se sigue
  enviando (son dos canales, y el correo es el que queda como registro). Una
  fila por **NAVEGADOR**, no por usuario: el iPhone y el portátil son dos
  suscripciones con su endpoint y sus claves. Se limpian solas — cuando el
  servicio de push responde 404/410 (permiso revocado, app desinstalada) la fila
  se retira en el propio envío. Los avisos van **agrupados en una sola
  notificación**: una por aviso sería un carrusel de tres cada mañana.
  Degrada como GA y el SMTP: **sin claves VAPID no hace nada** y el interruptor
  lo dice en vez de fallar. ⚠ En iPhone el push exige la app **instalada** en la
  pantalla de inicio (iOS 16.4+); en Safari a pelo el navegador ni ofrece el
  permiso, y el interruptor lo explica.
- **Vista offline** — `public/sw.js` + `/offline`. Si una navegación falla por
  falta de red se sirve una pantalla propia en vez del error del navegador (que
  en una app instalada es una pantalla en blanco, peor). **No cachea las páginas
  del dashboard a propósito**: son datos personales que cambian a cada rato, y
  servir una versión vieja sería peor que decir "sin conexión". El service worker
  son 60 líneas en `/public` y no un plugin (next-pwa y compañía): así no hay una
  capa de build que envejezca sola.
- **Shortcuts del manifest** — «Nuevo gasto», «Gastos del mes» y «Nueva nota» en
  el menú del icono. El primero abre el alta al entrar (`/app?nuevo=gasto`, que
  el inicio entiende). ⚠ Safari en iOS **no los implementa**: se declaran porque
  son gratis, valen en Android y escritorio, y el día que los soporte ya están.
- **Splash screens de iOS** — `lib/splash.ts` + `/splash/[dim]`. Sin ellas,
  abrir la app instalada enseña un fogonazo blanco. iOS exige una imagen POR
  TAMAÑO de pantalla con su media query; se generan en runtime con ImageResponse
  (como el `apple-icon`) en vez de commitear 13 PNG, y la ruta tiene
  **allowlist** para que una URL inventada no pida una imagen de 20 000 px.
- **Safe-area / notch** — `viewport-fit=cover` más las clases `.safe-*`. Ahora
  la página llega a los bordes físicos como una app, y la barra superior, el
  contenido y el menú móvil se apartan del notch, de la isla dinámica y de la
  barra de gestos. Los `env()` valen 0 donde no hay recortes, así que en
  escritorio no cambia nada.
- **Pull-to-refresh** — En el navegador esto lo da el sistema, pero una PWA
  instalada no tiene barra ni gesto de recarga: si un dato se queda viejo no hay
  forma de pedirlo otra vez. Llama a `router.refresh()` (no recarga la página,
  no se pierde el estado). Para no pelearse con el scroll: solo arranca con la
  página **arriba del todo** y con el dedo claramente en vertical.
- **Gestos** — `FilaDeslizable` en la lista de movimientos: → editar,
  ← eliminar. Se permite **borrar por gesto ahí precisamente porque tiene
  deshacer**; donde no hay marcha atrás (categorías, años) no se pone gesto, se
  pregunta. Solo entra en modo gesto si el dedo va horizontal, así el scroll
  vertical y el pull-to-refresh nunca se secuestran.
- **Zoom de iOS** — El **editor de notas** tenía 14 px y iOS hace zoom al
  enfocar un `contentEditable` por debajo de 16, dejando la página descuadrada.
  Ahora el editor es de 16 px en móvil; las tarjetas (solo lectura) se quedan en
  14, que ahí no hay riesgo. El resto de campos ya estaba con `text-base sm:text-sm`.
- **Auditoría de tamaños táctiles** — barrido de TODAS las vistas, no solo las
  nuevas. Cuatro interactivos por debajo del criterio: las flechas de mes del
  calendario (28→36), el conmutador de vista del pipeline (28→40), «Cerrar
  sesión» de la lista de sesiones (26→40) y el enlace de Visitas (26→40). Los
  chips que son `<span>`/`<p>` no se tocan: no se pulsan.

**Tests**: 379 (7 nuevos) para la tabla de splashes, que es de las cosas que
**fallan en silencio**: si una media query no cuadra con ningún dispositivo, iOS
simplemente no pinta la imagen y no hay error que lo delate. Se comprueba que el
tamaño físico es el lógico por la densidad, que no hay medias repetidas y que
cada `<link>` apunta a un tamaño de la allowlist de la ruta.

## 02/09/2026 (tarde)

### Productividad transversal: deshacer, búsqueda global, atajos y preferencias

Las diez sugerencias del bloque «Productividad transversal». Comparten tres
piezas nuevas, que es lo que hace que no sean diez parches sueltos:

- **`lib/preferencias.ts`** — preferencias de INTERFAZ en el navegador. ⚠ No
  resucita los ajustes por usuario en BD que se retiraron el 31/08 (columna
  `user.prefs` incluida): aquí solo viven comodidades de la vista (densidad,
  accesos fijados, confirmaciones silenciadas, versión ya vista), que son de
  ESE dispositivo y no cambian datos ni permisos. Se lee con
  `useSyncExternalStore` y no con un efecto **a propósito**: leer localStorage
  en un `useEffect` obliga a un `setState` síncrono dentro del efecto, que es
  justo lo que prohíbe el React Compiler. De paso se sincroniza entre pestañas.
- **`dashboard/confirmar.tsx`** — un solo diálogo de confirmación para todo el
  dashboard, pedido con una promesa (`await confirmar({...})`). Sustituye a los
  **seis confirmadores de dos pasos** que cada lista se había montado por su
  cuenta, con aspecto distinto en cada una.
- **`dashboard/deshacer.ts`** — borrado con marcha atrás.

Y luego, una por una:

- **Deshacer tras borrar** (movimientos, notas y oportunidades). Ya no
  preguntan: borran y el aviso ofrece «Deshacer» 8 s. El motivo es que un
  «¿seguro?» no evita el error —se pulsa «Sí» por inercia— y sí cobra peaje en
  cada borrado legítimo. Las tres acciones devuelven un **paquete de
  restauración** y vuelven con **su uuid original** (no un duplicado); la
  oportunidad se restaura **con su historial**, porque el FK de
  `opportunity_event` es CASCADE y devolver la ficha sin timeline sería peor que
  no ofrecer deshacer. Restaurar dos veces (doble clic) no duplica nada.
- **Confirmaciones con «no volver a preguntar»**: lo que NO se puede devolver
  entero sigue preguntando (categorías, recurrentes, mantenimiento, sesiones),
  pero con casilla para silenciar esa acción concreta. Dos se preguntan
  **siempre**, sin casilla: eliminar un usuario y borrar un año de ahorro. Y
  como silenciar algo sin poder recuperarlo es una trampa, el menú de perfil
  ofrece «Volver a preguntar al eliminar» — solo si hay algo silenciado.
- **Búsqueda global unificada** (`buscar-actions.ts` + `lib/buscar.ts`): la
  paleta ⌘K busca ahora en movimientos (concepto y nota), oportunidades (título,
  empresa, contacto y notas) y notas (título y contenido), con freno de 250 ms.
  El "buscando" se **deriva** comparando la consulta con la de los resultados,
  para no meter otro estado (y otro setState en un efecto). ⚠ Los tipos y las
  constantes viven en `lib/buscar.ts` porque un módulo `'use server'` **solo
  puede exportar funciones async**: tenerlos dentro dejaba al módulo sin exports
  y el build fallaba.
- **Más acciones en ⌘K**: «Nueva nota» y «Nueva oportunidad» (que abren el
  formulario en su página vía `?nueva=1`), «Atajos de teclado», y un mes escrito
  a mano — «marzo», «mar», «marzo 2025», «2026-03» — abre sus gastos
  (`mesEscrito`, función pura y probada: con menos de tres letras NO adivina,
  porque «ma» sería marzo o mayo).
- **Atajos de teclado globales**: `g`+letra para saltar de módulo (secuencia, no
  combinación), `n` para apuntar un movimiento, `/` para la paleta y `?` para la
  chuleta. Las teclas sueltas se ignoran mientras se escribe en un campo; ⌘K es
  la excepción, porque es la vía de entrada desde cualquier sitio.
- **Estado en la URL**: la vista del pipeline (`?vista=`) y la de mantenimiento
  (`?vista=calendario`) dejan de ser estado de cliente, y se añaden `?abrir=` y
  `?nueva=1` en pipeline y notas. Así el enlace es compartible, el botón «atrás»
  devuelve donde estabas y la búsqueda de la paleta puede abrir **una ficha
  concreta** en vez de dejarte en la lista.
- **Centro de notificaciones in-app** (`notificaciones.tsx`): campana en la
  barra superior con los mismos avisos accionables del inicio, visibles desde
  cualquier página — el cron ya avisa por correo, pero eso se lee fuera y a las
  8:00. **No hay tabla de notificaciones**: un aviso es una CONSULTA sobre el
  estado actual, no un registro, y si la tarea se hace desaparece solo. Para no
  duplicar criterios, la construcción de avisos se extrajo a `construirAvisos`
  (pura) y se añadió `avisosPendientes()` con sus propias consultas mínimas. Lo
  "leído" recuerda la HUELLA del aviso (clave + texto): si pasa de 2 a 3
  seguimientos vuelve a contar como nuevo.
- **Accesos fijados personalizables** en el inicio: el catálogo completo son
  diez y cada uno fija los que usa, en su orden. Antes eran los tres módulos
  fijos, que es el mapa del menú y no lo que se abre a diario. Por defecto
  quedan esos tres, así que sin tocar nada el inicio se ve igual.
- **Densidad / modo compacto**: conmutador en el menú de perfil que pone
  `data-densidad` en `<html>`; el CSS aprieta las celdas de **todas** las tablas
  con selectores de elemento (la especificidad `[atributo]`+elemento gana a la
  utilidad de Tailwind sin `!important`), en vez de cambiar clases componente a
  componente. Las listas que no son `<table>` se marcan con `.fila-lista`.
- **Aviso de novedades**: franja discreta cuando la versión desplegada no es la
  última vista en ese navegador. No enlaza a ningún listado de cambios porque el
  proyecto no publica uno (el CHANGELOG vive en el repo): dice QUE hay versión
  nueva, que es lo que no se puede saber desde dentro de la app.

**Sin cambios de esquema**: las diez salen con las tablas que ya había.

### Repaso de accesibilidad en móvil (375 px)

Medido de verdad en un viewport de 375 px, no a ojo. Como el dashboard va tras
el login de Google, se montó una **página temporal** que renderizaba los
componentes nuevos con datos falsos, se midió con el DOM (anchos, objetivos
táctiles, contraste real calculado) y **se borró al terminar**. Lo que salió:

- ⚠ **El panel de avisos se salía 117 px por la izquierda.** Iba anclado a la
  campana con `right-0`, y la campana NO está en el borde derecho —detrás van
  buscar, «+» y la hamburguesa—, así que un panel de 320 px colgado de ella no
  cabe en 375. Arreglado con `max-sm:static` en el contenedor: en móvil el
  bloque de referencia pasa a ser la barra superior (que es sticky) y el panel
  ocupa el ancho de la pantalla con márgenes. Ahora mide 343 px y no se sale.
- ⚠ **Contraste por debajo de AA: 2,77:1.** El badge de la campana y el botón
  destructivo del diálogo usaban texto **blanco** sobre `--danger` (#f87171),
  que da 2,77:1 cuando AA pide 4,5. Es exactamente el motivo por el que
  `--primary-foreground` ya era oscuro en este proyecto ("el blanco sobre
  esmeralda no da contraste AA"), así que se aplica el mismo criterio: texto
  oscuro sobre el color. Quedan en **6,72:1** y **6,01:1**. Solo afectaba a
  estos dos componentes nuevos; el `bg-btn` de la landing ya estaba elegido
  (#047857) precisamente para pasar AA.
- **Objetivos táctiles** por debajo del criterio del proyecto (40 px en móvil,
  el de `btnIcon`), todos en piezas nuevas: campana 36→40, cerrar el aviso de
  novedades 28→36, conmutador de densidad 22→38, «Elegir» de los accesos 26→38,
  botones del diálogo 34→42 y la fila de la casilla «No volver a preguntar»
  20→40 (la casilla sola eran 16 px). Las sub-pestañas pasan de 32 a 40, y como
  las clases son compartidas, **también mejoran las secciones de Finanzas**.
- **Escape en la paleta**: solo cerraba con el foco dentro del campo (era un
  `onKeyDown` del input), y en cuanto se pulsaba un resultado con el ratón
  dejaba de funcionar. Ahora hay un listener a nivel de documento, en captura.
- Verificado además: **cero desbordamiento horizontal** en toda la página,
  ningún interactivo sin nombre accesible, `aria-expanded`/`aria-haspopup` en la
  campana, `aria-current` en las sub-pestañas, `aria-pressed` en los
  conmutadores, y el anillo de foco (2 px esmeralda) sale con teclado.

### La escala de botones, a 40 px en móvil (y en un solo sitio)

A petición, la subida que se había dejado fuera del repaso anterior:
`btnPrimary` y `btnOutline` pasan de **34 a 40 px** en móvil, y los chips de
filtro y conmutadores (Mes/Año, Lista/Calendario, filtros por ámbito o por tipo)
de **28-35 a 40**. En escritorio **no cambia nada**: es `max-sm:py-2.5`, así que
a 1280 px siguen midiendo 32/34/28 como siempre. Verificado midiendo el DOM en
las dos anchuras.

Para poder hacerlo hubo que unificar antes: la escala estaba **copiada en cinco
ficheros** (`savings/comun`, `pipeline/comun`, `panel/mantenimiento`,
`panel/notas` y `users/users-table`) con las clases palabra por palabra, y ya
había empezado a divergir — tres copias de `btnOutline` sin los estados
`disabled:` y tres variantes distintas de `btnIcon`. Ahora vive en
**`ui/botones.ts`** (`btnPrimary`, `btnOutline`, `btnIcon`, `chipFiltro`), los
dos `comun` la re-exportan porque medio proyecto la importa de ahí, y no queda
ninguna copia suelta. Se tomó como canónica la variante más completa de cada
una: `btnOutline` con sus `disabled:` y `btnIcon` con los `disabled:hover:*` que
solo tenía `users-table` (un botón inhabilitado no debe reaccionar al hover).

`btnIcon` se queda en **34 px** a propósito, y está comentado en el módulo: no
es un botón de formulario sino una acción de fila, y subirlo estiraría cada fila
de las listas largas (movimientos, sesiones) sin ganar nada — sigue holgadamente
por encima del mínimo de WCAG 2.2 AA (24 px).

**Tests**: 372 (10 nuevos) — el paquete de restauración de una nota y su
restaurado (con re-saneado del HTML y sin duplicar al segundo clic), y el parser
de mes de la paleta.

## 02/09/2026

### Notas con etiquetas y tareas, gastos con nota y división, y panel con histórico

Nueve mejoras del backlog de `SUGERENCIAS.md`, en tres módulos. Todo el esquema
va en **una sola migración** (`20260902090000_notas_tareas_gastos_y_accesos`):
dos columnas nuevas (`expense.note`, `note.pinned`) y dos tablas
(`login_event`, `infra_sample`).

**Gastos**

- **Nota por movimiento** (`expense.note`). El contexto que no cabe en el
  concepto ("regalo de X", "compartido con Y"): se edita en la fila (en su
  propia línea, que la prosa no cabe en un hueco) y en el alta rápida global;
  en la lista sale un icono con la nota en el tooltip, sin robar ancho. **El
  buscador también busca en la nota**: es justo lo que uno recuerda después.
- **Dividir un movimiento en varias categorías** (`dividirGasto`). La compra
  mixta (súper + farmacia en el mismo recibo) hasta ahora había que borrarla y
  teclearla dos veces. Las partes heredan tipo, fecha y nota, y **la suma tiene
  que cuadrar** con el importe original —comparada en céntimos, porque en
  decimales 0.1 + 0.2 no da 0.3—: cuadrarla a medias descuadraría el mes en
  silencio. Todo en una transacción (se crean las partes y desaparece el
  original), así que los totales no cambian ni por un instante. El modal va
  diciendo cuánto queda por asignar y el botón no se activa hasta que cuadra.

**Notas** (`?tab=notas`)

- **Buscador** sobre título y contenido, sin tildes ni mayúsculas. Busca el
  TEXTO plano, no el HTML (`strong` no es una palabra de la nota): se calcula en
  el servidor (`textoDe`) para no repetirlo en cada tecla.
- **Fijar (pin)** las importantes (`note.pinned`): salen primero y no se hunden.
- **Listas de tareas marcables**: `<ul class="tareas">` con `<li data-check>`,
  casilla **dibujada con CSS** (no un `<input>`: el HTML de una nota sigue
  siendo texto con formato, sin controles en la allowlist del saneador). Se
  marcan **desde la propia tarjeta**, sin abrir el editor, y el toggle se aplica
  en el SERVIDOR sobre el HTML ya saneado (`alternarTarea` por índice) en vez de
  reenviar el documento: así marcar una tarea no puede reescribir la nota. En el
  editor solo alterna al pulsar la casilla — en el resto del `li` el clic tiene
  que poder colocar el cursor. La tarjeta muestra el progreso (3/7).

**Panel de control**

- **Mantenimiento: vista calendario a 12 meses.** La lista contesta "qué tengo
  pendiente"; el calendario, "qué se me viene encima". Encadena cada tarea desde
  su vencimiento sumando su periodicidad (`proximosMeses`, función pura y
  probada: meses cortos, febrero y cruce de año), y lo ya vencido sale en el mes
  en curso marcado, con su fecha real. Los meses vacíos también se pintan: un
  hueco es información.
- **Monitor con histórico** (`infra_sample` + `lib/infra-historico.ts`). El
  monitor medía solo el instante de la petición: ahora el cron apunta **una
  muestra al día** y la pestaña Servidor tiene un bloque **Evolución** con la
  ocupación del disco, el tamaño de la BD y los días del certificado, cada uno
  con su frase de tendencia ("+4 puntos en 90 días"). CPU y memoria se guardan
  pero NO se grafican: son de un instante concreto del día y su serie no
  significaría nada. Una muestra al día a propósito — muestrear por minuto es
  una base de datos de series temporales, otro problema y otra herramienta.
  Los huecos arrastran el último valor en vez de caer a cero (una caída falsa se
  lee como un disco que se vacía). El tipo y los cálculos puros viven en
  `lib/infra-series.ts` **sin `server-only`**, compartidos por el cron y las
  tarjetas del cliente — mismo criterio que `topes.ts` y `recurrentes.ts`.
- **Histórico de accesos** (`login_event`, append-only). `user_session` solo
  conoce lo VIVO (se purga a los 7 días y el logout retira la suya), así que un
  acceso de hace dos semanas no dejaba rastro. Cada login apunta ahora su fila
  con dispositivo y correo (guardado en la propia fila: el registro sigue siendo
  legible aunque el usuario se borre), y la pestaña Usuarios lista los últimos
  15 con **fecha absoluta** — en un registro de accesos, "hace 12 días" no sirve
  para comprobar nada. Sin FK físico, por el mismo choque de colaciones que
  `user_session`.
- **Visitas: comparativa POR página.** Las páginas más vistas y la comparativa
  global de totales ya existían; lo que faltaba era saber **qué página** ha
  subido — un total plano puede esconder que la home baja y un caso de estudio
  sube. El informe de `pagePath` pide ahora los dos rangos y cada fila lleva su
  variación (una página que antes no existía se marca "nueva", no +100 %).

**Tests**: 353 (29 nuevos) — saneado y alternado de checklists (incluida la
normalización de un `data-check` con basura y que un `<input>` no entra),
proyección del calendario, guardas de `dividirGasto` (suma en céntimos, mínimo
y máximo de partes) y el emparejado de páginas por rango en GA.

### Matices sobre lo anterior (mismo día)

- **Decimales en los importes** — `src/lib/euros.ts`, fuente única. Finanzas
  redondeaba a euros: un gasto de 12,50 € se veía como «13 €» aunque la columna
  es `DECIMAL(12,2)` y el céntimo estaba guardado. Ahora los decimales se
  muestran **solo si el importe los tiene** ("45,80 €" pero "60 €"), en Gastos y
  en Ahorro: siempre dos habría llenado de «,00» una columna de cifras redondas.
  El formateador estaba **duplicado en tres sitios** (`savings/comun.tsx`,
  `app/page.tsx` y el pipeline); los dos primeros pasan a la fuente única y el
  pipeline se queda como estaba (sus importes son ofertas redondas). Se redondea
  a céntimos también **al guardar** (`limpiar` de las actions): antes lo hacía
  la columna por su cuenta, y entonces lo guardado no coincidía con lo que
  validó la división en partes. Los avisos por correo siguen en euros enteros.
- **Etiquetas de las notas, retiradas.** Se quitaron el mismo día que se
  hicieron, a petición: el buscador ya encuentra por contenido y los chips de
  filtro solo añadían un campo más al formulario. Se fue con su columna
  (`note.tags`), retirada de la migración —que **no se había desplegado**— en
  vez de dejar un par añadir/quitar en el historial; la BD local se reconcilió
  (columna borrada + `migrate resolve --applied`, cero drift). El **pin** y el
  buscador se quedan.
- **La pestaña Usuarios, en tres sub-pestañas**: Cuentas · Sesiones · Accesos,
  con la misma barra que las secciones de Finanzas. Las tres listas colgaban una
  debajo de otra en una página cada vez más larga (y el histórico de accesos la
  remató). La barra se extrajo a `dashboard/sub-tabs.tsx` para que los dos
  módulos compartan clases en vez de copiarlas, y **cada sub-pestaña consulta
  solo lo suyo** (antes se traían sesiones y accesos incluso para ver cuentas);
  la sub-pestaña entra en el `key` del Suspense, así que el cambio pinta su
  esqueleto. Va por query param (`?tab=usuarios&u=sesiones`), enlazable y con la
  barra de carga como el resto.

**Tests**: 362 (9 más) para la regla de decimales, incluido el ruido binario
(`0.1 + 0.2` → "0,30 €", pero `100.00000000000001` → "100 €", sin un ",00"
inventado).

## 01/09/2026

### Acciones rápidas (⌘K + alta), búsqueda de movimientos, comparativa y PWA

Mejoras pensadas para el día a día del dashboard:

- **Paleta de comandos (⌘K / Ctrl+K)** — `dashboard/acciones-rapidas.tsx`.
  Buscar y saltar a cualquier sección o lanzar una acción sin ratón, desde
  cualquier página: navegación (Inicio, las cuatro secciones de Finanzas,
  Oportunidades, las pestañas del Panel, portfolio) y acciones ("Nuevo gasto",
  "Nuevo ingreso"). Filtra **sin tildes ni mayúsculas** (`sinAcentos`) sobre
  etiqueta + sinónimos, se recorre con ↑/↓ y se ejecuta con Enter. La abre el
  botón "Buscar" de la barra superior (con su atajo a la vista) o el teclado.
- **Alta rápida de movimiento** — mismo fichero. Un "+" en la barra superior
  (y la paleta) abre un modal para apuntar un gasto/ingreso **sin ir a
  Finanzas**: la fricción de registrarlo es justo lo que hace que se deje de
  registrar. Reutiliza `createGasto`; las categorías se cargan al abrir
  (`categoriasParaAlta`, con guarda de admin) y al guardar refresca la página
  actual para que el alta se note ya (p. ej. el KPI del inicio). Ambas cuelgan
  del layout, envolviendo top-nav y contenido (`AccionesRapidasProvider`).
- **Búsqueda de movimientos** — `savings/buscar-gastos.tsx` +
  `buscarMovimientos` en `lib/gastos.ts`. A diferencia de la vista del mes (que
  solo mira UN mes), barre todo el histórico por **concepto, tipo, rango de
  fechas e importe** para responder "¿cuánto llevo gastado en X este año?". Las
  sumas (ingresos/gastos/balance) y el total son del CONJUNTO de coincidencias;
  la lista se recorta a 200 (con aviso). Es de consulta: cada fila lleva a su
  mes, donde se edita. Se entra por el botón "Buscar" de la vista de Gastos o
  por la paleta (`?s=gastos&buscar=1`, con los filtros en la URL saneados en el
  servidor).
- **Comparativa mes vs. mes en el inicio.** El KPI "Gastos del mes" muestra el
  delta frente al mes anterior (subir es malo → rojo; bajar → verde), con el
  gasto previo añadido a `resumenInicio` (`lib/inicio.ts`).
- **App instalable (PWA), a medida de iPhone** — `app/manifest.ts` +
  `appleWebApp` en el layout raíz. "Añadir a pantalla de inicio" abre el sitio a
  **pantalla completa** (sin la barra de Safari) y directo al dashboard
  (`start_url: /app`), con la barra de estado en negro y el monograma AO. ya
  existente (`apple-icon.tsx` / `icon.svg`). Se emiten las dos metas de
  capacidad (`mobile-web-app-capable` moderna + `apple-mobile-web-app-capable`
  para iOS antiguos). iOS no admite share-target, así que no se incluye.

### Buscador en los selects, feedback de carga y retoques

- **Buscador en el `SelectField`** (`ui/fields.tsx`): con más de 8 opciones sale
  un campo de búsqueda en la cabecera del popover que filtra **sin tildes ni
  mayúsculas** ("cafe" encuentra "Café"), se autoenfoca al abrir y avisa con
  "Sin resultados". El normalizador se unificó en `sinAcentos` (`lib/utils.ts`),
  compartido con el buscador de la sección Ajustes (que tenía su propia copia).
- **Barra de carga lineal bajo la barra superior.** Cambiar de sección/pestaña
  navega por query param (sin prefetch) y el clic se sentía "congelado" mientras
  el servidor traía los datos (`loading.tsx` no se dispara en cambios de query
  param). Se añade una **barra lineal global** justo debajo del menú superior
  (`barra-carga.tsx`, montada en el layout): aparece al empezar a navegar y
  desaparece cuando la ruta se asienta. Detecta el inicio de dos formas —un clic
  en cualquier `<a>` interno (Links de la barra superior, pestañas del Panel en
  escritorio, rango de Visitas, «Ver portfolio público») vía un listener global,
  y la llamada `iniciar()` de **cada** navegación por `router.push` (secciones y
  años de Finanzas, desplegable del Panel en móvil, y las vistas de Gastos: mes
  anterior/siguiente y el conmutador mes/año)— y el fin, cuando cambian
  `pathname`/`searchParams`. Cubre así **todos los tabs y vistas**. La descarga
  del Excel se excluye (lleva `download`: no navega). El pipeline conmuta de
  vista con estado de cliente (no navega, no hay que cargar) y el «Comprobar de
  nuevo» del Panel usa `router.refresh` con su propio spinner. Se descartó la
  primera versión (spinner por pestaña) a petición.
- **El acceso directo "Gastos del mes"** del inicio ahora abre directamente la
  sección Gastos (`?s=gastos`), no el Panel de finanzas.
- **URL de LinkedIn** actualizada (sin tildes) en `lib/landing/content.ts`.

## 31/08/2026

### Notas en el Panel de control (editor visual)

Quinta pestaña del Panel (`?tab=notas`): apuntes propios del admin con formato
—títulos, negrita, cursiva, subrayado, listas y enlaces—. Reabre el "módulo de
notas/TIL" que se había descartado el 25/08 por no encajar; se rehízo a
petición.

Se editan en un **editor visual tipo Word** (`contentEditable`: siempre se ve el
formato, sin sintaxis a la vista) y se **guardan como HTML**. La primera versión
del día guardaba Markdown con una vista previa aparte; se cambió a HTML/WYSIWYG
a petición, porque editar Markdown a mano no era cómodo.

La clave es hacer seguro el "guardar HTML", que es justo el problema de
`innerHTML` que la auditoría del 28/08 señaló:

- **El HTML se SANEA en el servidor antes de guardarlo** (`lib/sanitizar-html.ts`,
  sobre `sanitize-html`): es el punto donde el HTML pasa a ser de fiar, no el
  cliente (que se salta). La allowlist deja formato de texto, listas, encabezados
  y enlaces, y tira `<script>`, manejadores `on*`, estilos y el `javascript:` de
  un href. Un saneador de HTML es lo último que conviene escribir a mano, así que
  va sobre una librería probada (como Chart.js o exceljs).
- Como lo guardado ya está saneado, pintarlo con `dangerouslySetInnerHTML` —en el
  editor y en las tarjetas— es seguro. Las tarjetas ahora **renderizan el
  formato** (antes no se veía).
- **Editor** (`panel/notas.tsx`): `contentEditable` con barra de formato
  (`document.execCommand`) y el título aparte. Tabla `note` (migración
  `notas_y_unicidad`), acciones `createNote`/`updateNote`/`deleteNote` con guarda
  de admin; la nota vacía se detecta sobre el texto (un editor "vacío" deja `<br>`).

Tests: el saneador (allowlist y los vectores de inyección) y las acciones
(saneado + validación).

Retoques del editor: los botones de la barra **se marcan** cuando su formato
está activo donde está el cursor (vía `queryCommandState`, como en Word);
**Ctrl/Cmd+A** selecciona solo el contenido del editor (no la página) para que el
formato se aplique a todo de forma fiable; y quitado el texto de ayuda de la
cabecera, con el botón «Nueva nota» a lo ancho en móvil.

De una segunda auditoría salieron dos arreglos del editor: la **tarjeta de nota
pasa de `<button>` a `<div role="button">`** (pintar el HTML de la nota —bloques
y enlaces— dentro de un botón era anidamiento inválido y hacía que un enlace
disparara enlace + editor a la vez; el preview lleva `pointer-events-none`), y se
fuerza **`styleWithCSS` a false** para que el formato salga por etiquetas
(`<b>`...) y no como `style` en línea, que el saneador tiraría.

En móvil, las cinco pestañas del Panel no caben en 375px (ni compactas), y ni el
scroll horizontal ni las dos filas quedaban bien, así que ahí van en un
**desplegable** (`PanelTabsMovil`, con el `SelectField` del tema); en escritorio
siguen como pestañas.

⚠ Dependencia nueva: **`sanitize-html`** (+ sus tipos). El despliegue la instala
con el `pnpm install` del build; no hay variables nuevas.

### Retirado el modo privado

Se quita **de raíz** el "modo privado" de finanzas (el ojo que difuminaba los
importes), que estaba desde el 25/08. Durante el día se llegó a reescribir como
preferencia por usuario (columna JSON `user.prefs`, un modal de Preferencias en
el menú de usuario), pero al final se decidió retirarlo entero: no aportaba lo
suficiente para la complejidad que arrastraba.

Fuera: `privado.tsx`, `lib/prefs.ts`, el modal de Preferencias, la action
`guardarPreferencias`, el ojo de la barra de finanzas, el enmascarado de los
importes en el inicio y en Ajustes, y el campo `prefs` de la sesión (`auth.ts` +
tipos). La columna `user.prefs` no llega a producción: se retira del esquema y
de la migración (ver abajo).

### Migraciones de la sesión, unificadas en una

Las tres migraciones creadas esta sesión (aún sin desplegar) se funden en una:
`unicidad_de_nombres` + `notas` → **`notas_y_unicidad`**, y `preferencias_de_usuario`
**desaparece** con el modo privado. En local se reconcilió a mano (drop de la
columna `prefs`, ajuste de `_prisma_migrations` y `migrate resolve --applied`) y
`migrate diff` contra la BD confirma **cero drift**. Quedan así **seis**
migraciones pendientes para producción (las cinco de `0900c6a` + esta).

### Periodicidad libre en los recurrentes

Los recurrentes ya no se limitan a las cinco periodicidades fijas: el selector
"Cada cuánto" tiene ahora un **Personalizado** que despliega número + unidad
(meses/años), así que caben "cada 18 meses", "cada 2 años" o "cada 3 años".

Casi todo estaba hecho de fábrica —`sumarMeses` no distingue 24 meses de 1, y
`interval_months` es un SMALLINT— así que el cambio fue pequeño:

- `etiquetaPeriodo` lee los múltiplos de 12 por encima del año en años ("Cada 2
  años", no "Cada 24 meses"); el resto, en meses.
- El formulario deriva su estado del propio `intervalMonths`: si es una de las
  comunes muestra el select; si no, cae en Personalizado con el número y la
  unidad ya calculados. Al elegir año/mes recompone el intervalo y **lo topa**
  para que la combinación nunca pase del límite.
- El tope del servidor (`periodoValido`) sube de 24 a **120 meses (10 años)**.
  No protegía de nada —`MAX_CARGOS` ya frena la generación—, así que ahora es
  solo una cota de sensatez alineada con la ventana de fecha (±10 años).

Tres tests nuevos (etiquetas en años, alta con periodicidad personalizada y su
rechazo por encima del tope).

### Un solo componente de campo (de la auditoría del 28/08)

`Field` —la etiqueta sobre un campo de formulario— estaba definido **cuatro
veces**: en `savings/comun.tsx` (exportado y sin que lo importara nadie: código
muerto que sobrevivió a la limpieza del 28), y como copia local en
`panel/mantenimiento.tsx`, `pipeline/oportunidad-modal.tsx` y
`savings/ajustes.tsx` (ahí llamado `Campo`). Ahora vive una sola vez en
`ui/fields.tsx`, junto a los campos que etiqueta.

La versión que se queda es la de `ajustes`, que era la única correcta: un
`<label>` de verdad en lugar de un `<div>` con un `<p>`, así que **el clic en el
texto enfoca el campo** (o abre su popover) en los 22 campos de los tres
modales, no solo en los de Ajustes. El nombre que anuncia el lector de pantalla
no cambia: sale del `ariaLabel` de cada campo, que ya lo llevaban todos.

Sin cambio visual: `flex flex-col gap-1` deja los mismos 4px que el `mb-1`
anterior, y el patrón ya estaba en producción en Ajustes desde el 28/08 — aquí
solo se extiende a los otros dos modales.

⚠ `Field` espera **un** control dentro: un `<label>` con dos se asocia solo al
primero. Está dicho en su comentario.

### La fixture de GA caducaba sola

`tests/ga.test.ts` simulaba la Data API con dos días **escritos a mano**
(`20260824` y `20260825`). La serie que arma `ga.ts` son los últimos `dias`
días HASTA HOY, así que el 31/08 el primero ya caía fuera de la ventana de 7
días, el andamiaje lo rellenaba a cero y el test fallaba: `[5]` en vez de
`[3, 5]`. No era un fallo del código — era el test caducando por el paso del
tiempo, tres días después de escribirlo.

Los dos días se calculan ahora relativos a hoy y en el mismo horario que usa
`ga.ts` (Europe/Madrid), así que la ventana siempre los contiene.

### Operación en el VPS: healthcheck, logs con techo y `.env.example`

Del bloque de operación de la auditoría:

- **`web` tiene healthcheck.** Antes solo `db` lo tenía; `restart: unless-stopped`
  reinicia el proceso si muere, pero no si Next se cuelga respondiendo mal. Ahora
  sondea `http://127.0.0.1:9443/robots.txt` (estático y barato) con el `wget` de
  busybox que ya trae la imagen alpine.
- **Los logs de Docker no pueden llenar el disco.** `json-file` con
  `max-size: 10m` y `max-file: 3` en `db` y `web`: sin techo crecían sin límite,
  justo lo que vigila el propio Panel de control.
- **`.env.example` documenta `CRON_EN_DEV` y `NEXT_PUBLIC_SITE_URL`** como claves
  comentadas (antes solo se mencionaban en prosa, y un grep de claves no las
  veía). Ambas siguen siendo opcionales en desarrollo.

El **límite de memoria** de `db` y `web` se dejó como bloque comentado en el
compose: ponerlo a ciegas, sin saber la RAM del VPS, provoca el OOM que se
quiere evitar. Queda en `TAREAS.md` a falta de mirar `free -m` y elegir cifra.

Todo el compose se validó con `docker compose config` (parseo en cliente; el
daemon no hace falta): sintaxis correcta y `MYSQL_ROOT_PASSWORD` vacío en `web`.

### Cerrado el bloque de endurecimiento de la auditoría del 28/08

Los cinco puntos de seguridad del informe:

- **El tooltip escapa el texto que inyecta.** `ui/charts/tooltip.ts` es el único
  sitio del proyecto que construye HTML a mano y lo mete con `innerHTML`, así
  que era el único donde ya no valía la premisa de "React escapa todo" con la
  que se descartó la CSP con nonces. Ahora el nombre, el valor y el título pasan
  por un escape antes de entrar (el color no: viene del código, va en un `style`).
  Con eso la premisa vuelve a ser cierta en todo el sitio; **la CSP sigue sin
  reabrirse**. Tres tests nuevos.
- **La contraseña root de MySQL sale del contenedor de la app.** `web` (y
  `migrate`) cargan el `.env.production` entero con `env_file`, que lleva
  `MYSQL_ROOT_PASSWORD` porque `db` lo interpola del `--env-file`. La app no lo
  usa (conecta con `DATABASE_URL`), así que se anula en su `environment`
  (`MYSQL_ROOT_PASSWORD: ""`, que gana a `env_file`): el proceso Next ya no
  hereda el root, y un vuelco de entorno o una traza no lo expondría.
- **`Cache-Control: private, no-store` en la exportación a Excel.** La guarda de
  admin ya estaba; ahora ningún intermediario puede guardar las finanzas.
- **Unicidad de nombres en la BD.** Índices únicos en `expense_category`
  (nombre+tipo) y `maintenance_scope` (nombre): la garantía pasa del código
  (comprobar-antes-de-insertar) al motor. Generada con `migrate diff` sin tocar
  la BD y con los duplicados comprobados antes (0 en local). Va junto con la
  tabla `note` en la migración `notas_y_unicidad`.
- **`override` de `uuid` a `>=11.1.1`** (quedó en 14.0.2): retira la única
  alerta que tenía el `pnpm audit` al empezar. `exceljs` sigue funcionando
  —usa `require('uuid').v4`, que v11+ mantiene—, verificado generando un xlsx
  con formato condicional (la ruta que carga uuid).

Al repasar el `audit` afloraron **tres avisos nuevos en `mariadb`** (publicados
estos días, no los había el 28) que no se tocan de momento: riesgo real bajo en
este despliegue y el adapter fija la versión exacta. Anotados en `TAREAS.md`.

### Cerrado el bloque de código de la auditoría del 28/08

Los cinco puntos de código que quedaban del informe:

- **Validación igualada en los dos módulos de finanzas.** `cleanConcept`
  (ingresos extra y gastos de viaje, en `finance/actions.ts`) ahora recorta el
  concepto a 255 y rechaza importes de magnitud absurda (`>= 1e10`), igual que
  `limpiar` en `gastos-actions.ts`. Sin eso, un concepto largo reventaba contra
  el `VarChar(255)` de la columna y al cliente solo le llegaba el "Error
  inesperado" genérico en vez de un mensaje que se entienda.
- **Fuera el cast que mentía.** `apuntarCargos` en `lib/gastos.ts` declaraba la
  fila con `amount: unknown` y la pasaba con `as number`, cuando de Prisma llega
  un `Decimal`. El tipo de la fila es ahora el del modelo (`RecurringExpenseModel`),
  así que Prisma valida los campos de verdad y desaparecen los dos casts
  (`type` y `amount`) que lo tapaban.
- **El modal atrapa el foco.** `ui/modal.tsx` ya tenía `role="dialog"`,
  `aria-modal` y cierre con Escape; ahora, además: el foco entra al primer
  control del cuerpo al abrir (no en la "X"), **Tab da la vuelta dentro** en vez
  de escaparse a la página de detrás, y al cerrar vuelve al elemento que lo
  abrió. Dos sutilezas que costaron pensarse: el trap se **desactiva** mientras
  hay un popover de `fields.tsx` abierto (su foco vive en un portal fuera del
  panel), y la gestión del foco va en un efecto SIN dependencias, aparte del de
  teclado (que depende de `onClose`, a menudo inline: en el mismo efecto,
  reenfocaría el primer campo en cada pulsación).
- **`minimumReleaseAgeExclude` vacío.** Retiradas las dos exclusiones
  (`nodemailer@9.0.6`, `@testing-library/react@16.3.3`): ya tienen edad de
  sobra y `pnpm install --frozen-lockfile` sigue resolviendo igual sin ellas.
- **CI en GitHub Actions** (`.github/workflows/ci.yml`): en cada push a `main` y
  en cada PR corre las cuatro comprobaciones de siempre — `lint`, `tsc`, `test`
  y `build` — sobre Node 24, con `DATABASE_URL` y `NEXT_PUBLIC_SITE_URL` de
  pega (nada conecta a una BD; el singleton de Prisma solo necesita que la URL
  tenga formato). Dejan de depender de acordarse de ejecutarlas.

Quedan pendientes de la auditoría los bloques de **Endurecimiento** (5) y
**Operación en el VPS** (4), en `TAREAS.md`.

---

## 28/08/2026

### Más control de los recurrentes: apuntar ya, duplicar y ver lo apuntado

Cada recurrente despliega su detalle desde la fila (un chevron; en la fila
serían seis iconos) con tres cosas:

- **Apuntar el cargo ya**, sin esperar a la pasada del cron — con la fecha en el
  propio botón ("Apuntar el cargo del 10/09"). Comparte **la misma rutina** que
  el cron (`apuntarCargos`), y esa es la clave: apunta el cargo con **su propia
  fecha, no con la de hoy**, y adelanta `next_date`, así que cuando llegue el
  día el cron no lo duplica. Si estaba atrasado, recupera todos los pendientes.
  Funciona con el recurrente en pausa y no lo reactiva.
- **Ver lo que ha apuntado**: los últimos doce movimientos con su fecha e
  importe, y el total. Para esto hacía falta saber de dónde viene cada
  movimiento, que hasta ahora no se guardaba: columna `expense.recurring_uuid`
  (migración `origen_de_los_movimientos`), con `SetNull` — borrar el recurrente
  **no** borra su gasto real, solo pierde el origen. Los movimientos anteriores
  a la migración se quedan sin origen: nadie sabe de dónde vinieron.
- **Duplicar**: abre el alta con los valores copiados y "(copia)" en el
  concepto. No escribe nada hasta darle a Crear.

Dos detalles que salieron al probarlo:

- Si la lectura de lo apuntado falla, el panel **se quedaba en "Cargando..."
  para siempre**. Ahora ese caso tiene su mensaje.
- En móvil, "Apuntar el cargo del 03/09" **no cabe en media fila** y se partía
  en dos líneas (56 px de alto contra los 37 de "Duplicar"): por debajo de sm,
  un botón por fila y a lo ancho.

6 tests nuevos en `tests/recurrentes.test.ts`: que apunta aunque no haya
vencido, que recupera atrasos, que marca el origen, que respeta la pausa, que
un uuid inexistente devuelve null, y el listado acotado a su recurrente.

### Limpieza: una sola `sumarMeses` y fuera lo que ya no se usa

Con todo lo del día encima, dos cosas sobraban:

- **`sumarMeses` estaba duplicada** —una en `mantenimiento.ts` y otra en
  `recurrentes.ts`, idénticas salvo el parámetro `ancla`— justo el patrón que
  este proyecto ya pagó con los nombres de los meses. Ahora vive en
  `src/lib/fechas.ts`, que es el módulo de fechas puro que ya compartían, con el
  ancla como parámetro opcional. De paso quedó claro que `mantenimiento.ts` no
  la usaba: solo la reexportaba para su server action.
- **`PALETA` y `btnDanger`**: la primera quedó huérfana al automatizar el color
  de las categorías; la segunda llevaba tiempo sin usarse.

### Las flechas de los campos numéricos desaparecen en móvil

Eran el último objetivo táctil pequeño que quedaba (24×18 px) y salían en cada
importe, cada periodicidad y cada tope. En un móvil no aportan nada: al tocar el
campo sale el teclado numérico y se teclea la cifra; dos botones diminutos
pegados al borde solo estaban ahí para pulsarse sin querer. Desde `sm` siguen
igual, que es donde sí se usan con el ratón, y el teclado sigue incrementando
con ↑/↓ sobre el propio input en cualquier tamaño.

De paso, el campo gana los ~30 px que ocupaban: el importe del alta rápida pasa
de 119 a 149 px de ancho útil. Con esto **no queda ni un botón por debajo de
32 px** en ninguna de las pantallas nuevas.

### Los ámbitos de mantenimiento se pueden crear, renombrar y borrar

Salieron como enum de tres (servidor, casa, vehículo) y eso significaba que
añadir uno —moto, salud, trabajo— exigía tocar el esquema y desplegar. Ahora son
una **tabla** (`maintenance_scope`, migración `ambitos_editables`) y se
gestionan desde el modal «Ámbitos» de la pestaña.

- **Renombrar es seguro**: las tareas apuntan al ámbito por uuid, no por nombre.
- **Un ámbito en uso no se borra**, mismo criterio que las categorías de gastos:
  el FK es SET NULL, así que borrarlo dejaría tareas sin clasificar en silencio.
  El botón sale apagado diciendo cuántas tareas lo usan, y la acción también lo
  rechaza en el servidor.
- La tarea **exige un ámbito que exista** (antes, un valor raro caía al defecto;
  ahora tiene que ser una fila).
- El filtro y el selector se construyen con la lista real, alfabética.

La migración hace el trasvase en dos pasos —siembra los tres nombres del enum,
apunta cada tarea al suyo traduciendo el valor viejo y retira la columna— así
que no hay que reclasificar nada a mano. Se queda como migración aparte de
`ambitos_de_mantenimiento` (la que creó el enum) en vez de reescribirla: ninguna
de las dos está desplegada, pero rehacer una migración ya aplicada en local es
más frágil que añadir la que corrige.

10 tests para el alta/renombrado/borrado y la validación del ámbito de la tarea.

### Mantenimiento, ahora también de casa y del vehículo

La ITV, el seguro de casa o la revisión de la caldera son **el mismo problema**
que revisar dependencias o comprobar backups: algo que caduca cada N meses y
que hay que recordar. En vez de un módulo nuevo, las tareas de mantenimiento se
separan por **ámbito**: servidor, casa o vehículo (columna `scope`, migración
`ambitos_de_mantenimiento`).

- Cada tarea muestra su ámbito **con icono** (servidor, casa, coche) junto a la
  periodicidad, que es lo que distingue una lista mezclada de un cajón.
- **Filtro por ámbito** en la cabecera, que solo aparece cuando hay más de uno
  en uso: con todo en el servidor no filtraría nada y sería ruido.
- El **correo de vencidas** abre cada tarjeta con el ámbito ("Vehículo · Vencía
  el 14/11") — en un aviso con la ITV y los backups juntos, es lo primero que
  hace falta saber.
- El ámbito se elige en el modal de alta/edición y **por defecto es Servidor**,
  que es lo que eran todas las tareas hasta ahora: la migración no tuvo que
  rellenar nada. Un ámbito inventado desde fuera cae en Servidor en vez de
  fallar.

6 tests nuevos en `tests/mantenimiento.test.ts`, que de paso estrena cobertura
de sus server actions (antes solo se probaban las funciones puras).

### Los años de ahorro también se gestionan en Ajustes

Tercer bloque de la sección: **años de ahorro**, con lo que estaba en el modal
«Gestionar años» de las pestañas de Ahorro (crear, renombrar, objetivo,
exportar a Excel, eliminar) y dos cosas más de contexto que el modal no daba:
cuántos **meses rellenos** tiene cada año y, en la cabecera, el objetivo del año
en curso.

Las pestañas de Ahorro se quedan **solo para navegar**, que es lo que se espera
de unas pestañas, y toda la configuración de Finanzas queda en un sitio. El
aviso al borrar ahora dice exactamente qué se lleva por delante ("se borra el
año con todo su detalle: 12 meses rellenos, ingresos extra y viajes") y aclara
lo que NO se toca: los movimientos de Gastos, que no cuelgan del año.

Los textos de "no hay año creado" del Panel, del Resumen y del módulo anual
apuntan ahora a Ajustes en vez de al modal desaparecido.

### Ajustes: categorías y recurrentes salen de los modales

Los dos se gestionaban en modales dentro de la vista Gastos, y con 19
categorías ya había que buscar a ojo en una lista con scroll. Ahora Finanzas
tiene una **cuarta sección, Ajustes** (`?s=ajustes`), con un bloque para cada
cosa; la vista de Gastos se queda con lo que es —consultar y apuntar
movimientos— y sus botones «Gestionar» llevan aquí.

Lo que la sección permite y el modal no:

- **Fusionar categorías** del mismo tipo: los movimientos y los recurrentes de
  una pasan a la otra en una transacción y la de origen desaparece. Antes, con
  dos nombres parecidos acumulados ("Comer fuera" y "Restaurantes"), la única
  salida era borrar una y perder la categoría de todo su historial. La fila
  dice antes de confirmar qué va a mover y adónde.
- **Una categoría en uso ya no se puede borrar.** El FK es `SetNull`, así que
  borrarla dejaba su historial "sin categoría" en silencio: años de gasto
  desclasificados en un clic. Ahora la acción lo rechaza contando movimientos y
  recurrentes, el botón sale apagado con el motivo, y el camino para quitar una
  de en medio es fusionarla.
- **El color lo elige la aplicación** y nunca repite (`src/lib/colores.ts`):
  busca el tono más alejado de los que ya se usan, con la saturación y la
  luminosidad fijas del tema. La paleta manual eran ocho colores para 19
  categorías —repetidos garantizados— y elegir color al dar de alta un gasto no
  aporta nada. Con las 19 de la BD, el siguiente color cae en el tono 93, a 48°
  del más cercano.
- **Buscador y filtros** en los dos bloques. La búsqueda ignora mayúsculas y
  tildes (`NFD` + quitar diacríticos): "cafe" encuentra "Comer fuera / Cafés".
  Sin icono de lupa dentro del campo: se montaba encima del placeholder.
- **Altas y ediciones, por modal** (el común de la casa), con el mismo
  formulario y los campos etiquetados: en la fila no se leían, y el de un
  recurrente son seis. El tipo solo se ofrece al crear —cambiarlo después no
  significa nada— y en la fila quedan las acciones de un clic: pausar,
  fusionar y borrar.

**Repaso móvil de todo lo nuevo** (375 y 320 px, y comprobado que a 1280 no
cambia nada): ningún desbordamiento horizontal ni texto cortado en las dos
tarjetas de Gastos, la sección y sus dos modales. Lo que hubo que corregir:

- **Objetivos táctiles**: los chips de filtro y los botones de alta salían a
  27 px de alto y el «Eliminar» de la confirmación a 24 px. Todos a 32-35 px en
  móvil (`max-sm:py-2`), como ya estaban los botones de icono.
- **"Con tope" se partía en dos líneas** al estrecharse el chip y subía la fila
  a 54 px: pasa a llamarse **"Tope"**, y los chips llevan `whitespace-nowrap`.
- **La cabecera se APILA en móvil** (columna, no wrapping): buscador, filtros y
  botón de alta, cada uno en su fila y a lo ancho. Repartiéndose por wrapping
  se pisaban entre ellos, y a 320 px el grupo de chips se aplastaba a 82 px.
- **Las filas de las dos listas, a dos líneas iguales**: nombre y su cifra
  arriba (el tope o el importe), datos y acciones abajo. La de categorías se
  iba a tres líneas y la de recurrentes también. El truco es `sm:contents` en
  los dos envoltorios: en escritorio desaparecen y todo vuelve a una sola fila,
  con `sm:order-*` para conservar el orden original de las columnas.
- **La vista de Gastos se queda sin atajos a Ajustes**: los botones «Categorías
  y recurrentes» y «Gestionar» se retiraron — la sección ya está en la nav, y
  en móvil el segundo competía por sitio con el resumen de su tarjeta.

La lista va **siempre alfabética**. Hubo un orden manual con flechas y su
columna `sort_order`; se retiró el mismo día, con su migración, porque el orden
daba igual y la columna solo añadía reglas (las flechas tenían que ocultarse al
filtrar). Como no llegó a desplegarse, no queda ni rastro en producción.

12 tests nuevos entre `tests/gastos.test.ts` (fusión, guarda del borrado, color
automático) y `tests/colores.test.ts` (tono de un hex, ida y vuelta, 30 colores
seguidos sin repetir). Las piezas comunes de las dos vistas (`fmtDia`,
`TIPOS`...) pasaron a `savings/comun.tsx`.

### Recurrentes: lo que se repite se apunta solo

Alquiler, suscripciones, seguros, la nómina... todos los meses había que
teclear lo mismo. Ahora se dan de alta una vez (**concepto, importe,
periodicidad, próximo cargo y categoría**) y **el cron diario los apunta** en
`expense` el día que toca, adelantando su próxima fecha. Lo generado es un
movimiento **normal**: se puede editar y borrar como cualquier otro, y si se
pausa un recurrente, se conserva su configuración.

Tabla nueva `recurring_expense` (migración `gastos_recurrentes`), tarjeta
**Recurrentes** en la vista del mes —con el estado de cada uno: "próximo
03/09", "cargado el 10/08" o "pendiente desde…"— y modal de gestión con el
mismo formulario para el alta y la edición.

Tres decisiones que no son obvias:

- **`day_anchor`**: un recibo del 31 pasa por febrero, se recorta al 28 y, sin
  guardar el día original, se quedaría clavado en el 28 para siempre. El ancla
  lo devuelve al 31 en marzo.
- **Recuperar atrasos**: si el servidor estuvo parado, `cargosPendientes` apunta
  TODOS los cargos que se perdieron, no solo el último. Con freno
  (`MAX_CARGOS = 24`) y validación de la fecha de alta: una fecha de 2019 solo
  puede ser un despiste, y llenaría el histórico de movimientos falsos.
- **Equivalente mensual**: la cifra de cabecera reparte los no mensuales entre
  sus meses (un seguro de 600 € al año son 50 € al mes). Sumar solo los
  mensuales dejaría fuera justo los recibos gordos.

En el cron, la generación va **antes** de los avisos y estos la esperan: si hoy
es día 1, el aviso de topes tiene que contar ya con el alquiler recién
apuntado. De paso se corrigió que **sin SMTP no se programaba nada**: los
recurrentes no tienen nada que ver con el correo y ahora se apuntan igual.
19 tests nuevos (`tests/recurrentes.test.ts`), casi todos sobre fechas: meses
cortos, febrero bisiesto, cruce de año y atrasos.

### Topes de gasto por categoría

Los donuts cuentan lo que ya pasó, y un gasto hecho no se deshace. Cada
categoría de gasto admite ahora un **tope mensual** (`expense_category.budget`,
vacío = sin tope) que se pone en «Gestionar categorías», y la vista del mes
lleva una tarjeta con **una barra por tope** —verde, ámbar al 80 % y roja al
pasarse— más la barra del conjunto y el "te quedan X €".

El **aviso por correo** sale al llegar al 80 % y al pasarse, y **no se repite
semanalmente** como el resto de avisos del panel: uno por mes y por nivel,
recordado en `budget_notified` (`'2026-08:pasado'`). Es deliberado — no hay
nada que "marcar como hecho", así que insistir cada semana solo enseñaría a
ignorar el correo. Cambiar el tope limpia la marca y el estado se reevalúa.

Migración `topes_por_categoria` (dos columnas, sin tocar datos) y 16 tests
(`tests/topes.test.ts`), incluidos los cuatro casos del aviso: escala de 80 % a
pasado, no repetir, mes nuevo y recuperación.

Los umbrales viven en `src/lib/topes.ts`, **sin `server-only`**: los usan el
aviso (servidor) y las barras (cliente), y tener el 80 % escrito en dos sitios
es la forma segura de que un día dejen de coincidir.

### Producción al día: gastos e ingresos, Finanzas en tres secciones y Chart.js

Desde el 26/08 producción iba por detrás. Desplegado `69b9d36`, que arrastra
todo el trabajo del 26-28/08: el **módulo de control de gastos e ingresos**,
Finanzas en tres secciones, la tasa de ahorro corregida, el repaso móvil del
dashboard, las **gráficas sobre Chart.js** con tooltip compartido y la
agrupación semanal de la serie de visitas.

Cómo fue, por si sirve la próxima vez:

- **Dump manual antes de migrar**, además del diario de las 4:00: el despliegue
  llevaba DDL y el cron podía quedar a horas de distancia.
- **Build con `--profile setup`** — sin el perfil no se reconstruye la imagen de
  `migrate` y la migración se aplicaría con el código viejo — y paso
  `run --rm migrate` **antes** del `up`.
- Migración nueva **`control_de_gastos`** (tablas de movimientos y categorías,
  con el seed de las 19 categorías: 15 de gasto y 4 de ingreso). `migrate
  deploy` es idempotente y el seed usa `WHERE NOT EXISTS`, así que aplicó solo
  lo que faltaba.
- **Ninguna variable de entorno nueva**: comprobado contra lo desplegado que
  `docker-compose.yml` y `.env.production.example` no cambian, y que la única
  nueva (`CRON_EN_DEV`) es exclusiva de desarrollo. `chart.js` la instala el
  build. El `Dockerfile` solo subió pnpm a 11.24.0.

**Los datos inventados de la BD local se quedan**: los 155 movimientos de 2026,
el año de ahorro 2025 y las siete oportunidades (`origin = 'Datos de prueba'`)
resultan útiles para trabajar con las pantallas llenas, así que dejan de estar
pendientes de borrado. Producción no los ve: su BD arrancó vacía y nada de esto
va en migraciones ni en el seed.

## 27/08/2026

### Los avisos por correo ya no se disparan en desarrollo

Llegó un correo de aviso desde local. La causa: `instrumentation.ts` arranca el
planificador en **cualquier** entorno y `iniciarCron` hace una pasada de
arranque **al minuto** de levantar el proceso, así que con el SMTP configurado
en el `.env` bastaba tener el dev server encendido un rato para recibirlo (y
para marcar el reaviso semanal en la BD, ocultando el aviso real).

- `iniciarCron` solo programa en **producción** (`NODE_ENV === 'production'`);
  en desarrollo avisa por consola y sale antes de tocar node-cron y el
  `setTimeout`. **`CRON_EN_DEV=1`** lo fuerza para poder probarlo a mano.
- Tres tests nuevos (`tests/cron-entorno.test.ts`, con node-cron y los tres
  avisos mockeados) fijan las tres ramas: en desarrollo no se programa nada ni
  salta la pasada de arranque, en producción sí, y con `CRON_EN_DEV=1` vuelve.
  Comprobado que fallan si se quita la guarda.
- Corregido el `.env.example`, que daba por hecho que en desarrollo no habría
  SMTP, y anotado en `docs/DESPLIEGUE.md`.

### Dependencias: dos patches al día

`@testing-library/react` 16.3.2 → **16.3.3** y `nodemailer` 9.0.5 → **9.0.6**.
`pnpm update` no los movía (rango cacheado), así que se pidieron por versión.
Efecto secundario a tener en cuenta: pnpm añadió las dos a
`minimumReleaseAgeExclude` en `pnpm-workspace.yaml` — son versiones recientes y
la política de edad mínima del proyecto las habría frenado; esas exclusiones se
pueden retirar cuando las versiones tengan solera.

Los tres *major* siguen fuera a propósito (`@types/node` 26, `eslint` 10,
`typescript` 7). Un dato que conviene no perder: el peer de `eslint-config-next`
16.3.3 ya es `>=9.0.0`, así que **no bloquea formalmente ESLint 10** — lo que
falta por comprobar es el comportamiento de sus plugins, y eso pide una rama
aparte, no colarlo en un commit de gráficas.

### La serie de visitas se agrupa por semanas cuando el rango es largo

Con el rango de 90 días eran 90 barras finísimas. Ahora, **por encima de 45
días la serie se agrupa por semana ISO** (lunes), como hacía `groupBy: week`
del `dailyTrend` original: **14 columnas en vez de 90**, con la serie
renombrada a "Usuarios (semana)" y el tooltip diciendo "Semana del 24 de
Agosto" para que no haya duda de lo que suma cada barra. Con 30 o 7 días sigue
una columna por día, sin tocar nada.

El cambio de diseño que lo hace limpio: `serieDiaria` ya no devuelve valores,
devuelve **los grupos de índices** de cada columna. Así quien la usa suma lo
que quiera (usuarios, vistas, o lo que venga) sin que la función sepa nada de
la forma de sus datos, y el relleno de huecos sigue funcionando igual — un día
sin visitas es un grupo vacío que suma cero.

Cubierto con **15 tests**: los umbrales (45 días por día, 46 por semana), que
las columnas semanales empiezan en lunes, que agrupar no pierde ningún día
(`grupos.flat()` tiene los 90), el texto del tooltip y que se puede forzar el
modo sin depender del umbral.
### Las vistas de página habían desaparecido, y la gráfica de meses ya es pulsable

Dos cosas salieron de repasar qué más aprovechar de los componentes de
Inversiones.

**La regresión**: al migrar la serie de visitas a Chart.js se perdieron las
**vistas de página**. El SVG anterior las ponía en el tooltip ("2 usuarios · 5
vistas") y la versión nueva solo pasaba `activos` como serie, así que el dato
seguía llegando de GA sin verse en ninguna parte. Vuelven al tooltip:
"Martes 25 de Agosto · Usuarios: 4 · Vistas: 16".

Para eso, el tooltip admite ahora **filas que no son series** del gráfico
(`extra` en `GraficaBarras`). ⚠ El callback va en un **WeakMap**, NO dentro de
`options`: Chart.js trata cualquier función que encuentre en las opciones como
*scriptable option*, la invoca para resolver un valor y revienta con "Cannot
convert object to primitive value" — pasó en el primer intento. Un test lo fija.

**La mejora**: `onBarra` estaba portado y sin usar, así que la gráfica de
ingresos y gastos por mes es **pulsable**: clic en la barra de marzo y se abre
marzo, lo mismo que ya hacía su fila en la tabla de al lado. Dos tests cubren
el mapeo (índice 0-11 del eje → mes 1-12) y que sin `onMes` no pasa nada.

**Lo que se descartó a propósito**: pasar los rankings de visitas (Países,
Ciudades, Dispositivos, Navegadores) a barras horizontales con `horizontal` del
componente. Hoy son listas con nombre + valor + barra proporcional, y eso da
MÁS información que un gráfico: el nombre completo se lee siempre. Queda
pendiente, si se quiere, la agrupación **semanal** de `dailyTrend` (13 barras
en vez de 90 en el rango largo), que sí aportaría.
### Las gráficas, a Chart.js (con los componentes de Inversiones)

Las cinco gráficas eran SVG a mano. Ahora van sobre **Chart.js 4**, con los
componentes `CustomBarChart`, `CustomLineChart`, `CustomDonutChart` y
`dailyTrend` del proyecto de Inversiones portados a TypeScript y al tema
oscuro. El motivo no fue técnico —el escalado ya estaba resuelto— sino de
consistencia: los dos proyectos hablan ahora el mismo idioma en las gráficas,
que es la única capa donde se puede (el otro es antd + Bootstrap y este,
Tailwind con componentes propios).

**El coste, medido**: el bundle del cliente pasa de **282 a 343 KB gzip**. Son
~60 KB de la librería y se pagan UNA vez: migrar las cuatro gráficas restantes
después de la primera solo sumó 1 KB, porque Chart.js ya estaba dentro.

Qué hay ahora, en dos capas:

- `src/components/ui/charts/` — `GraficaBarras`, `GraficaLinea`, `GraficaDonut`
  y `comun.ts` (registro **selectivo** de Chart.js; `chart.js/auto` habría
  metido todos los controllers). Del original se conserva lo que ya estaba
  bien resuelto: `animation: false`, deps serializadas para no reinstanciar el
  canvas y `destroy()` en el cleanup.
- Los envoltorios, renombrados **por lo que muestran** y no por su forma:
  `AhorroPorMes`, `AhorroAcumulado`, `MovimientosPorMes` y `VisitasPorDia`. De
  paso desapareció `DonutAhorro`, que era un alias con textos de «ahorro»
  usado en cinco sitios, cuatro sin relación con el ahorro.

**Lo que gana**: el eje de meses de `dailyTrend` en la serie de visitas (a 90
días ahora se lee `Mayo 2026 · Junio · Julio · Agosto` arriba), el relleno de
huecos, y `autoSkip` en lugar de calcular a mano cada cuántos días va una
etiqueta.

**Y las trampas del canvas, que costaron sangre** (quedan documentadas en
CLAUDE.md para no repetirlas):

1. **`var(--token)` se pinta NEGRO.** El donut «Composición del ahorro» salió
   en negro porque sus partes llegan como `var(--primary)`: en SVG funcionaba,
   en canvas no. Ahora todo color pasa por `resolverColor`, con seis tests que
   fijan el invariante (nunca devolver un `var()` sin resolver).
2. **El registro selectivo obliga a acordarse de los elementos.** Faltaba
   `ArcElement` y el donut lanzaba `"arc" is not a registered element`, que
   **tumbaba la página entera**. No lo habrían visto los tests (ahí Chart.js va
   mockeado): lo pilló el navegador.
3. **`autoSkip` se comía la mitad de los meses** en móvil (`Ene, Mar, May…`).
   Se recuperó el comportamiento del SVG con un callback que consulta el ancho
   real del lienzo: por debajo de 420px pinta los doce con su inicial.

**El tooltip es ahora compartido de verdad** (`ui/charts/tooltip.ts`): un solo
div global con `position: fixed` que usan las gráficas **y el mapa de calor de
visitas**. El heatmap **se queda en CSS Grid a propósito** — Chart.js no tiene
tipo matriz (haría falta `chartjs-chart-matrix`), no hay ejes ni escalas que
resolver, y 168 divs con `aria-label` son más accesibles que un canvas. Se le
quitó el `title` nativo para que el navegador no pinte su tooltip gris encima
del propio.

**Los tests de gráficas cambian de naturaleza**: antes medían el `viewBox` del
SVG, que con canvas no existe. Ahora comprueban el CONTRATO que recibe
Chart.js —series, colores del tema, apilado, unidad del tooltip, el callback
que abrevia a `1,5k`, el título en mes largo— más la leyenda del donut, que
sigue siendo HTML.

### Nombres de meses y días: de diez copias a una

Había **diez arrays** de meses repartidos por el proyecto con cinco nombres
distintos (`MESES`, `MESES_CORTOS`, `MESES_LARGOS`, `MESES_CAL`, `MONTHS`) y
dos capitalizaciones, y tres formas diferentes de capitalizar en el momento de
usarlos. Ahora hay una sola fuente, `src/lib/fechas.ts`, con los nombres
completos y con inicial mayúscula (petición de Adrián).

La clave es que **las abreviaturas se derivan**: `mesCorto` son las tres
primeras letras de la lista larga y `mesInicial` la primera, así que no pueden
desincronizarse. Sustituido en los diez sitios —las dos gráficas de doce
meses, la tabla «mes a mes», el módulo de ahorro, el panel de Finanzas, los
avisos del inicio, el aviso de meses sin rellenar, el calendario de
`fields.tsx`, la exportación a Excel y el contenido de la landing— y de paso
cayó el helper `capitalizar`, que solo existía porque los meses estaban en
minúscula.
### El panel de control en móvil

Las cuatro pestañas y sus dos modales a 375px. Casi todo estaba bien: la barra
de pestañas scrollea **solo en horizontal** (387px de contenido en 343, sin el
scroll vertical de 1px que se arregló en su día), la gráfica de visitas pinta a
escala 1, el mapa de calor de 169 celdas no desborda, y los modales de invitar
(343×324) y de tarea de mantenimiento (343×420) caben enteros con sus campos a
301px.

- **El selector de rango de visitas (7 / 30 / 90 días) medía 24px de alto**, y
  es el control que más se toca de esa pestaña: `py-2` en móvil lo deja en 32,
  igual que antes desde `sm`.

### El historial de una oportunidad podía quedarse "Cargando…" para siempre

Salió revisando el pipeline en móvil. La actividad de una oportunidad se pide
al abrir su detalle (no viaja con el tablero) y, **si esa carga fallaba, la
sección se quedaba en "Cargando…" indefinidamente**: el toast del error
desaparecía a los segundos y no quedaba ninguna forma de reintentar sin cerrar
y volver a abrir el modal. Ahora muestra "No se pudo cargar la actividad" con
un botón **Reintentar**.

Va con seis tests nuevos (`tests/pipeline-timeline.dom.test.tsx`) que cubren los
tres estados —cargando, con eventos, error—, que el reintento vuelve a pedir la
actividad y la pinta, y que los cambios de estado (los que apunta el sistema)
no ofrecen botón de borrado. El timeline solo se puede verificar así: sin
sesión no se renderiza, y es justo lo que hacía falta para provocar el fallo.

- **"Próxima acción" ocupaba media fila (145px) en el modal**, y es texto libre
  ("Enviar la propuesta revisada"): en móvil pasa a lo ancho, con la fecha de
  seguimiento debajo. Desde `sm`, las dos siguen en una fila. La pareja
  "Origen + Importe" se queda a medias, que ahí sí caben.
- El botón **Reintentar** nació con 16px de alto; `py-2` lo deja en 32.

Lo demás del pipeline en móvil estaba correcto: el tablero no se renderiza (se
trabaja desde Tabla), las métricas y las tarjetas caben sin desborde, el
Histórico lista las archivadas con su fecha de cierre y su importe, y los
botones de icono ya miden 34px.

### Finanzas en móvil: el repaso de los detalles pequeños

Recorrido completo del módulo a 375px (las tres secciones, sus pestañas y los
dos modales). El modo privado sale activo por defecto y enmascara también los
importes de los modales ("Objetivo ••••"), y ningún scroller se desmadra.
Cuatro arreglos, todos del mismo tipo: cosas que en móvil no se leen o no se
pueden tocar bien.

- **El enlace "Ir a gastos" se partía en dos líneas**, con la flecha suelta
  debajo: el título largo de esa cabecera ("En qué se va el dinero en Agosto")
  lo comprimía a 72px. Con `min-w-0` en el título y `shrink-0` +
  `whitespace-nowrap` en el enlace, los dos enlaces gemelos del panel miden ya
  lo mismo (27px de alto, una línea).
- **Los nombres de categoría se cortaban en el modal de gestión** — cuatro de
  diecinueve ("Comer fuera / Café…", "Móvil y teléfo…") — y ahí hay que poder
  leer qué categoría se edita o se borra. En móvil el contador de usos baja a
  su propia línea y el nombre se ve entero.
- **Los botones de icono medían 30×30.** En móvil van de tres en tres por fila
  (Excel / Editar / Eliminar) y uno de ellos borra: `max-sm:p-2.5` los deja en
  34px. Aplicado a los cuatro `btnIcon` del dashboard (finanzas, pipeline,
  mantenimiento y usuarios).
- **El ✕ de los modales medía 28×28**, y es el control con el que se sale en
  móvil: pasa a 36.

### Repaso de la landing, el login y la privacidad

Las tres páginas públicas a 375, 753 y 1425px. La landing no necesitó ningún
cambio: sin porcentajes (el cambio de formato no la toca), radios coherentes
(retratos 30px con su marco alineado, tarjetas de caso 18px) y las capturas de
los proyectos las recorta la tarjeta con su `overflow: hidden`, así que sus
esquinas cuadradas no asoman. Login y privacidad, un arreglo:

- **"Volver al portfolio" tenía 20px de zona táctil** en las dos páginas (es un
  enlace de texto y el único control secundario de ambas). Con `py-2` sube a
  36px sin cambiar el aspecto ni el espaciado total (el margen superior se
  compensa). Los enlaces de correo dentro de los párrafos se dejan como están:
  ampliarlos rompería el interlineado del texto corrido.

Dos comprobaciones que NO eran fallos, aunque lo parecían:

- **El banner de cookies no aparece en local** y GA no carga, con
  `NEXT_PUBLIC_GA_ID` presente en `.env` y React hidratando bien (verificado por
  `__reactFiber$`, sin errores). La variable está declarada **vacía** con un
  comentario al lado: sin ID no se renderiza nada, que es el comportamiento
  documentado. En producción, donde se hornea con valor, el banner sale.
- **El botón "Cambiar mi elección de cookies"** se pinta siempre, también sin
  GA. Se deja así: en producción siempre hay GA, y condicionarlo dejaría la
  sección 7 de la política con su texto y sin botón.

### Repaso del panel de control

Las cuatro pestañas a 375 y 1150px. Servidor estaba impecable (12 tarjetas en
tres columnas, nada recortado) y Usuarios también (en móvil la tabla pasa a
tarjetas). Dos arreglos:

- **La gráfica de visitas escalaba ×1,38** (lienzo de 760 pintado en 1045px):
  el mismo defecto de las otras tres. Con esto, las **cuatro gráficas del
  dashboard** miden ya su hueco y se pintan a escala 1,000 — así que el hook
  `useAncho` se saca a `src/components/ui/use-ancho.ts` (lo usaban finanzas,
  gastos y ahora el panel; importarlo del módulo de ahorro ya no tenía
  sentido). Cae otra pareja de variantes por breakpoint.
- **Las notas de mantenimiento se cortaban en móvil**, y la nota ES la
  instrucción de la tarea: con `line-clamp-2` se perdía entre un tercio y la
  mitad del texto en 5 de 6 tareas ("Un backup no probado no es un backup:
  restaur…"), sin `title` ni forma de leerlo salvo abrir la edición. En
  escritorio no se cortaba ninguna, así que el clamp se retira solo en móvil:
  la lista crece de 824 a 1005px y no se pierde una palabra.

### Repaso del pipeline: los seguimientos no se leían

Con siete oportunidades en el tablero salió que **el chip de seguimiento se
cortaba en todas las tarjetas**: en una columna de 211px el chip tiene ~130px y
la fecha completa ("23/08/2026 · ") se comía el sitio, así que la acción —lo
único accionable— nunca se llegaba a leer. Lo mismo en la vista Tabla, donde la
columna de 245px cortaba dos de ocho filas.

Ahora el chip pone **la urgencia primero, en lenguaje natural, y la acción
debajo**: "venció hace 4 días / Enviar la propuesta revisada", con la fecha
exacta en el `title`. El helper `cuandoSeguimiento` es compartido por el
tablero y la tabla (misma lectura en las dos vistas) y lleva cuatro tests, con
el cruce de mes incluido.

- **El botón de confirmar un borrado medía 27×24px en móvil.** Aparece ocho
  veces en el dashboard (pipeline, gastos, años, mantenimiento, usuarios) y
  siempre confirma algo destructivo: pasa a 35×32 en móvil, igual en escritorio.
  Lo que ya estaba bien resuelto: al pedir confirmación, el "Sí" sale a la
  IZQUIERDA y bajo el punto que se acaba de tocar queda *Cancelar*, así que un
  clic duplicado (como los que produce el visor móvil) cancela, no borra.
- Verificado también: el tablero **no se renderiza en móvil** (se trabaja desde
  Tabla, con su selector de estado de 144×38), el Histórico lista las
  archivadas con su fecha de cierre, y las métricas cuadran (40.200 € abiertos,
  5 abiertas, cierre medio de 26 días).

**Porcentajes unificados con espacio, como prescribe la RAE** ("67 %"): la
app mezclaba las dos formas —el panel de control y el pipeline con espacio,
finanzas sin él—. Ahora van los 26 con espacio **irrompible** (el que usa
`Intl` en es-ES), así que la cifra y el símbolo no se separan nunca en un salto
de línea. En finanzas lo centraliza `pct()`, que pasa a formatear con `Intl` en
vez de concatenar; los KPIs de la vista de año y los desgloses también lo usan
ya. Tres tests fijan el formato (espacio presente, irrompible y sin decimales)
para que no vuelva a divergir.

De paso salió **una cuarta tasa de ahorro** que se había quedado fuera de la
corrección del denominador: la del bloque de KPIs de la vista de año la
calculaba a mano sin los extras, así que podía pasar del 100% igual que las
otras. Ahora comparte fórmula y formato con el resto.

### Repaso del panel de finanzas y del inicio

Las rejillas y las tarjetas estaban bien a 375 y 1150px (cuatro KPIs en fila,
bloques gemelos de 543×298, cero desborde), y el modo privado también: los
importes llegan **ya difuminados desde el servidor**, sin el flash que sospeché.
Tres cosas sí salieron:

- **Un aviso del inicio se cortaba en su propio título.** En móvil el hueco es
  de ~250px y `truncate` dejaba "2 seguimientos del pipeline venci…", que es
  justo lo primero que hay que leer. Ahora título y detalle se reparten en dos
  líneas en móvil (el aviso pasa de 63 a 102px de alto) y siguen con ellipsis
  desde `sm`.
- **"Ingresos de Agosto · 32 movimientos apuntados"** contaba TODOS los
  movimientos del mes, no los ingresos: bajo ese título se leía como 32
  ingresos cuando eran 3. Ahora cuenta solo los de su tipo.
- **El panel listaba las doce categorías de gasto**, con la tarjeta a 568px de
  alto en móvil. Un panel es un resumen: van las **cinco principales y el resto
  agrupado** ("Otras 7 categorías"), que baja la tarjeta a 456px sin perder el
  total ni los porcentajes (48+20+8+5+4+15 = 100). El desglose completo sigue
  entero en la sección Gastos, a un clic.

Para poder revisar la franja de avisos y el KPI del pipeline, que en local
estaban a cero: **siete oportunidades inventadas** (dos con el seguimiento
vencido, tres abiertas, una cerrada y una descartada → 40.200 € de pipeline
abierto y el aviso de seguimientos). Se borran con
`DELETE FROM opportunity WHERE origin = 'Datos de prueba';`.

### La tasa de ahorro podía pasar del 100%

Salió al revisar el Resumen con dos años en la base: 2026 marcaba **101%**, que
es imposible. La fórmula sumaba los ingresos extraordinarios al ahorro (lo son)
pero no a los ingresos (también lo son), así que el numerador crecía sin que el
denominador se enterara. Ahora los extras cuentan en **ambos lados**, en la
tasa de cada año y en la histórica del pie de tabla: 2025 pasa de 41% a 35%,
2026 de 101% a 79% y el total a 51%. Un test nuevo fija el límite (un año en
que todo lo ingresado se ahorra da 100%, nunca más).

### Las dos gráficas del ahorro, también a escala 1:1

El mismo tratamiento que las barras de Gastos, porque tenían el mismo defecto:
«Ahorro por mes» pintaba su lienzo de 760 en 1053px (**escala 1,39**) y «Ahorro
acumulado por año» en 1068 (**1,41**), agrandando sus fuentes un 40%. Las dos
miden ahora su hueco con el hook compartido `useAncho` y se pintan a **escala
1,000** (verificado a 375 y 1135px), apretándose solas por debajo de 420px — lo
que retira otra pareja de variantes por breakpoint y el `min-w-140` que las
hacía scrollear en móvil.

Dos ajustes que vinieron con esto:

- **La gráfica de acumulado se adapta al número de años.** Con dos años pintaba
  una línea de mil píxeles entre dos puntos pegados a los bordes; ahora el
  lienzo crece ~200px por tramo hasta el hueco disponible y el dibujo queda
  centrado (288px con dos años).
- **La vista de un año vuelve a emparejarse desde `lg`.** Se había dejado en
  `xl` justo porque la gráfica mensual se encogía al emparejar; ya no aplica.
  A 1135px: tabla de 667px y gráfica de 635px a escala 1, en vez de una tabla
  de 12×4 estirada a 1085px.

Para poder revisarlo con datos: **2025 de ahorro relleno** (12 meses cerrados,
dos pagas extra, una devolución y dos viajes → 8.805 € sobre un objetivo de
9.500). Se borra con `DELETE FROM saving_year WHERE year = 2025;` (las filas
hijas caen por cascada).

### Editar un movimiento desde el móvil (desbordaba la página)

Repaso de la vista de mes tras los cambios de la gráfica. Todo lo demás salió
bien (32 movimientos con las cuatro columnas alineadas a 375, 753, 1135 y
1410px; desgloses gemelos sin romper línea), pero **la edición de una fila
nunca se había adaptado al móvil**: sus seis campos son `shrink-0` y suman
609px, así que en 309px de fila **desbordaban la página 234px** y el concepto
quedaba en un hueco de 22px.

Ahora la fila en edición se apila igual que el alta: tipo, concepto y categoría
a lo ancho, fecha e importe a mitades, y **Guardar / Cancelar como botones de
40px con texto** (dos iconos de 30px para confirmar una edición eran poco).
Desde `sm` sigue siendo la fila compacta de una sola línea.

De paso, **las flechas ▲▼ del importe** medían 16×14px en móvil: impulsables
con el pulgar y fáciles de tocar sin querer al ir al campo. Suben a 24×18 en
móvil y se quedan igual desde `sm`.

### La gráfica del año mide su hueco y pinta a escala 1:1

«Mes a mes» a todo el ancho y las barras **en su propia fila**, también a todo
el ancho (como se pidió). Lo que hacía falta para que eso se viera bien es que
la gráfica dejara de estirar un lienzo fijo: un SVG de 520px con `w-full`
escala TODO con él, y a 1085px la fuente de 10,5 se pintaba a 21px.

Ahora un `ResizeObserver` mide el hueco y el lienzo se genera con ese ancho
exacto, así que **la escala es 1,000 a cualquier ancho** (medido a 375, 753,
1135 y 1425px: fuente real 11,5px y barras de 22px en todos). El alto crece
con el ancho (200–260px) y por debajo de 420px sigue la variante apretada
(iniciales de mes, eje en "1,5k"). Se cayeron con esto las dos variantes por
breakpoint y todos los `max-w` de emergencia.

Detalles que costaron un par de vueltas:

- **La medida no puede depender solo del observer.** Un `ResizeObserver` solo
  avisa cuando el navegador vuelve a componer, y hay contextos (una pestaña de
  fondo, un panel oculto) donde ese aviso no llega nunca: la gráfica se quedaba
  **en blanco**. Ahora se mide de forma síncrona al montar y el observer (más
  el evento `resize`) solo sirve para los cambios posteriores.
- **Ni `width` fijo en píxeles.** Con `width={W}` la gráfica no encogía al
  estrechar la ventana y **desbordaba la página 406px**. Con `w-full` sobre el
  lienzo medido no puede desbordar, y un tope de `max-height` hace que una
  medida que se quedara vieja se pinte a su tamaño **centrada** en vez de
  estirarse (un lienzo de 309 en 1053px llegaba a escalar ×3,4).
- **Cuatro tests nuevos** (`tests/gastos-grafica.dom.test.tsx`) cubren las dos
  vías de medida —la síncrona del montaje y el aviso del observer, que repinta
  a `0 0 640 200`—, la variante apretada y el hueco reservado antes de la
  primera medida. El navegador de pruebas no entrega avisos de
  `ResizeObserver`, así que esa parte solo se puede verificar así.

### El breakpoint estaba mal puesto: `xl` llegaba demasiado tarde

La causa real de "la tabla ocupa todo el ancho y la gráfica debajo también".
Las parejas y las rejillas de KPIs del dashboard se formaban desde `xl`
(1280px), así que **en una ventana de 1150px nada se emparejaba**: «Mes a mes»
se estiraba a 1085px y la gráfica pintaba su lienzo de 520 en 1053px —
**escala ×2, fuente de 21px y barras enormes**.

- Las rejillas del módulo pasan a `lg` (1024px), que es exactamente donde ya
  caben: a 1024px la gráfica queda a **escala 0,99** (1:1) y a 1150px a 1,14,
  con la tabla en 444px y los desgloses en dos tarjetas de 536px.
- **Por debajo de `lg`, apiladas, ambas limitan su contenido**: la gráfica no
  pasa de 640px (escala 1,23) y la tabla de 672px. Estirarse a todo lo ancho
  era justamente lo que se veía mal.
- **La vista de años se queda en `xl` a propósito**: su columna de 15fr solo
  da 600px en `lg` y la gráfica mensual (lienzo de 760) se encogería a 0,79 —
  ahí apilada a todo lo ancho se ve mejor que emparejada y pequeña.

Comprobado a 375, 760, 1000, 1024 y 1150px: sin desborde de página ni scroll
interno en ninguno.

### La vista de mes, aguantando un mes de verdad (32 movimientos)

Con once movimientos al mes todo parecía correcto; con treinta y dos —lo que
tiene un mes real— salieron tres cosas:

- **El desglose rompía la línea.** En una tarjeta de 566px, la leyenda de doce
  categorías (481px en dos columnas) no cabía junto al donut y flex-wrap la
  tiraba **debajo**: esa tarjeta se iba a 345px de alto mientras su hermana
  (tres categorías) medía 176, una con la gráfica arriba y la otra al lado.
  Ahora el donut y la leyenda van **siempre al lado** (leyenda a una sola
  columna, filas más apretadas a partir de ocho categorías, nombres largos con
  ellipsis y su nombre completo en el título) y **solo se apilan en móvil**.
  Las dos tarjetas miden ya lo mismo (352px) y el desglose corto **centra su
  donut** en vez de dejarlo pegado arriba.
- **La categoría zigzagueaba.** Iba pegada al importe, así que su posición
  dependía del largo del concepto: en 32 filas, 19 posiciones distintas. Con
  anchos fijos desde `sm` todas las columnas caen en la misma vertical
  (fecha · concepto · categoría · importe).
- **En móvil se perdían conceptos.** Con ~120px para el concepto, cinco de los
  treinta y dos se cortaban ("Reparación del portáti…"). Ahora en móvil el
  concepto se reparte en **dos líneas** (la fila crece a 58px solo cuando hace
  falta) y desde `sm` sigue con ellipsis.

### Las gráficas de Gastos, revisadas con un año entero de datos

Con doce meses rellenos salieron a la luz cosas que con dos movimientos no se
veían:

- **"Ingresos y gastos por mes"** pintaba un lienzo de 760px en una columna de
  629 (escala 0,83): el navegador encogía la fuente de 10,5px a **8,7px reales**
  y las barras a 14px. Ahora el lienzo mide 520 y hay **dos variantes**: la de
  escritorio (escala 1,21 → fuente real 12,7px) y una **compacta para móvil**
  (340×180, iniciales de mes, eje abreviado "1,5k") que cabe entera en 375px
  sin scroll interno.
- **Los donuts perdían las porciones pequeñas.** La separación entre arcos era
  fija (1,2% de la circunferencia), así que una categoría del 1% se restaba a
  sí misma y desaparecía: con trece categorías de gasto había arcos
  invisibles. Ahora el hueco se **reduce a partir de seis partes** y todo arco
  tiene un **mínimo de 1,5px** — una propina junto a la nómina (0,5% frente al
  99%) se sigue viendo.
- **Leyenda a dos columnas** desde ocho categorías: con trece crecía en una
  sola tira interminable.
- Los donuts reutilizados en Gastos anunciaban "Composición del ahorro anual"
  a los lectores de pantalla; ahora cada uno lleva **su propio título**.
- **"0% frente a…" ya no se pinta de color.** Repetir el mismo gasto (o cobrar
  la misma nómina) que el mes anterior salía en rojo o verde según el signo de
  un cero; ahora dice "igual que el mes anterior", en gris.

### Radios: fuera los valores arbitrarios

Había dieciséis `rounded-[Npx]` repartidos por el proyecto. Los seis con
equivalente EXACTO en la escala del tema pasaron a su clase (`rounded` = 4px,
`rounded-lg` = 10px, `rounded-2xl` = 18px) — ojo, aquí `rounded-lg` son **10px**,
no los 8 de Tailwind por defecto, porque `globals.css` redefine la escala sobre
`--radius: 0.625rem`.

Los otros diez se alinearon a la clase más próxima: los siete de 3px (los
cuadraditos de color de las leyendas) a `rounded-xs` (2px) y el de 5px a
`rounded-sm` (6px). Para los retratos de la landing, que estaban en 30px, se
añadió **un paso más a la escala** (`--radius-5xl`, `--radius` × 3 = 30px) en
lugar de bajarlos a los 26 de `4xl`: se querían en 30 y así el valor deja de
ser arbitrario. El marco decorativo y la foto siguen compartiendo radio exacto,
que era el riesgo del cambio.

### La versión de pnpm, fijada en `package.json`

Añadido `"packageManager": "pnpm@11.10.0"`, el campo estándar que Corepack lee
para activar esa versión exacta. pnpm no puede ser una dependencia del
proyecto —es justamente quien lee el `package.json`—, así que su versión solo
estaba escrita en el `Dockerfile` (`npm install -g pnpm@11.10.0`): en local
dependía de lo que tuviera instalada la máquina. Ahora los dos entornos
declaran la misma, y al actualizar pnpm hay que subir el número en ambos.

### Dependencias al día (solo patch y minor)

Aplicado lo compatible que sacó `pnpm deps`: **Next 16.3.3** (con
`eslint-config-next` a la par, van siempre juntas), **Prisma 7.10.0** (los tres
paquetes + `prisma generate`), **lucide-react 1.34.0** y `@types/react-dom`
19.2.5. Comprobado con los 177 tests, lint y build.

**pnpm, a 11.24.0 en los tres sitios que hay que mover juntos**: el binario
global de la máquina (`pnpm self-update 11.24.0` — está instalado en modo
standalone, no por npm), el campo `packageManager` y el `Dockerfile`. Ojo al
orden: mientras el campo declare una versión, pnpm la respeta y se descarga esa
aunque el global sea otro, así que actualizar solo el global no cambia nada
dentro del proyecto. El lockfile no se tocó ("Already up to date").

**Fuera a propósito**: los *major* (`eslint` 10, `typescript` 7, `@types/node`
26), que piden revisión propia.

`pnpm audit` deja una moderada: `uuid <11.1.1` que entra por `exceljs`
(GHSA-w5hq-g745-h8pq). **No aplica aquí** — el fallo está en el bounds check de
`v3/v5/v6` cuando se les pasa un `buf`, y exceljs solo llama a `v4()` sin
argumentos. Se deja sin override para no arriesgar el export a Excel por una
vulnerabilidad que el código no puede alcanzar.

---

## 26/08/2026

### La tabla "mes a mes" del año, legible

Tenía dos problemas a la vez: en escritorio se estiraba a 1150px (cuatro
cifras cortas repartidas por toda la pantalla, con el ojo viajando de columna
a columna) y en móvil scrolleaba en horizontal. Ahora **comparte fila con la
gráfica de barras** (`xl:grid-cols-[5fr_7fr]`: tabla ~470px, gráfica ~630px,
que es quien agradece el ancho) y en móvil **cabe entera sin scroll** (341px)
con los meses abreviados (Ene, Feb…), padding y texto más ajustados.

### Apuntar un gasto, pensado para el móvil

El módulo se va a usar sobre todo desde el teléfono, así que el alta se
rediseñó para el pulgar en vez de encoger la fila de escritorio:

- **El formulario va arriba**, antes de la lista: en el móvil se apunta sobre
  la marcha y bajar hasta el final para encontrarlo no valía.
- **Apilado en cinco filas claras**: tipo como **segmentado Gasto/Ingreso**
  (con su color: rojo/verde — para algo binario un select sobra), concepto a
  lo ancho, importe y fecha compartiendo fila, categoría a lo ancho, y el
  botón **"Añadir gasto" / "Añadir ingreso"** a ancho completo y con texto
  (antes era un "+" de 36px). Desde `sm`, la fila compacta de siempre.
- **La fecha viene con hoy** cuando se está viendo el mes en curso (antes
  proponía el día 1 del mes, que casi nunca es lo que quieres).
- Alturas de target táctil igualadas (~40px en los controles del alta).

### Finanzas en tres secciones, con panel principal

La barra de Finanzas mezclaba conceptos: "Resumen" era del ahorro, los años
también, y "Gastos" era otro mundo entero colgando del mismo nivel. Ahora la
navegación tiene dos niveles:

- **Panel** (`/app/finance`, por defecto): lo importante de las dos secciones
  en una pantalla — cuatro cifras (ahorro del año con su barra de objetivo,
  ingresos, gastos y balance del mes en curso, con comparativa), un bloque de
  **ahorro** (ahorrado, objetivo, desvío frente a lo que tocaría hoy,
  proyección a cierre, ritmo y tasa) y otro de **gastos** (el donut de "en qué
  se va el dinero" este mes). Cada bloque enlaza a su sección.
- **Ahorro** (`?s=ahorro`): sus pestañas propias (Resumen histórico + un tab
  por año) y «Gestionar años».
- **Gastos** (`?s=gastos`): el mes o el año, con «Gestionar categorías».

El ojo del modo privado vive en la barra de secciones, así que vale para las
tres. Componentes: `FinanzasNav` + `AhorroTabs` en `finanzas-tabs.tsx` y el
panel nuevo en `panel-finanzas.tsx`; la página orquesta las tres secciones
con un componente async por cada una.

### 💸 Control de gastos e ingresos: el módulo que faltaba

La feature estrella del backlog, cerrada — y alineada con el Excel "Control de
gastos" de Adrián, que se revisó para copiar su semántica: no es solo gastos,
es un **libro de movimientos** donde cada apunte es un **ingreso o un gasto**.

**Modelo**: los movimientos tienen **fecha propia** (no cuelgan del año de
ahorro) porque son un flujo continuo, así el mes se deriva de la fecha y no
hace falta que el año exista. Las **categorías son libres y propias de cada
tipo** (a un ingreso no se le ofrece "Supermercado"); la migración
`control_de_gastos` siembra las 19 del Excel — 15 de gasto y 4 de ingreso.
Borrar una categoría **no borra sus movimientos**: quedan "sin categoría" (FK
con SET NULL), porque el historial del dinero no se tira.

- **Vista del mes** (`?mes=2026-08`), navegable: KPIs de **ingresos, gastos,
  balance y gasto medio al día**, con comparativa contra el mes anterior y el
  color puesto donde toca (subir ingresos es bueno, subir gastos no); lista de
  movimientos con signo (+/−), edición inline y alta rápida de una línea
  (tipo · concepto · categoría · fecha · importe); y los **dos desgloses** del
  Excel en donut: "En qué se va el dinero" y "De dónde viene el dinero".
- **Vista del año** (`&vista=anio`): ingresos, gastos, balance y gasto medio
  al mes (que, como el Excel, solo cuenta los meses con algo apuntado), tabla
  **mes a mes** con su balance y cada mes clicable, gráfica de barras
  ingresos/gastos por mes, y los desgloses de todo el año.
- **Modal "Gestionar categorías"**: las dos listas separadas, con crear,
  renombrar, recolorear (paleta de 8) y borrar, mostrando cuántos movimientos
  usa cada una. El nombre solo debe ser único dentro de su tipo, así "Regalos"
  puede existir como gasto y como ingreso.
- **"Gastos del mes" del inicio ya tiene dato real** (llevaba desde el
  lanzamiento en "En desarrollo") y enlaza al mes en curso; respeta el modo
  privado como el resto de importes.
- Con tests (173 en total): saneado y whitelist de tipos en las actions,
  duplicados de categoría por tipo, colores inválidos, y la capa de datos del
  mes y del año (rangos con cruce de año, balance, media diaria y desgloses).

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
  (Reabierto y hecho el 31/08/2026 a petición: notas con formato en el Panel.)
- **Redis para sesiones**: se eligió tabla MySQL (una pieza menos que
  operar; la escala no lo justifica).
