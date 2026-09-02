# Sugerencias

Ideas para el futuro, sin compromiso de hacerlas ni orden fijo — se irán
haciendo poco a poco. Es distinto de `TAREAS.md` y de `CHANGELOG.md`:

- **`SUGERENCIAS.md`** (este): pozo de ideas. Nada aquí está comprometido.
- **`TAREAS.md`**: lo que **sí** se va a hacer (pendiente concreto).
- **`CHANGELOG.md`**: lo ya hecho, con su porqué.

Flujo: cuando una sugerencia se decide, se redacta bien en `TAREAS.md` (con su
encaje técnico) y se marca aquí `[x]`; al terminarla, se cuenta en el CHANGELOG.

Marcas: ⭐ = alto valor recomendado · 🟢 = ya en `TAREAS.md` o parcialmente hecho.

---

## De uso (se nota al usar la app)

### 1 · Finanzas y control de gastos

- [ ] ⭐ **Importar extracto bancario** (CSV/Excel): reglas concepto→categoría
      y detección de duplicados por fecha + importe + concepto. Es el mayor
      ahorro de tecleo del módulo.
- [ ] **Presupuesto mensual global** además de los topes por categoría:
      "llevas 940 € de 1.500 € este mes".
- [ ] **Objetivos de ahorro por meta** (fondo de emergencia, vacaciones), no
      solo el objetivo anual.
- [x] **Etiquetas o nota por movimiento** para dar contexto ("regalo de X").
- [ ] **Adjuntar foto del ticket** a un gasto.
- [x] **Dividir un gasto en varias categorías** (compra mixta super + farmacia).
- [ ] **Marcar movimientos como conciliados** al cuadrar con el banco.
- [ ] **Plantillas de movimiento frecuente** (distinto de los recurrentes
      automáticos: aquí se apunta a mano pero con los campos ya rellenos).
- [ ] **Previsión de cierre de mes**: gasto proyectado según el ritmo + los
      recurrentes que aún caerán.
- [ ] **Alerta de gasto inusual**: un movimiento muy por encima de la media de
      su categoría.

### 2 · Pipeline / oportunidades

- [ ] **Recordatorios configurables por oportunidad** (no solo el seguimiento
      vencido del cron).
- [ ] **Plantillas de seguimiento** (email/mensaje) con copia rápida.
- [ ] **Adjuntos y enlaces** por oportunidad (propuesta, brief).
- [ ] **Canal de origen** (referido / LinkedIn / web) con métricas por canal.
- [ ] **Forecast ponderado** por probabilidad según el estado.
- [ ] **Motivos de descarte** con analítica (precio / no responde / timing).
- [ ] **Vista calendario** de próximas acciones.
- [ ] **Snooze del seguimiento** (posponer una semana en un clic).
- [ ] 🟢 **Convertir a presupuesto/factura al cerrar** (enlaza con Facturación,
      ya apuntada en `TAREAS.md`).
- [ ] **Exportar el historial** de una oportunidad.

### 3 · Panel, mantenimiento y notas

- [x] **Notas: carpetas/etiquetas y fijar (pin)** las importantes.
- [x] **Notas: buscador de texto completo.**
- [x] **Notas: checklist interactivo** (marcar ítems dentro de la nota).
- [ ] **Mantenimiento: adjuntar documento** (póliza, factura de la ITV).
- [ ] **Mantenimiento: coste por tarea** y total anual.
- [x] **Mantenimiento: vista calendario / próximos 12 meses.**
- [x] **Monitor de infraestructura con histórico** (no solo el estado actual).
- [x] **Registro de accesos más rico** (dispositivos, últimos logins).
- [x] **Visitas: páginas más vistas y comparativa de periodos** (si GA lo da).
- [x] **Recordatorios genéricos** no atados a mantenimiento ("renovar dominio").
      → tareas SIN periodicidad («Una vez»), 02/09. Se reutiliza el módulo de
      Mantenimiento en vez de hacer uno nuevo: mismo problema, y así heredan
      calendario, ámbitos y avisos del cron.

### 4 · Productividad transversal

- [x] ⭐ **Deshacer tras borrar** (toast "Deshacer" 5 s) en gastos, oportunidades
      y notas, en lugar de confirmar antes.
- [x] **Búsqueda global unificada** (movimientos + oportunidades + notas) desde
      la paleta ⌘K.
- [x] **Atajos de teclado globales** (g f → Finanzas, n → nueva nota…).
- [x] **Accesos fijados personalizables** en el inicio.
- [x] **Centro de notificaciones in-app** (además del correo).
- [~] **Densidad / modo compacto** de tablas.
      → hecho el 02/09 y **retirado el mismo día**: apretaba las filas de
      todas las tablas y no quedaba estético. No reabrir sin una idea
      distinta (ver `CHANGELOG.md`).
- [x] **Confirmaciones con "no volver a preguntar".**
- [x] **Más acciones en ⌘K** (ir a un mes concreto, abrir una oportunidad por
      nombre).
- [x] **Estado en la URL** para volver justo donde estabas.
- [x] **Aviso "novedades"** ligero al desplegar cambios.

### 5 · Móvil / PWA (iPhone)

- [x] ⭐ **Shortcuts del manifest**: "Nuevo gasto" como acceso directo de la app
      instalada (deep link a la alta rápida).
- [x] **Notificaciones push web** (topes, seguimientos) — en iOS requieren la
      PWA instalada (16.4+).
- [x] **Splash screens de iOS** (apple-touch-startup) para el arranque standalone.
- [x] **Safe-area / notch** afinado en modo pantalla completa.
- [~] **Pull-to-refresh** en las listas.
      → hecho el 02/09 y **retirado** ese mismo día a petición de Adrián:
      no quiere gestos en la plataforma.
