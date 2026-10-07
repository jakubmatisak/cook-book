import type { VitePWAOptions } from 'vite-plugin-pwa'

const DAY = 60 * 60 * 24

/** Konfigurácia PWA (manifest + service worker), samostatne kvôli testom. */
export const pwaOptions: Partial<VitePWAOptions> = {
  // Nová verzia sa po vydaní nainštaluje sama a aplikácia sa znova načíta. Service worker registruje src/main.ts,
  // ktorý novú verziu hľadá aj pri každom návrate do aplikácie (src/lib/pwaUpdates.ts).
  registerType: 'autoUpdate',
  injectRegister: false,
  // Celá aplikácia je za Cloudflare Access: bez cookies by Access manifest presmeroval na prihlásenie
  // a prehliadač by aplikáciu neponúkol na inštaláciu (<link rel="manifest" crossorigin="use-credentials">).
  useCredentials: true,
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
    // API, obrázky, prihlásenie Cloudflare Access a relogin nesmú dostať index.html zo service workera.
    navigateFallbackDenylist: [/^\/api\//, /^\/img\//, /^\/cdn-cgi\//, /^\/auth\//],
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    cleanupOutdatedCaches: true,
    // Nová verzia hneď prevezme otvorené okná (spolu so skipWaiting z autoUpdate).
    skipWaiting: true,
    clientsClaim: true,
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
          // Len skutočné odpovede API, nikdy HTML (napr. prihlasovacia stránka).
          cacheableResponse: { statuses: [200], headers: { 'content-type': 'application/json' } },
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
}
