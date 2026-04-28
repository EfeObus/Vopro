import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Same-origin `/api/*` → Rails so the browser never runs CORS preflight in dev.
    // Pair with `VITE_API_BASE_URL=` (empty) in .env — see .env.example.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Each page is lazy-loaded in App.tsx, but heavy shared deps still want
    // to be split out so they're cached independently and don't bloat the
    // initial entry chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts', 'd3-array', 'd3-color', 'd3-format', 'd3-scale', 'd3-shape', 'd3-time', 'd3-time-format'],
          icons: ['lucide-react'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
