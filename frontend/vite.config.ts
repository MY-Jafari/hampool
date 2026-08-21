import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const API_TARGET = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000';

const proxyConfig = {
  // REST API → Django (no CORS needed in dev)
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
  // Media (avatars, receipts)
  '/media': {
    target: API_TARGET,
    changeOrigin: true,
  },
  // WebSocket notifications → Django Channels
  '/ws': {
    target: API_TARGET.replace(/^http/, 'ws'),
    ws: true,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 4173,
    proxy: proxyConfig,
  },
});
