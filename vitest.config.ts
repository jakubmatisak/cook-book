import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
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
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/unit/setup.ts'],
          server: { deps: { inline: ['vuetify'] } },
        },
      },
    ],
  },
})
