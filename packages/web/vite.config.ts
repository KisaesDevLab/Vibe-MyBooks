// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
