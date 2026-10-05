import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'
import AppShell from '@/components/AppShell.vue'
import { NAV_ITEMS } from '@/components/navigation'
import { createAppVuetify } from '@/plugins/vuetify'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

async function mountShell(width: number) {
  setViewport(width)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: NAV_ITEMS.map((item) => ({ path: item.to, component: { render: () => h('p', item.title) } })),
  })
  await router.push('/recepty')
  await router.isReady()
  const wrapper = mount(AppShell, {
    global: { plugins: [createAppVuetify(), router] },
    slots: { default: () => h('div', { 'data-test': 'content' }, 'obsah stránky') },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppShell', () => {
  it('na mobile ukáže spodnú navigáciu so štyrmi položkami', async () => {
    const wrapper = await mountShell(375)
    const nav = wrapper.find('[data-test="bottom-nav"]')
    expect(nav.exists()).toBe(true)
    expect(wrapper.find('[data-test="side-rail"]').exists()).toBe(false)
    expect(nav.findAll('[data-test="nav-item"]').map((i) => i.text())).toEqual([
      'Recepty',
      'Plán',
      'Nákup',
      'Viac',
    ])
  })

  it('na desktope ukáže bočnú lištu namiesto spodnej navigácie', async () => {
    const wrapper = await mountShell(1440)
    const rail = wrapper.find('[data-test="side-rail"]')
    expect(rail.exists()).toBe(true)
    expect(wrapper.find('[data-test="bottom-nav"]').exists()).toBe(false)
    expect(rail.findAll('[data-test="nav-item"]').map((i) => i.text())).toEqual([
      'Recepty',
      'Plán',
      'Nákup',
      'Viac',
    ])
  })

  it('vyrenderuje obsah stránky', async () => {
    const wrapper = await mountShell(375)
    expect(wrapper.find('[data-test="content"]').text()).toBe('obsah stránky')
  })
})
