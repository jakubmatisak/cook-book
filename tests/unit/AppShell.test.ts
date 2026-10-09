import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '@/components/AppShell.vue'
import { NAV_ITEMS } from '@/components/navigation'
import { setActiveHousehold } from '@/lib/household'
import { createAppVuetify } from '@/plugins/vuetify'

const ALL_TITLES = [
  'Prehľad',
  'Recepty',
  'Plán',
  'Nákup',
  'Pri stole',
  'Ingrediencie',
  'Tagy',
  'Špajza',
  'Nastavenia',
]

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

/** Falošné odpovede API: zoznam domácností. */
function stubHouseholds(households: { id: string; name: string; role: 'owner' | 'member' }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(households), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

beforeEach(() => stubHouseholds([{ id: 'a', name: 'Doma', role: 'owner' }]))

async function mountShell(width: number) {
  setViewport(width)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: NAV_ITEMS.map((item) => ({ path: item.to, component: { render: () => h('p', item.titleKey) } })),
  })
  await router.push('/recipes')
  await router.isReady()
  const wrapper = mount(AppShell, {
    global: { plugins: [createAppVuetify(), router, VueQueryPlugin] },
    slots: { default: () => h('div', { 'data-test': 'content' }, 'obsah stránky') },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
  document.body.innerHTML = ''
  localStorage.clear()
})

const navTitles = (wrapper: ReturnType<typeof mount>, container: string) =>
  wrapper
    .find(`[data-test="${container}"]`)
    .findAll('[data-test="nav-item"]')
    .map((i) => i.text())

describe('AppShell', () => {
  it('na desktope má bočné menu so všetkými stránkami a dá sa zbaliť na rail', async () => {
    const wrapper = await mountShell(1440)
    expect(wrapper.find('[data-test="bottom-nav"]').exists()).toBe(false)
    expect(navTitles(wrapper, 'side-nav')).toEqual(ALL_TITLES)

    const drawer = wrapper.find('[data-test="side-nav"]')
    expect(drawer.classes()).not.toContain('v-navigation-drawer--rail')
    await wrapper.find('[data-test="menu-toggle"]').trigger('click')
    await flushPromises()
    expect(drawer.classes()).toContain('v-navigation-drawer--rail')
    expect(localStorage.getItem('kniha:menu-rail')).toBe('1')
  })

  it('na mobile má spodnú navigáciu s hlavnými stránkami a tlačidlo menu otvorí len ostatné (bez duplicít s kartami)', async () => {
    const wrapper = await mountShell(375)
    expect(wrapper.find('[data-test="side-nav"]').exists()).toBe(false)
    expect(navTitles(wrapper, 'bottom-nav')).toEqual(['Prehľad', 'Recepty', 'Plán', 'Nákup', 'Menu'])

    await wrapper.find('[data-test="bottom-nav"] [data-menu="open"]').trigger('click')
    await flushPromises()
    expect(navTitles(wrapper, 'mobile-nav')).toEqual(ALL_TITLES.slice(4))
  })

  it('vyrenderuje obsah stránky', async () => {
    const wrapper = await mountShell(375)
    expect(wrapper.find('[data-test="content"]').text()).toBe('obsah stránky')
  })

  it('na desktope využije obsah šírku obrazovky, na ultraširokom monitore najviac Full HD (1920 px)', async () => {
    const wrapper = await mountShell(1920)
    const container = wrapper.find('.v-main .v-container')
    expect(container.classes()).toContain('v-container--fluid')
    expect(container.attributes('style')).toContain('max-width: 1920px')
  })

  it('logo v ľavom rohu vedie na úvod a bez ponuky', async () => {
    const wrapper = await mountShell(1440)
    const logo = wrapper.find('[data-test="logo"]')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('href')).toBe('/')
    wrapper.unmount()
  })

  it('ponuka účtu v pravom rohu ukazuje verziu aplikácie, na desktope aj na mobile', async () => {
    for (const width of [1440, 375]) {
      const wrapper = await mountShell(width)
      await wrapper.find('[data-test="account"]').trigger('click')
      await flushPromises()
      expect(document.body.textContent).toContain('Verzia 1.9.0')
      // lokálne (bez Cloudflare Access) sa odhlásenie neponúka
      expect(document.querySelector('[data-test="logout"]')).toBeNull()
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })
})

describe('prepínač domácností', () => {
  it('člen jedinej domácnosti prepínač nevidí', async () => {
    const wrapper = await mountShell(1440)
    expect(wrapper.find('[data-test="household-switcher"]').exists()).toBe(false)
  })

  it('člen viacerých domácností vidí prepínač s názvom aktívnej domácnosti a zoznamom všetkých', async () => {
    stubHouseholds([
      { id: 'a', name: 'Doma', role: 'owner' },
      { id: 'b', name: 'Rodičia', role: 'member' },
    ])
    setActiveHousehold('b')
    const wrapper = await mountShell(1440)
    const switcher = wrapper.find('[data-test="household-switcher"]')
    expect(switcher.exists()).toBe(true)
    expect(switcher.text()).toContain('Rodičia')

    await switcher.trigger('click')
    await flushPromises()
    const items = [...document.body.querySelectorAll('[data-test="household-switch-item"]')]
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Doma', 'Rodičia'])
  })
})
