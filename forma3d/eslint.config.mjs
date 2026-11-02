import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  // public/ : service worker et fichiers statiques ; *.cjs : script de génération des icônes (hors application).
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/**", "scripts/**/*.cjs"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
