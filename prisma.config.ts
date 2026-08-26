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
  // La tabla `migrations` es una huérfana de db-migrate (del Portfolio
  // antiguo, ya retirado) que sigue en la BD local: Prisma no debe
  // gestionarla ni incluirla en diffs. Si algún día se hace DROP TABLE,
  // retirar esta declaración (y `experimental.externalTables`).
  tables: {
    external: ["migrations"],
  },
});
