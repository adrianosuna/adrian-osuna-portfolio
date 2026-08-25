# syntax=docker/dockerfile:1
# Imagen de producción del portfolio (Next.js standalone).
# Build:   docker compose --env-file .env.production build
# Detalle: NEXT_PUBLIC_SITE_URL se hornea en el BUILD (landing, robots y
#          sitemap son estáticos); el resto de variables son de runtime.

FROM node:24-alpine AS base
RUN npm install -g pnpm@11.10.0
WORKDIR /app

# ── Dependencias (capa cacheable) ──────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build ──────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm prisma generate

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV BUILD_STANDALONE=1
# El singleton de Prisma parsea DATABASE_URL al importar (src/lib/prisma.ts):
# el build no conecta a la BD, pero necesita una URL con formato válido.
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN pnpm build

# ── Migraciones y seed (solo se usa con `--profile setup`, ver compose) ────
FROM build AS migrate
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma db seed"]

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9443
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 9443
CMD ["node", "server.js"]
