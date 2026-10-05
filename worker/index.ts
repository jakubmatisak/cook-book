import { createApp } from './app'

const app = createApp()

/** Cieľ po vypršaní prihlásenia: Access tu vyžiada login, potom pošleme používateľa na úvod. */
const RELOGIN_PATH = '/auth/relogin'

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === RELOGIN_PATH) {
      return new Response(null, {
        status: 302,
        headers: { Location: new URL('/', url).toString(), 'Cache-Control': 'no-store' },
      })
    }
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
