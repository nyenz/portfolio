import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves from /portfolio/; Render serves from the root (BASE=/).
export default defineConfig({
  base: process.env.BASE || '/portfolio/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), squid: resolve(__dirname, 'squid/index.html') } },
  },
});
