import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { cloudflare } from '@cloudflare/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { pwaOptions } from './pwa.config'
import { siteUrlPlugin } from './siteUrl.config'

const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
).version

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    vue(),
    vuetify({ autoImport: true, styles: { configFile: 'src/design/settings.scss' } }),
    cloudflare(),
    VitePWA(pwaOptions),
    siteUrlPlugin(process.env.SITE_URL ?? loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL),
  ],
  server: { port: 5180, strictPort: true },
  preview: { port: 5181, strictPort: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
}))
