import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
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
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192x192.svg', 'pwa-512x512.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'هم‌پول | HamPool',
        short_name: 'HamPool',
        description: 'مدیریت و تسویه آسان هزینه‌های مشترک گروهی',
        theme_color: '#059669',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        dir: 'rtl',
        lang: 'fa',
        icons: [
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/maskable-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/ws\//,
          /^\/media\//,
          /^\/static\//,
          /^\/admin\//,
          /^\/health\//,
        ],
        runtimeCaching: [
          // Never cache API or WebSocket requests (security: never cache tokens or private financial responses)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.startsWith('/ws'),
            handler: 'NetworkOnly',
          },
          // Cache self-hosted fonts
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'hampool-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          // Cache icons and images
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hampool-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('axios') || id.includes('zod') || id.includes('react-hook-form')) {
              return 'vendor-forms';
            }
          }
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