- [~] **Gestos** (swipe para editar/borrar en la lista de movimientos).
      → hecho el 02/09 y **retirado** ese mismo día a petición de Adrián.
      Editar y borrar salen del menú «⋯» de la fila. No reabrir.
- [x] **Vista offline básica** (últimos datos cacheados) con service worker.
- [ ] **Compartir un resumen** como imagen desde iOS.
- [x] **Auditoría de tamaños táctiles** (44 px) en todas las acciones.
- [x] **Revisar el zoom de iOS** en todos los inputs (ya casi cubierto con
      `text-base` en `fields.tsx`).

---

## De implementación (técnico / interno)

### 6 · Datos, respaldo e integraciones

- [ ] ⭐ **Copia de seguridad automática de la BD** (dump programado + retención):
      hoy no hay red de seguridad ante un borrado.
- [ ] 🟢 **Exportación global** de todo Finanzas (no solo por año): ampliar el
      `/app/finance/exportar` actual.
- [ ] **Papelera / soft-delete** con retención antes del borrado real.
- [ ] **Registro de auditoría** (quién cambió qué y cuándo) en tablas clave.
- [x] **API / webhook propia mínima** para automatizar con Atajos de iOS o n8n.
      → API v1 con tokens Bearer (02/09). Ver `API.md`.
- [ ] **Integración con Google Calendar** para seguimientos y mantenimiento.
- [ ] **Informes en PDF** (resumen anual, ficha de oportunidad).
- [ ] **Versionado de notas** (histórico de cambios).
- [ ] **Import genérico CSV** reutilizable por varios módulos.
- [ ] **Festivos / calendario** para afinar los avisos del cron.

### 7 · Seguridad y robustez

- [x] **Rate limiting** en el login y en las server actions sensibles.
      → ventana deslizante en memoria (02/09), también en la API v1. No
      contradice el descarte del 28/08, que era el rate limit *en Caddy*.
- [x] **Validación con Zod** en todas las actions (esquemas compartidos).
      → `lib/esquemas.ts` (02/09), compartido con la API v1.
- [ ] **2FA / passkeys** además de Google.
- [x] **"Cerrar todas las sesiones"** y expiración más granular.
      → botón de pánico + dos plazos (tope absoluto e inactividad), 02/09.
- [x] **Cabeceras de seguridad** revisadas (CSP con nonce, HSTS…).
      → CSP completa por tipo de recurso (02/09). Los **nonces siguen
      descartados** y la razón está en el CHANGELOG: lo que aporta la CSP aquí
      es fijar el origen, no bloquear el inline de Next.
- [ ] **Monitor de errores** en producción (Sentry o propio) — hoy solo
      `console.error`.
- [x] **Tests e2e (Playwright)** de los flujos críticos.
      → 23 tests sobre las invariantes visibles desde fuera (02/09). Los flujos
      autenticados NO se cubren: el OAuth de Google no se automatiza sin
      convertirlo en una fuente de falsos rojos.
- [x] 🟢 **Bump `mariadb`** cuando Prisma lo permita.
      → a **3.4.7** (02/09): el parche salió en la misma minor que el pin del
      adapter, así que no hizo falta el salto a 3.5.1. `pnpm audit` en cero.
- [ ] **Límites y sanitizado de subidas** si se añaden adjuntos.
      ⚠ Condicional de verdad: hoy el proyecto **no tiene ninguna subida de
      ficheros** (comprobado el 02/09), así que no hay nada que limitar. Movido
      a `TAREAS.md` para cuando existan adjuntos.
- [x] **Logs estructurados** con niveles.
      → `lib/log.ts`, JSON en producción y `LOG_LEVEL` (02/09).

### 8 · Rendimiento y calidad técnica

- [x] **Paginación / virtualización** en listas largas (búsqueda de movimientos,
      histórico del pipeline).
      → búsqueda paginada en servidor (50/página) y tabla del pipeline por
      tandas (02/09). Dos técnicas distintas y a propósito: el filtro del
      pipeline es de cliente.
- [x] **Índices de BD** para las búsquedas nuevas (`expense.concept`,
      `expense_date`).
      → revisado con `EXPLAIN` (02/09): se añadió
      `idx_opportunity_updated`, y los dos que se pedían **no hacen falta** —
      `LIKE '%x%'` no puede usar un BTREE y `expense_date` ya tiene índice.
- [ ] **Caché por tags** de las consultas del inicio (`revalidateTag`).
- [ ] 🟢 **`mem_limit` en `docker-compose`** (ya en `TAREAS.md`).
- [x] **Healthcheck / readiness** del contenedor web.
      → `/api/health` y `/api/ready`, separados a propósito (02/09).
- [x] **CI**: lint + test + build en cada push (revisar el `ci.yaml`).
      → dos jobs, con `pnpm audit` informativo y los e2e aparte (02/09).
- [x] **Análisis de bundle** (`next build` + analyzer).
      → `pnpm analyze` (02/09).
- [x] **Más Suspense / skeletons** en vistas pesadas.
      → finanzas y pipeline, con esqueletos comunes (02/09).
- [x] **Auditoría de accesibilidad** (axe) de lo nuevo: paleta, modales, búsqueda.
      → axe-core sobre las piezas compartidas, sin violaciones (02/09).
- [x] **Dependencias al día** (`pnpm outdated` periódico).
      → repasadas el 02/09; los **mayores** (eslint 10, TS 7, Prisma 8 RC) pasan
      a `TAREAS.md` como migraciones deliberadas.

---

**Top 5 recomendado para empezar:** importar extracto bancario (1.1), copia de
seguridad de la BD (6.1), deshacer al borrar (4.1), búsqueda global en ⌘K (4.2)
y presupuesto mensual global (1.2).
