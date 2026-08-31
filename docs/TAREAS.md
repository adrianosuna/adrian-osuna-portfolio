# Tareas pendientes

## Desplegar

Sin subir: **topes de gasto por categoría**, **movimientos recurrentes**, la
**sección Ajustes** (categorías con fusión, recurrentes y años de ahorro), los
**ámbitos del mantenimiento** (editables: servidor / casa / vehículo y los que
se añadan) y las **notas del Panel** (editor visual, HTML saneado). **Seis
migraciones nuevas** —`topes_por_categoria`, `gastos_recurrentes`,
`ambitos_de_mantenimiento`, `origen_de_los_movimientos`, `ambitos_editables` y
`notas_y_unicidad` (tabla `note` + los índices únicos de la auditoría)—, así que
el build necesita el perfil y el paso `migrate` antes del `up`:

```bash
cd /var/www/adrian-osuna-portfolio && git pull
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate
docker compose --env-file .env.production up -d
```

Una dependencia nueva (**`sanitize-html`**, para las notas), que el
`pnpm install` del build instala sola desde el lockfile; sin variables de
entorno nuevas. Procedimiento completo en `DESPLIEGUE.md` → "Actualizaciones".

Las seis están **aplicadas en la BD local** (`migrate status`: al día, sin
drift). En producción siguen pendientes: van con el paso `migrate` de arriba.

⚠ Una vez desplegado, el cron **apuntará movimientos solo** en cuanto haya
recurrentes dados de alta (a las 8:00 y en la pasada de arranque).

## De la auditoría del 28/08/2026

Repaso completo (seguridad, código, dependencias y despliegue): nada crítico y
ningún agujero de autorización. Esto es lo que quedó pendiente, de más a menos
importante. Nada corre prisa.

### Endurecimiento

Los cinco puntos originales están **hechos** (ver `CHANGELOG.md`, 31/08). Queda
uno nuevo, que salió al pasar de nuevo el `pnpm audit`:

- [ ] **Subir `mariadb` a `>=3.5.1`** (vía `@prisma/adapter-mariadb`): tres
      avisos nuevos publicados estos días —fuga de la contraseña en claro ante
      un MitM pese a `ssl:true` (alto), transmisión en claro, e inyección SQL en
      el escape de parámetros Buffer bajo charsets big5/gbk/sjis/cp932/gb18030.
      **Para este despliegue el riesgo real es bajo**: la BD va por la red
      interna de Docker (el MitM no aplica) y todo es utf8mb4 (la inyección
      tampoco). Lo que frena el override es que el adapter **fija la versión
      exacta 3.4.5**, no un rango: forzar 3.5.1 es meter una versión que Prisma
      no probó, y no se puede validar sin ejercitar la BD. Lo suyo es esperar a
      que Prisma suba el pin, o hacer el override con una prueba de conexión
      real. No es el `uuid`, que era inofensivo de cambiar.

### Operación en el VPS

Healthcheck de `web`, techo a los logs y `.env.example` están **hechos** (ver
`CHANGELOG.md`, 31/08). Queda medio abierto uno:

- [ ] **Fijar el `mem_limit` de `db` y `web`**: el bloque está ya en
      `docker-compose.yml` **comentado**, con su cifra por decidir. No se puso a
      ciegas porque un límite por debajo de lo que consume el contenedor provoca
      justo el OOM que se quiere evitar. Solo falta mirar la RAM del VPS
      (`free -m`) y descomentar con un valor que deje aire a los dos.

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
