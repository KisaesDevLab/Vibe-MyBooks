// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vitest runs both unit + component-render tests. jsdom is needed for
  // the React Testing Library suite (DOM APIs, window, fetch). Pure-helper
  // tests (money, date) run identically under jsdom — the overhead is ~100ms
  // per file, acceptable for our suite size.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    // jsdom + recharts + the many-mocked-page tests accumulate heap when
    // tinypool reuses a worker. `pool: 'forks'` with `isolate: true`
    // recycles the worker after each test file so growth is bounded to
    // one file's footprint. execArgv raises the Node heap as headroom
    // for the heavier page-render files — NODE_OPTIONS / .npmrc don't
    // reliably propagate into tinypool-spawned forks, execArgv does.
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: true,
        execArgv: ['--max-old-space-size=4096'],
      },
    },
  },
  // Split the bundle so first-load doesn't ship every vendor lib in one
  // 2MB blob. Heavy libs (react-pdf, html2canvas, react-hot-toast, the
  // AI markdown renderer, etc.) go in their own chunk and are cached
  // independently. The chart library (recharts) is also large and lazy
  // enough to split. Without this every route shares one giant
  // assets/index-*.js and the "Some chunks are larger than 500 kB"
  // warning fires on every build.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          pdf: ['jspdf', 'jspdf-autotable'],
          webauthn: ['@simplewebauthn/browser'],
          stripe: ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          plaid: ['react-plaid-link'],
          qr: ['qrcode'],
        },
      },
    },
  },
  server: {
    host: true,
    port: parseInt(process.env.VITE_PORT || '5173'),
    // Windows host -> Linux container bind mounts don't deliver inotify events,
    // so Vite's watcher misses file changes. Polling is the reliable fallback.
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || `http://localhost:${process.env.PORT || '3001'}`,
        changeOrigin: true,
      },
    },
  },
});
