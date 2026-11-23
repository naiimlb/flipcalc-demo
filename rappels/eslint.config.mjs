import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", ".smoke/**"]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Scripts Node (récupération des données, icônes, test de fumée).
    files: ["scripts/**/*.mjs", "public/sw.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
