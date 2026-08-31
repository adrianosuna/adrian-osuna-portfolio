<div align="center">

# Portfolio & Dashboard — Adrián Osuna

**Portfolio profesional orientado a casos de estudio + dashboard interno de gestión (finanzas personales, pipeline de oportunidades, usuarios y panel de control del servidor), en un único proyecto full-stack.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-8B5CF6)](https://authjs.dev)
[![Vitest](https://img.shields.io/badge/Vitest-322_tests-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

🌐 [adrianosuna.com](https://adrianosuna.com)

</div>

---

## ✨ Características

**Landing pública** (`/`)
- **Proyectos como casos de estudio** — cada uno con *reto → qué construí → resultado*, captura y enlaces a demo en vivo y código
- Hero con posicionamiento y cifras calculadas en vivo (años de experiencia y de liderazgo, siempre al día) con contador animado al entrar en pantalla
- Tema oscuro único con paleta esmeralda/teal propia; navbar transparente que gana fondo con blur al hacer scroll
- Animaciones de revelado al hacer scroll, respetando `prefers-reduced-motion`
- SEO completo: metadata y Open Graph (imagen generada en build), JSON-LD `ProfilePage` con proyectos como `CreativeWork`, sitemap y robots
- **Preparada para buscadores de IA (GEO)**: agentes de IA permitidos explícitamente en robots.txt y `/llms.txt` generado en build desde el contenido real
- **Google Analytics 4 con consentimiento previo (RGPD)**: ni un script se carga sin aceptación, con [política de privacidad](https://adrianosuna.com/privacidad) y retirada del consentimiento en un clic

**Dashboard interno** (`/app`)
- 🧭 **Inicio: centro de mando** — franja de avisos accionables (seguimientos vencidos, mantenimiento, meses de ahorro sin rellenar), KPIs con dato real (ahorro con progreso del objetivo, valor del pipeline abierto y pulso de visitas en streaming) y actividad reciente del pipeline
- 💶 **Finanzas** (personal del admin) — **ahorro anual** y **control de gastos** en cuatro secciones (Panel · Ahorro · Gastos · Ajustes; dentro de Ahorro, el Resumen histórico y un tab por año): control mensual editable, ingresos extraordinarios, gastos de viaje cuyo sobrante engrosa el ahorro, objetivo con desvío frente al día de hoy, **proyección a fin de año a ritmo actual**, tasa de ahorro, donut de composición y gráficas sobre **Chart.js** con los tokens del tema. La pestaña **Gastos** es un libro de movimientos (ingresos y gastos) con vista de mes y de año: balance, gasto medio, alta rápida, categorías libres por tipo, **topes de gasto** con aviso por correo al 80 % y al pasarse, **movimientos recurrentes** que el cron apunta solos (alquiler, suscripciones, nómina…) y los desgloses de "en qué se va" y "de dónde viene" el dinero. **Ajustes** reúne toda la configuración del módulo: categorías (fusionar, tope, color automático), recurrentes y años de ahorro. Exportación del año a **Excel**, recordatorio por correo si un mes se queda sin rellenar
- 📊 **Oportunidades** (admin) — mini-CRM del pipeline: kanban con drag&drop en escritorio (vista de tabla en móvil), seguimientos con fecha y **aviso por correo al vencer**, historial de actividad por tarjeta, métricas del embudo y archivo con histórico
- 🖥️ **Panel de control** (admin) — cuatro pestañas: **Servidor** (SSL, latencia pública, MySQL a fondo, backups, disco y recursos en vivo), **Visitas** (GA4 vía Data API: tiempo real, comparativas, conversiones, geografía, mapa horario…), **Usuarios** (allowlist + **sesiones activas con cierre remoto**) y **Mantenimiento** (tareas recurrentes por ámbito editable —servidor, casa, vehículo…— con aviso por correo)
- ⏰ **Cron interno** (node-cron): cada día apunta los **movimientos recurrentes** que vencen y avisa por correo — mantenimiento vencido, seguimientos del pipeline, meses de ahorro sin rellenar y topes de gasto alcanzados — con plantilla propia y reaviso semanal
- 🔐 **Acceso solo con Google** por lista de invitados; registro de sesiones con revocación inmediata

## 🏗️ Arquitectura

```mermaid
flowchart LR
    subgraph Público
        L["Landing /"]
        LT["/llms.txt · robots"]
        LG["Login /login"]
    end
    subgraph "Dashboard /app (protegido)"
        H["Home"]
        F["Finanzas"]
        O["Oportunidades"]
        PC["Panel de control"]
    end
    A["Auth.js v5<br/>Google + allowlist + sesiones"]
    SA["Server Actions"]
    P["Prisma 7<br/>driver adapter MariaDB"]
    DB[("MySQL")]
    CR["Cron interno<br/>avisos por correo"]
    GA["GA4 Data API"]

    LG --> A
    A --> H
    H --> F & O & PC
    F & O & PC --> SA
    SA --> P
    A --> P
    P --> DB
    CR --> P
    PC --> GA
```

- **App Router** con server components: los datos se leen en el servidor y las mutaciones van por **server actions** con validación de sesión/rol, devolviendo siempre `{ ok, message? }`. Al cliente solo llegan mensajes de error controlados (`AppError`); las excepciones internas se registran en servidor.
- **Autenticación** con Auth.js v5 (JWT, 7 días) y verificación del usuario **y de su sesión registrada** en base de datos en cada petición: deshabilitar a un usuario o cerrar su sesión desde el panel corta el acceso al instante, y los cambios de rol se aplican en vivo. Solo se aceptan correos verificados por Google.
- **Cron interno** arrancado por `instrumentation.ts` (node-cron, diario a las 8:00 Europe/Madrid): apunta los movimientos recurrentes vencidos y manda cuatro avisos por correo (nodemailer, plantilla email-safe propia); sin SMTP los avisos quedan inactivos, pero los recurrentes se siguen apuntando.
- **Un solo sistema de diseño** vía CSS custom properties sobre un tema único oscuro, con componentes propios: campos de formulario custom (número, select y calendario con popover en portal) y modal común con cabecera y pie fijos.
- **Base de datos** MySQL con Prisma 7 (driver adapter de MariaDB): convención `id` autoincremental + `uuid` de negocio, FKs por `uuid`, timestamps automáticos y migraciones generadas con `migrate diff` (schema a schema).
- **Tests** (Vitest, 322 sin BD ni red): fórmulas de finanzas, proyecciones, aritmética de meses (meses cortos, febrero, cruce de año), topes y recurrentes, color automático de categorías, parsers de GA contra API simulada, guardas de todas las server actions, callbacks de auth, umbrales del monitor, avisos del cron, superficies GEO, exportación a Excel y componentes de UI en jsdom.
- **Seguridad**: headers HTTP (HSTS, X-Frame-Options, CSP, nosniff), errores internos nunca expuestos al cliente y solo correos verificados por Google en el login.

## 🚀 Puesta en marcha (desarrollo)

**Requisitos:** Node 20+, pnpm 9+ y un MySQL accesible.

```bash
# 1. Dependencias
pnpm install

# 2. Configuración
cp .env.example .env        # rellena los valores (ver tabla)

# 3. Cliente de base de datos
pnpm prisma generate

# 4. Solo si partes de una BD vacía: crear tablas y administrador inicial
pnpm prisma migrate deploy
pnpm prisma db seed

# 5. A desarrollar
pnpm dev                     # → http://localhost:9444
```

### Variables de entorno (desarrollo)

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Conexión MySQL — `mysql://user:pass@host:3306/database` |
| `ADMIN_EMAIL` | Correo asegurado como administrador activo por el seed |
| `AUTH_SECRET` | Secreto de sesión de Auth.js — genera uno con `npx auth secret` |
| `AUTH_GOOGLE_ID` | Client ID del cliente OAuth de Google (tipo *Aplicación web*) |
| `AUTH_GOOGLE_SECRET` | Client secret de ese mismo cliente |
| `NEXT_PUBLIC_GA_ID` | Opcional: ID de medición GA4; activa la analítica y el banner de cookies |
| `GA_PROPERTY_ID` + `GA_SA_*` | Opcional: service account con acceso Lector a GA4 — activa la pestaña Visitas |
| `SMTP_*` + `ALERT_EMAIL` | Opcional: SMTP para los avisos por correo del cron — sin ellos queda inactivo |

Las variables de producción (URLs públicas, contraseñas del MySQL en contenedor)
viven en `.env.production` — ver [.env.production.example](.env.production.example).

> [!IMPORTANT]
> El cliente OAuth de Google debe tener autorizada la redirect URI
> `http://localhost:9444/api/auth/callback/google` (y la equivalente del dominio en producción).

### Scripts

| Comando | Acción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo en el puerto 9444 (Turbopack) |
| `pnpm build` | Build de producción con type-check |
| `pnpm start` | Sirve el build de producción en el puerto 9443 |
| `pnpm test` | Tests unitarios de la lógica crítica (Vitest, sin BD ni red) |
| `pnpm lint` | ESLint |
| `pnpm deps` | Lista dependencias desactualizadas (`pnpm outdated`) |

## 🐳 Despliegue

Producción corre en contenedores: app Next.js (build standalone multi-stage) +
MySQL propio con volumen persistente para los datos y un servicio `migrate`
one-shot que aplica migraciones y seed.

```bash
cp .env.production.example .env.production                                      # rellenar valores
docker compose --env-file .env.production build
docker compose --env-file .env.production --profile setup run --rm migrate     # 1.ª vez y tras migraciones
docker compose --env-file .env.production up -d                                # → localhost:9443
```

Delante va **Caddy** como proxy inverso (HTTPS automático con Let's Encrypt +
redirecciones 301) apuntando a `localhost:9443`. Guía completa del despliegue
en OVH — del VPS recién contratado a los backups diarios subidos a Google
Drive con rclone: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Landing pública
│   ├── privacidad/           # Política de privacidad y cookies
│   ├── login/                # Acceso con Google
│   ├── llms.txt/             # Superficie GEO para buscadores de IA
│   ├── api/auth/[...nextauth]/   # Handlers de Auth.js
│   └── app/                  # Dashboard (protegido)
│       ├── finance/          # Ahorro anual + gastos + actions + export a Excel
│       ├── pipeline/         # Oportunidades (mini-CRM) + actions
│       └── panel/            # Panel de control (4 pestañas) + actions
├── components/
│   ├── landing/              # Secciones (casos de estudio), navbar, analytics RGPD
│   ├── dashboard/            # TopNav, inicio + módulos: savings/, pipeline/, panel/, users/
│   └── ui/                   # Campos custom, modal común y charts/ (Chart.js)
├── lib/
│   ├── landing/content.ts    # Contenido de la landing, fuente única
│   ├── inicio.ts             # Datos del centro de mando (avisos, KPIs, actividad)
│   ├── finance.ts            # Datos del ahorro + recordatorio de mes sin rellenar
│   ├── gastos.ts             # Movimientos: mes, año, categorías, recurrentes
│   ├── topes.ts              # Topes de gasto por categoría (puro, compartido)
│   ├── recurrentes.ts        # Fechas y cifras de los recurrentes (puro)
│   ├── colores.ts            # Color automático de categorías, sin repetir
│   ├── pipeline.ts           # Métricas del embudo + aviso de seguimientos
│   ├── mantenimiento.ts      # Tareas por ámbito + aviso de vencidas
│   ├── fechas.ts             # Meses, días y aritmética de meses (fuente única)
│   ├── cron.ts               # Planificador interno (node-cron)
│   ├── correo.ts             # SMTP + plantilla email-safe de la casa
│   ├── ga.ts                 # GA4 Data API (JWT firmado a mano, sin SDK)
│   ├── infra.ts              # Monitor del servidor (SSL, BD, disco, recursos)
│   ├── errors.ts             # AppError: los únicos errores que ve el cliente
│   └── prisma.ts             # Singleton de PrismaClient
├── instrumentation.ts        # Arranque del cron (una vez por proceso)
├── auth.ts                   # Auth.js: Google + allowlist + sesiones + guardas
└── types/next-auth.d.ts      # Tipos de sesión ampliados
prisma/
├── schema.prisma             # Esquema (User, SavingYear, Opportunity, Expense, …)
├── migrations/               # Baseline 0_init + migraciones (migrate diff)
└── seed.ts                   # Asegura el administrador inicial
tests/                        # 322 tests (Vitest; jsdom para componentes)
docs/
├── DESPLIEGUE.md             # Guía de despliegue en OVH (Docker + Caddy + rclone)
├── CHANGELOG.md              # Historial de lo hecho, bien contado
└── TAREAS.md                 # Tareas pendientes del proyecto
```

La documentación del proyecto vive en `docs/`: la guía de
[despliegue](docs/DESPLIEGUE.md), el [historial de cambios](docs/CHANGELOG.md)
y las [tareas pendientes](docs/TAREAS.md).

## 🔐 Modelo de acceso

El dashboard funciona por **lista de invitados**: un administrador da de alta un
correo desde el Panel de control (estado `invited`) y esa persona ya puede entrar
con su cuenta de Google — al primer login pasa a `active`. Un correo no invitado o
deshabilitado no puede acceder, aunque su cuenta de Google sea válida. No hay
contraseñas propias: la identidad la verifica Google. Cada login queda registrado
como **sesión activa** (dispositivo y última actividad) y puede **cerrarse
remotamente** desde el panel. Los módulos de **Finanzas, Oportunidades y Panel de
control son personales del administrador**: los usuarios invitados no los ven.

## 👤 Autor

**Adrián Osuna** — Desarrollador Full-Stack

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Adrián_Osuna-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/adrián-osuna-albalá)
[![Email](https://img.shields.io/badge/Email-adrianosunaalbala@gmail.com-EA4335?logo=gmail&logoColor=white)](mailto:adrianosunaalbala@gmail.com)
