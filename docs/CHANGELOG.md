# Changelog

Historial de lo hecho en el proyecto, en orden inverso (lo más reciente
arriba). Funciona en pareja con `TAREAS.md`: allí vive **solo lo pendiente**;
cuando algo se termina, se cuenta aquí con su porqué y desaparece de allí.

---

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
