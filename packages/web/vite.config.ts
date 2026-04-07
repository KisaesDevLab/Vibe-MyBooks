import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
