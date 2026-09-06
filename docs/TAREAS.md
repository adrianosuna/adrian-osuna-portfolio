# Tareas pendientes

> Desplegado en producción el **02/09/2026**: las diez migraciones, la API v1
> para los Atajos, la PWA con push, el endurecimiento (Zod, rate limiting,
> CSP, logs por niveles, salud del contenedor, e2e), los recordatorios
> puntuales, las tablas unificadas y los arreglos de la auditoría de
> accesibilidad. Verificado tras el despliegue: `/api/health` y `/api/ready`
> en 200, la API en 401 sin token, las seis cabeceras aplicadas (CSP ya no en
> report-only) y `/app/*` en 307. El detalle, en `CHANGELOG.md`.

## Antes del próximo despliegue

Lo que trae este despliegue está contado en `CHANGELOG.md` (04 y 05/09): las
categorías de gasto en dos niveles, el calendario del Panel, el mapa de
visitas, el tooltip propio, el atajo de login de desarrollo, los tres findings
de la auditoría externa que tocaban el repo y cuatro repasos de la pestaña
Mantenimiento. Antes de subir:

- [ ] **Aplicar la migración `grupos_de_categorias`** (servicio `migrate` del
      compose, `--profile setup`; ver `DESPLIEGUE.md`). Está ya aplicada en la
      BD local, y unifica las dos que hubo el 04/09 antes de llegar a
      producción. No es destructiva: `parent_uuid` nace NULL e `is_group` en
      false, así que todo lo que hay se queda como **categoría suelta** hasta
      que se agrupe a mano desde Ajustes. Es la ÚNICA migración pendiente.
- [ ] **Comprobar que `DEV_LOGIN_EMAIL` no está en el `.env` del VPS.** El
      atajo de login sin Google tiene dos candados para no poder existir en
      producción (`NODE_ENV` y la variable como opt-in), así que colarla no
      abriría nada — pero no tiene ningún sentido que esté ahí.
- [ ] **Los `mem_limit` del compose ya vienen activos** (`db` 768m, `web`
      512m, con las cifras medidas el 02/09). Si en el VPS los pusiste a mano,
      comprobar que coinciden antes de sobrescribir el fichero.
- [ ] **Pasar los e2e antes de subir** (`pnpm test:e2e`): comprueban las
      cabeceras sobre un build de producción y `next.config.ts` ha cambiado
      (`poweredByHeader`). En la última ejecución: 24 en verde.
- [ ] **Al terminar, marcar los días en el CHANGELOG.** Las cabeceras `##
      04/09/2026` y `## 05/09/2026` pasan a `(en producción)`, como se hizo con
      el 02/09: es lo que distingue de un vistazo lo subido de lo que está solo
      en local. Y retirar de aquí esta sección.

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

- [ ] **Límites y sanitizado de subidas de ficheros**, si algún día se añaden
      adjuntos. Hoy el proyecto **no tiene ninguna subida** —ni formulario, ni
      endpoint, ni almacenamiento—, así que escribirlos ahora sería código
      muerto. Cuando toque, el patrón está: el tope de cuerpo de la API v1
      (`_comun.ts`) y el saneado del HTML de las notas.

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
