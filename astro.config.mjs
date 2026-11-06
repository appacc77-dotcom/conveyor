import { defineConfig } from 'astro/config';

const dshUrl = process.env.DSH_URL ?? 'http://127.0.0.1:57686';

export default defineConfig({
  build: {
    format: 'file',
  },
  devToolbar: {
    enabled: false,
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  vite: {
    server: {
      proxy: {
        '/kanban': {
          target: dshUrl,
          changeOrigin: true,
        },
      },
    },
  },
});
