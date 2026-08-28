# Tareas pendientes

## Desplegar

Sin subir: **topes de gasto por categoría**, **movimientos recurrentes**, la
**sección Ajustes** (categorías con fusión, recurrentes y años de ahorro) y los
**ámbitos del mantenimiento** (editables: servidor / casa / vehículo y los que
se añadan). **Cinco migraciones nuevas** —`topes_por_categoria`,
`gastos_recurrentes`, `ambitos_de_mantenimiento`, `origen_de_los_movimientos` y
`ambitos_editables`—, así que el build necesita el perfil y el paso `migrate`
antes del `up`:

```bash
cd /var/www/adrian-osuna-portfolio && git pull
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate
docker compose --env-file .env.production up -d
```

Sin dependencias ni variables de entorno nuevas. Procedimiento completo en
`DESPLIEGUE.md` → "Actualizaciones".

⚠ Una vez desplegado, el cron **apuntará movimientos solo** en cuanto haya
recurrentes dados de alta (a las 8:00 y en la pasada de arranque).

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
  externa, módulo de notas) están en `CHANGELOG.md`: no reabrirlos sin motivo.
