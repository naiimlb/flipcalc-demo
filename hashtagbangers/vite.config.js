import { defineConfig } from 'vite';

// base relative : le build marche aussi bien à la racine que dans un sous-dossier (GitHub Pages).
export default defineConfig({
  base: './',
  server: { host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
