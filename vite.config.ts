import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

const DAY = 60 * 60 * 24

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: { configFile: 'src/design/settings.scss' } }),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Kuchárska kniha',
        short_name: 'Kniha',
        description: 'Rodinné recepty, týždenný jedálniček a nákupný zoznam.',
        lang: 'sk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FBF7F1',
        theme_color: '#B4532A',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // API, obrázky a prihlasovanie Cloudflare Access nesmú dostať index.html zo service workera.
        navigateFallbackDenylist: [/^\/api\//, /^\/img\//, /^\/cdn-cgi\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/api/v1/') && url.pathname !== '/api/v1/export',
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * DAY },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/img/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'img',
              expiration: { maxEntries: 500, maxAgeSeconds: 365 * DAY },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
