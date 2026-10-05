import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import './styles/main.css'
import App from './App.vue'
import { queryPluginOptions } from './plugins/query'
import { createAppVuetify } from './plugins/vuetify'
import { router } from './router'

createApp(App).use(createAppVuetify()).use(router).use(VueQueryPlugin, queryPluginOptions()).mount('#app')
