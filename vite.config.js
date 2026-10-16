import { defineConfig } from 'vite';

// Served from https://nyenz.github.io/portfolio/
export default defineConfig({
  base: '/portfolio/',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
