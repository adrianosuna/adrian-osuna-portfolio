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
  // La tabla `migrations` es una huérfana de db-migrate en la BD local: Prisma no debe
  // gestionarla. Si se hace DROP TABLE, retirar esto y `experimental.externalTables`.
  tables: {
    external: ["migrations"],
  },
});
