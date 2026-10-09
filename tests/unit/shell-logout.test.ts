import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppShell from '@/components/AppShell.vue'
import { NAV_ITEMS } from '@/components/navigation'
import { createAppVuetify } from '@/plugins/vuetify'

// Ako v produkcii za Cloudflare Access: odhlásenie sa ponúka.
vi.mock('@/lib/auth', async (original) => ({
  ...(await original<typeof import('@/lib/auth')>()),
  canLogout: () => true,
}))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mountShell(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } })),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: NAV_ITEMS.map((item) => ({ path: item.to, component: { render: () => h('p', item.titleKey) } })),
  })
  await router.push('/recipes')
  await router.isReady()
  const wrapper = mount(AppShell, {
    global: { plugins: [createAppVuetify(), router, VueQueryPlugin] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('odhlásenie', () => {
  it('nie je v bočnom menu (počítač ani mobil), len v ponuke účtu vpravo hore', async () => {
    for (const width of [1440, 375]) {
      const wrapper = await mountShell(width)
      if (width < 1000) {
        await wrapper.find('[data-menu="open"]').trigger('click')
        await flushPromises()
      }
      expect(document.querySelector('[data-test="nav-logout"]')).toBeNull()
      await wrapper.find('[data-test="account"]').trigger('click')
      await flushPromises()
      expect(document.querySelector('[data-test="logout"]')).not.toBeNull()
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })
})
