import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Carpetas de build alternativas (NEXT_DIST_DIR): las usan los e2e y
    // `pnpm build:aislado` para no pisar el `.next` del dev server. Sin esto,
    // ESLint entra a analizar el código generado y saca miles de avisos.
    ".next-*/**",
  ]),
]);

export default eslintConfig;
