# Tareas pendientes

Aquí vive solo lo pendiente. Al cerrar algo, se cuenta bien en `CHANGELOG.md` y
se retira de aquí.

Lo **recurrente** (dependencias, backups, GA4, dominio) no va en este fichero:
vive en el módulo de **Mantenimiento** del Panel de control, que vence las
tareas solo y avisa por correo desde el cron.

## Desplegar

Producción va por detrás desde el **26/08/2026**. Sin subir: el módulo de gastos
e ingresos, Finanzas en tres secciones, la tasa de ahorro corregida, el repaso
móvil del dashboard y las gráficas sobre Chart.js.

Este despliegue lleva **migración nueva** (`control_de_gastos`, con el seed de
19 categorías), así que el build necesita el perfil y el paso `migrate` antes
del `up`:

```bash
cd /var/www/adrian-osuna-portfolio && git pull
docker compose --env-file .env.production --profile setup build
docker compose --env-file .env.production --profile setup run --rm migrate
docker compose --env-file .env.production up -d
```

También hay **dependencia nueva** (`chart.js`); el build la instala solo.
Procedimiento completo en `DESPLIEGUE.md`.

## Limpiar la BD local

Datos inventados para revisar las pantallas. No afectan a producción, que
arranca vacía.

```sql
DELETE FROM expense;                                      -- 155 movimientos de 2026
DELETE FROM saving_year WHERE year = 2025;                -- año de ahorro inventado
DELETE FROM opportunity WHERE origin = 'Datos de prueba'; -- 7 oportunidades (+ sus eventos)
```

---

Los descartes razonados (CSP con nonces, rate limit en Caddy, monitorización
externa, módulo de notas) están en `CHANGELOG.md`: no reabrirlos sin motivo.
