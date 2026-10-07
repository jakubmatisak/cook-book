import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './styles/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { queryPluginOptions } from './plugins/query'
import { createAppVuetify } from './plugins/vuetify'
import { router } from './router'
import { reloadOnNavigation, watchForUpdates } from './lib/pwaUpdates'

createApp(App)
  .use(i18n)
  .use(createAppVuetify())
  .use(router)
  .use(VueQueryPlugin, queryPluginOptions())
  .mount('#app')

// Service worker (offline a inštalácia). Po vydaní novej verzie sa aplikácia aktualizuje sama; nová verzia sa
// načíta pri najbližšom prechode na inú stránku, nie uprostred ťukania (klik by sa stratil).
const updates = reloadOnNavigation(router)
registerSW({
  immediate: true,
  onNeedReload: () => updates.markReady(),
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration)
  },
})
