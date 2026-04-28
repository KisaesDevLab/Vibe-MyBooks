// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Subpath deployment: ONE image serves any prefix.
  //
  // The bundle is built with the sentinel `/__VIBE_BASE_PATH__/` baked into
  // every absolute asset URL, every `import.meta.env.BASE_URL` reference,
  // and every React Router basename. The web container's
  // /docker-entrypoint.d/40-base-path.sh runs at startup, reads the
  // VITE_BASE_PATH env var (default `/`), and `sed -i` replaces the
  // sentinel across html/js/css/json/map files BEFORE nginx starts.
  //
  // single-app: VITE_BASE_PATH=/        → assets at /assets/...
  // multi-app : VITE_BASE_PATH=/mybooks/ → assets at /mybooks/assets/...
  //
  // No rebuild required to switch modes — same image, two URLs.
  // (Same pattern as Vibe TB; see deploy/web-entrypoint.sh in that repo.)
  base: command === 'serve' ? '/' : '/__VIBE_BASE_PATH__/',
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
    // The main chunk lands around ~590 KB minified (≈62 KB gzipped)
    // after the manualChunks + route-lazy splits below. The default
    // 500 KB Vite warning threshold would fire on every build even
    // though gzipped first-load cost is small. We hold the line at
    // 600 KB so legitimate regressions (e.g., a new eager import that
    // pulls a heavy lib into the main bundle) still trip the warning.
    chunkSizeWarningLimit: 600,
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
}));
