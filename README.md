<div align="center">

# Portfolio & Dashboard — Adrián Osuna

**Portfolio profesional orientado a casos de estudio + dashboard interno de gestión (finanzas personales, usuarios y administración), en un único proyecto full-stack.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-8B5CF6)](https://authjs.dev)
[![Docker](https://img.shields.io/badge/Docker-multi--stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

🌐 [adrianosuna.com](https://adrianosuna.com)

</div>

---

## ✨ Características

**Landing pública** (`/`)
- **Proyectos como casos de estudio** — cada uno con *reto → qué construí → resultado*, captura y enlaces a demo en vivo y código
- Hero con posicionamiento y cifras calculadas en vivo (años de experiencia y de liderazgo, siempre al día)
- Tema oscuro único con paleta esmeralda/teal propia; navbar transparente que gana fondo con blur al hacer scroll
- Animaciones de revelado al hacer scroll, respetando `prefers-reduced-motion`
- SEO completo: metadata y Open Graph (imagen generada en build), JSON-LD `Person` + `WebSite`, sitemap y robots
- **Google Analytics 4 con consentimiento previo (RGPD)**: ni un script se carga sin aceptación, con [política de privacidad](https://adrianosuna.com/privacidad) y retirada del consentimiento en un clic

**Dashboard interno** (`/app`)
- 💶 **Finanzas** (personal del admin) — sistema de ahorro anual: control mensual editable, ingresos extraordinarios, gastos de viaje, objetivo anual con progreso, KPIs y gráficas SVG propias (sin librerías de charts)
- 👥 **Usuarios** — allowlist con roles: invitar por correo, activar/bloquear, eliminar
- 🔐 **Acceso solo con Google** por lista de invitados; revocación de sesión inmediata

## 🏗️ Arquitectura

```mermaid
flowchart LR
    subgraph Público
        L["Landing /"]
        PR["/privacidad"]
        LG["Login /login"]
    end
    subgraph "Dashboard /app (protegido)"
        H["Home"]
        F["Finanzas · admin"]
        U["Usuarios · admin"]
    end
    A["Auth.js v5<br/>Google + allowlist"]
    SA["Server Actions"]
    P["Prisma 7<br/>driver adapter MariaDB"]
    DB[("MySQL")]

    LG --> A
    A --> H
    H --> F & U
    F & U --> SA
    SA --> P
    A --> P
    P --> DB
    L -. "consentimiento" .-> PR
```

- **App Router** con server components: los datos se leen en el servidor y las mutaciones van por **server actions** con validación de sesión/rol, devolviendo siempre `{ ok, message? }`. Al cliente solo llegan mensajes de error controlados (`AppError`); las excepciones internas se registran en servidor.
- **Autenticación** con Auth.js v5 (JWT, 7 días) y verificación del usuario en base de datos **en cada petición**: deshabilitar a un usuario corta su sesión al instante y los cambios de rol se aplican en vivo. Solo se aceptan correos verificados por Google.
- **Dos sistemas de diseño** conviven vía CSS custom properties sobre un tema único oscuro: paleta esmeralda/teal para las páginas públicas (`.pf-public`) y paleta azul para el dashboard.
- **Base de datos** MySQL con Prisma 7 (driver adapter de MariaDB): convención `id` autoincremental + `uuid` de negocio, FKs por `uuid` y timestamps automáticos.
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
| `pnpm lint` | ESLint |
| `pnpm deps` | Lista dependencias desactualizadas (`pnpm outdated`) |

## 🐳 Despliegue

Producción corre en contenedores: app Next.js (build standalone multi-stage) +
MySQL propio con volumen persistente para los datos.

```bash
cp .env.production.example .env.production                                      # rellenar valores
docker compose --env-file .env.production build
docker compose --env-file .env.production --profile setup run --rm migrate     # solo la 1.ª vez
docker compose --env-file .env.production up -d                                # → localhost:9443
```

Delante va **Caddy** como proxy inverso (HTTPS automático con Let's Encrypt +
redirecciones 301) apuntando a `localhost:9443`. Guía completa del despliegue
en OVH, del VPS recién contratado a la checklist final:
[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Landing pública
│   ├── privacidad/           # Política de privacidad y cookies
│   ├── login/                # Acceso con Google
│   ├── api/
│   │   └── auth/[...nextauth]/   # Handlers de Auth.js
│   └── app/                  # Dashboard (protegido)
│       ├── finance/          # Ahorro anual + server actions (solo admin)
│       └── system/
│           └── users/        # Gestión de usuarios (admin)
├── components/
│   ├── landing/              # Secciones (casos de estudio), navbar, analytics RGPD
│   └── dashboard/            # TopNav, módulo de ahorro, usuarios
├── lib/
│   ├── landing/content.ts    # Contenido de la landing, fuente única
│   ├── finance.ts            # Capa de datos del módulo de finanzas
│   ├── errors.ts             # AppError: errores aptos para el cliente
│   ├── site.ts               # URL pública del sitio (metadata/SEO)
│   └── prisma.ts             # Singleton de PrismaClient
├── auth.ts                   # Auth.js: Google + allowlist + guardas
└── types/next-auth.d.ts      # Tipos de sesión ampliados
prisma/
├── schema.prisma             # Esquema (User, SavingYear, SavingMonth, …)
├── migrations/0_init/        # Migración baseline
└── seed.ts                   # Asegura el administrador inicial
docs/
├── DESPLIEGUE.md             # Guía de despliegue en OVH (Docker + Caddy)
└── TAREAS.md                 # Tareas pendientes del proyecto
```

## 🔐 Modelo de acceso

El dashboard funciona por **lista de invitados**: un administrador da de alta un
correo desde *Usuarios* (estado `invited`) y esa persona ya puede entrar con su
cuenta de Google — al primer login pasa a `active`. Un correo no invitado o
deshabilitado no puede acceder, aunque su cuenta de Google sea válida. No hay
contraseñas propias: la identidad la verifica Google. El módulo de **Finanzas es
personal del administrador**: los usuarios invitados no lo ven ni pueden tocarlo.

## 🗺️ Roadmap

Las tareas pendientes, detalladas, viven en [docs/TAREAS.md](docs/TAREAS.md).

- [x] Landing orientada a casos de estudio, tema oscuro único
- [x] Autenticación Google + allowlist con roles
- [x] Módulo de finanzas: sistema de ahorro anual (solo admin)
- [x] Gestión de usuarios con allowlist y roles en vivo
- [x] Auditoría de seguridad, SEO y responsividad móvil aplicada
- [x] Google Analytics 4 con consentimiento RGPD y política de privacidad
- [x] Docker: imagen standalone + MySQL en contenedor (ensayado en local)
- [ ] Despliegue en producción (`adrianosuna.com`)
- [ ] Exportación del año de ahorro a Excel
- [ ] Control de gastos (registro por categorías)

## 👤 Autor

**Adrián Osuna** — Desarrollador Full-Stack · Responsable de Desarrollo

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Adrián_Osuna-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/adrián-osuna-albalá)
[![Email](https://img.shields.io/badge/Email-adrianosunaalbala@gmail.com-EA4335?logo=gmail&logoColor=white)](mailto:adrianosunaalbala@gmail.com)
