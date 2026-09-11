# Tareas pendientes

> Desplegado en producción el **06/09/2026** (commit `c0edace`): las categorías
> de gasto en dos niveles con su migración `grupos_de_categorias`, el
> calendario del Panel, el mapa de visitas, el tooltip propio, el atajo de
> login de desarrollo, los tres findings de la auditoría externa que tocaban el
> repo y los cuatro repasos de la pestaña Mantenimiento. Verificado desde
> fuera: `/api/ready` en 200 (la migración entró y la BD responde), la API en
> 401 sin token, `security.txt` en `text/plain`, el favicon sirviéndose, la CSP
> y HSTS aplicadas y **sin `X-Powered-By`**. Antes, el 02/09: las diez
> migraciones, la API v1, la PWA con push y el endurecimiento. El detalle de
> todo, en `CHANGELOG.md`.

## Antes del próximo despliegue

Pendiente de subir (ver `CHANGELOG.md`): **la tarjeta de recurrentes acotada al
mes** (06/09), del 07/09 **los logs en el Panel** y la **previsión de cierre de
mes**, y del 11/09 **el logo nuevo** en toda la aplicación.

- [ ] **Aplicar la migración `registro_de_eventos`** (la tabla `log_event`).
      Ya aplicada en local; no es destructiva —tabla nueva, no toca ninguna
      existente—. Al llevar migración, el build necesita el perfil:

      ```bash
      git pull
      docker compose --env-file .env.production --profile setup build
      docker compose --env-file .env.production --profile setup run --rm migrate
      docker compose --env-file .env.production up -d
      ```

- [ ] **`LOG_RETENCION_DIAS` es opcional**: sin ponerla son 30 días, que es lo
      que se quiere. Solo hace falta tocarla para acortar o desactivar la purga.
- [ ] **Pasar los e2e antes de subir** (`pnpm test:e2e`). En la última
      ejecución: 24 en verde, pero fue ANTES de estos tres cambios.
- [ ] **Al terminar, marcar los días en el CHANGELOG**: `## 06/09/2026`,
      `## 07/09/2026` y `## 11/09/2026` pasan a `(en producción)`, como los
      anteriores. Es lo que distingue de un vistazo lo subido de lo que está
      solo en local.
- [ ] **Con el logo nuevo, refrescar el icono en el móvil.** iOS y Android se
      guardan el icono al instalar la app: el de la pantalla de inicio seguirá
      siendo el «AO.» viejo hasta que se quite y se vuelva a añadir. El favicon
      del navegador sí se actualiza solo (puede costar un Ctrl+F5).

## Del despliegue del 02/09: una cosa suelta

- [ ] **Crear el primer token de la API** en Panel de control → Usuarios →
      API. Sin él la API v1 no hace nada; el valor se muestra UNA vez. Después,
      montar el Atajo del iPhone con la receta de `API.md`.

## De la auditoría externa del 03/09/2026

Auditoría de caja negra sobre el dominio (ver `CHANGELOG.md`, 04/09): sin
vulnerabilidades explotables. Los tres findings que tocaban el repo ya están
aplicados; **lo que queda es DNS**, en el panel de OVH —donde está el hallazgo
de más impacto del documento—, más un recordatorio en Mantenimiento.

- [ ] **DMARC**, lo prioritario. El dominio **no tiene registro DMARC**, así
      que cualquiera puede falsificar remitentes `@adrianosuna.com` y los
      receptores no tienen política que aplicar. Zona DNS de OVH → entrada
      TXT, subdominio `_dmarc`:
      `v=DMARC1; p=none; rua=mailto:adrianosunaalbala@gmail.com; ruf=mailto:adrianosunaalbala@gmail.com; fo=1; adkim=s; aspf=s`
      Empezar en `p=none` (solo monitoriza y manda informes), y tras una o dos
      semanas leyéndolos endurecer a `p=quarantine` y luego a `p=reject`.
      Comprobar de paso que **DKIM** está activo en el panel: `adkim=s`
      exige alineación estricta.

- [ ] **SPF a `-all`** — hoy es `v=spf1 include:mx.ovh.com ~all` (softfail:
      solo pide "sospechar"). Con `-all` se rechaza.
      ⚠ Solo tras confirmar que **todo** el correo del dominio sale por
      `mx.ovh.com`. Ojo con este proyecto: el remitente de `lib/correo.ts` es
      `SMTP_USER`, así que hoy los avisos del cron **no** salen como
      `@adrianosuna.com` y el `-all` no les afecta; el día que ese usuario sea
      una dirección del dominio enviando por otro SMTP (Gmail, por ejemplo),
      hay que añadir ese proveedor al SPF **antes** o esos correos se
      rechazan.

- [ ] **Registro CAA** para restringir qué CA puede emitir certificados del
      dominio: `adrianosuna.com. CAA 0 issue "letsencrypt.org"`. Barato, mismo
      panel, mismo viaje que los dos de arriba.

- [ ] **Tarea de Mantenimiento para el `Expires` del `security.txt`**: crearla
      en Panel de control → Mantenimiento con vencimiento **antes del
      01/09/2027**. Caducado, el fichero queda inválido según la RFC. Es
      exactamente el problema para el que existe ese módulo, así que no se
      queda en esta lista.

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

Todo cerrado (ver `CHANGELOG.md`): healthcheck de `web`, techo a los logs,
`.env.example` y el **`mem_limit`**, que se fijó el 02/09/2026 con las cifras
reales de `docker stats` en el VPS (`db` 132 MiB → 768m, `web` 141 MiB → 512m)
y que el `docker-compose.yml` del repo ya trae **activo**, no comentado.

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
