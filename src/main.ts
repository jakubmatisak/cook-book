import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './styles/main.css'
import App from './App.vue'
import { i18n } from './i18n'
import { queryPluginOptions } from './plugins/query'
import { createAppVuetify } from './plugins/vuetify'
import { router } from './router'
import { watchForUpdates } from './lib/pwaUpdates'

createApp(App)
  .use(i18n)
  .use(createAppVuetify())
  .use(router)
  .use(VueQueryPlugin, queryPluginOptions())
  .mount('#app')

// Service worker (offline a inštalácia). Po vydaní novej verzie sa aplikácia sama aktualizuje a znova načíta.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) watchForUpdates(registration)
  },
})
