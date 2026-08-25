import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: {
    externalTables: true,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
  // La tabla `migrations` pertenece a db-migrate (Portfolio viejo, misma BD):
  // Prisma no debe gestionarla ni incluirla en diffs/migraciones.
  tables: {
    external: ["migrations"],
  },
});
