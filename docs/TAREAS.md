# Tareas pendientes

Única lista de tareas del proyecto (actualizada 25/08/2026). **El código está
al día**: auditoría de seguridad/SEO/móvil aplicada, reenfoque de la landing
implementado, Google Analytics con consentimiento RGPD funcionando y el
despliegue con Docker ensayado en local con éxito. Lo que queda:

---

## 1 · Lanzamiento en `adrianosuna.com`

### 1.1 Rotar el client secret de Google 🔴

El secret actual se compartió por chat durante el desarrollo: hay que invalidarlo.

- [ ] Google Cloud Console → Credenciales → cliente OAuth → **"Agregar secreto"**,
      copiar el nuevo y **eliminar el antiguo**.
- [ ] Actualizar `AUTH_GOOGLE_SECRET` en los `.env` (desarrollo y producción).
- [ ] En el mismo cliente OAuth, añadir la redirect URI de producción:
      `https://adrianosuna.com/api/auth/callback/google`.
- **Hecho cuando:** el login funciona con el secret nuevo y el viejo está borrado.

### 1.2 Desplegar en el VPS de OVH

Todo el procedimiento (validado en local el 25/08/2026, del VPS recién
contratado a la web publicada con Caddy) está en **[DESPLIEGUE.md](DESPLIEGUE.md)**:
seguirlo de arriba abajo, incluida la checklist de verificación final del §8.

- [ ] Contratar el VPS (Ubuntu 24.04) y apuntar el DNS.
- [ ] Seguir DESPLIEGUE.md hasta completar la checklist del §8.
- [ ] Programar el backup diario de la BD (cron con `mysqldump`, ver la guía).

Recordatorios clave:
- El `.env.production` del servidor se crea desde el example — **no copiar el
  del PC** (es el del ensayo local, con contraseñas de prueba y URLs localhost).
- `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_GA_ID` se hornean en el build: si
  cambian, reconstruir la imagen.
- (Opcional post-lanzamiento) Rate limit por IP en `/api/*`: requiere un build
  de Caddy con el módulo `caddy-ratelimit`. No es bloqueante.

---

## 2 · Necesita material de Adrián (sin fecha)

- [ ] Si algún día hay un dato real de Client360 o IntarLAB (usuarios,
      cálculos, ensayos/mes), añadirlo a "El resultado" de su caso de estudio:
      multiplica la fuerza del cierre.

---

## 3 · Backlog funcional (post-lanzamiento)

- [ ] **Exportar a Excel** el año de ahorro (`/app/finance`) — paridad con el
      proyecto original: route handler + librería xlsx, mismo formato de filas.
- [ ] **Tab de gastos** en Finanzas: registro de movimientos por categorías y
      resumen mensual. Requiere tabla `expense` nueva — ⚠ coordinar con la BD
      compartida (ver CLAUDE.md antes de tocar el esquema).

---

## 4 · Mejoras opcionales

- [ ] **Contador animado** en la franja de cifras al entrar en viewport,
      respetando `prefers-reduced-motion` (baja prioridad).
- [ ] **CSP completa con nonces**: la actual (`object-src`, `base-uri`,
      `frame-ancestors`) es la mínima segura; una con `script-src` exige
      nonces por petición (middleware) y ajustar `img-src` para los avatares
      de Google (`lh3.googleusercontent.com`).

## 5 · Dependencias retenidas (revisar cada uno o dos meses)

`pnpm deps` las lista; están retenidas a propósito, no olvidadas:

- [ ] **eslint 10**: bloqueado hasta que `eslint-config-next` actualice sus
      plugins (`eslint-plugin-react` usa APIs eliminadas en la 10).
- [ ] **TypeScript 7**: el build de Next ya funciona, pero `typescript-eslint`
      lo soportará a partir de la 7.1 — mientras tanto, TS 6.
- [ ] **`@types/node` 26**: corresponde a Node 26; actualizar solo al cambiar
      el Node del sistema (hoy: Node 24 → `@types/node` ^24).
- [ ] **next-auth**: fijado en `5.0.0-beta.32`; vigilar cuándo sale de beta.
