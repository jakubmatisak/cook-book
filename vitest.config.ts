import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { fileURLToPath, URL } from 'node:url'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
}

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue(), vuetify({ autoImport: true })],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.ts', 'tests/config/**/*.test.ts'],
          setupFiles: ['tests/unit/setup.ts'],
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
