# Tareas pendientes

**adrianosuna.com está en producción desde el 25/08/2026.** Aquí vive solo lo
pendiente, por horizontes: cuando algo se termina, se documenta bien contado
en `CHANGELOG.md` y se retira de aquí.

> **Flujo de actualización en producción** (cada vez que se suba un commit):
> `cd /var/www/adrian-osuna-portfolio && git pull && docker compose --env-file
> .env.production build && docker compose --env-file .env.production up -d`
> Con migraciones nuevas: el build lleva `--profile setup` (si no, la imagen
> de `migrate` no se reconstruye) y se ejecuta `migrate` antes del `up` — ver
> "Actualizaciones" en DESPLIEGUE.md.

---

## 1 · Pendiente de desplegar

- [ ] **Producción va por detrás desde el 26/08/2026**: sin desplegar están
      el commit del modo privado / inicio como centro de mando / KPIs del
      Resumen (ya subido) y todo el trabajo del 26-27/08 — el **módulo de
      gastos e ingresos**, Finanzas en tres secciones, las cuatro gráficas
      midiendo su hueco, la tasa de ahorro corregida, los porcentajes con
      espacio y el repaso móvil de todo el dashboard.
      Al desplegar hay **migración nueva** (`control_de_gastos`, con el seed
      de las 19 categorías: 15 de gasto y 4 de ingreso) → build con
      `--profile setup` + paso `migrate` antes del `up`.
- [ ] **Datos de prueba en la BD LOCAL** (no afectan a producción, que arranca
      vacía). Cuando dejen de hacer falta:
      ```sql
      DELETE FROM expense;                                   -- 155 movimientos de 2026
      DELETE FROM saving_year WHERE year = 2025;              -- año de ahorro inventado
      DELETE FROM opportunity WHERE origin = 'Datos de prueba'; -- 7 oportunidades (y sus eventos, por cascada)
      ```

## 2 · Operación recurrente (una vez al mes, 10 min)

- [ ] `pnpm deps` + `pnpm audit` en local; actualizar lo que toque y redesplegar.
      Dependencias retenidas a propósito (revisar si ya se pueden subir):
      - **eslint 10** — bloqueado hasta que `eslint-config-next` actualice sus
        plugins (`eslint-plugin-react` usa APIs eliminadas).
      - **TypeScript 7** — esperar al soporte de `typescript-eslint` (≥7.1).
      - **`@types/node`** — solo al cambiar el Node del sistema (hoy Node 24).
      - **next-auth** — fijado en `5.0.0-beta.32`; vigilar cuándo sale de beta.
- [ ] Vistazo a **GA4** (visitas, orígenes) y **Search Console** (búsquedas,
      indexación, errores de rastreo).
- [ ] Vistazo a los backups (`ls -lh ~/backups/`) y al estado de los
      contenedores (`docker compose ps` — db healthy, web up).

## 3 · Backlog (sin prisa, por orden sugerido)

- [ ] **Ajustar la fecha de la tarea "Renovar dominio"** a su caducidad real
      en OVH (Panel de control → Mantenimiento → editar la tarea). Solo puede
      hacerlo Adrián.
- [ ] **Dato real para los casos de estudio**: si algún día hay una cifra
      publicable de Client360 o IntarLAB (usuarios, cálculos, ensayos/mes),
      añadirla a "El resultado" del caso — multiplica la fuerza del cierre.

Los descartes razonados (CSP con nonces, rate limit en Caddy, monitorización
externa, módulo de notas...) están documentados en `CHANGELOG.md` para no
reabrirlos sin motivo.
