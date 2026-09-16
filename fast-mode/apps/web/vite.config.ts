import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  publicDir: false,
  plugins: [
    preact({
      resolveModuleFormat: false,
    }),
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
  },
  worker: {
    format: 'es',
  },
  server: {
    allowedHosts: ['dev.linkto.host'],
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    modulePreload: false,
  },
});
