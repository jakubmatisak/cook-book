import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
).version

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue(), vuetify({ autoImport: true })],
        define: { __APP_VERSION__: JSON.stringify(appVersion) },
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.ts', 'tests/config/**/*.test.ts'],
          setupFiles: ['tests/unit/setup.ts'],
          // Stránky s Vuetify sa v plnej sade (jsdom, veľa súborov súbežne) vykresľujú pomaly.
          testTimeout: 20_000,
          server: { deps: { inline: ['vuetify'] } },
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations('./worker/db/migrations'),
                ALLOWED_EMAILS: 'ja@example.com, Manzelka@Example.com ',
                DEV_USER_EMAIL: 'ja@example.com',
                ACCESS_TEAM_DOMAIN: 'test.cloudflareaccess.com',
                ACCESS_AUD: 'test-aud',
              },
            },
          })),
        ],
        resolve: { alias },
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          setupFiles: ['tests/worker/setup.ts'],
        },
      },
    ],
  },
})
