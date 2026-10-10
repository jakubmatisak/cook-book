import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { IncomingShareDto, OutgoingShareDto, ShareNoticeDto } from '@shared/api'
import ShareNoticeCards from '@/features/sharing/components/ShareNoticeCards.vue'
import SharingPage from '@/features/sharing/pages/SharingPage.vue'
import HomePage from '@/features/home/pages/HomePage.vue'
import CreateOwnHousehold from '@/features/households/components/CreateOwnHousehold.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const outgoing: OutgoingShareDto = {
  id: 's1',
  toEmail: 'svokra@example.com',
  toName: 'Svokra',
  kind: 'recipes',
  category: null,
  tagName: null,
  recipeCount: 2,
  recipes: [
    { id: 'r1', title: 'Bábovka' },
    { id: 'r2', title: 'Guláš' },
  ],
  status: 'accepted',
  message: null,
  createdAt: '2026-10-10T10:00:00.000Z',
}

const pending: IncomingShareDto = {
  id: 's2',
  fromName: 'Jakub',
  fromHouseholdName: 'Matisákovci',
  kind: 'recipes',
  category: null,
  tagName: null,
  message: 'Z Vianoc',
  status: 'pending',
  recipes: [
    { id: 'r1', title: 'Bábovka' },
    { id: 'r2', title: 'Guláš' },
  ],
  newCount: 0,
  createdAt: '2026-10-10T10:00:00.000Z',
}

const Blank = defineComponent({ render: () => h('div') })

async function mountWith(component: Component, routes: Record<string, unknown>) {
  const calls = stubApi({ '/me': me('owner'), ...routes })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: Blank }],
  })
  await router.push('/sharing')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(component)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, calls, router }
}

const click = async (selector: string) => {
  document.querySelector<HTMLElement>(selector)!.click()
  await flushPromises()
}
const posted = (calls: { method: string; path: string; body: unknown }[], path: string) =>
  calls.find((c) => c.method === 'POST' && c.path === path)

describe('stránka Zdieľanie', () => {
  it('karta Zdieľam ukáže komu, čo a stav; zrušenie zavolá API', async () => {
    const { wrapper, calls } = await mountWith(SharingPage, {
      '/sharing/outgoing': [outgoing],
      '/sharing/incoming': [],
      'POST /sharing/s1/revoke': { ok: true },
    })
    const row = wrapper.find('[data-test="outgoing-share"]')
    expect(row.text()).toContain('Svokra')
    expect(row.text()).toContain('2 recepty')
    expect(row.text()).toContain('Prijaté')
    await row.find('[data-test="share-actions"]').trigger('click')
    await flushPromises()
    await click('[data-test="share-revoke"]')
    expect(posted(calls, '/sharing/s1/revoke')).toBeTruthy()
  })

  it('recept sa dá odobrať zo zdieľania', async () => {
    const { wrapper, calls } = await mountWith(SharingPage, {
      '/sharing/outgoing': [outgoing],
      '/sharing/incoming': [],
      'POST /sharing/s1/items/remove': { ok: true },
    })
    await wrapper.find('[data-test="share-recipe-r2"] .v-chip__close').trigger('click')
    await flushPromises()
    expect(posted(calls, '/sharing/s1/items/remove')?.body).toEqual({ recipeIds: ['r2'] })
  })

  it('karta Zdieľané so mnou ukáže čakajúcu ponuku s prijatím', async () => {
    const { wrapper, calls } = await mountWith(SharingPage, {
      '/sharing/outgoing': [],
      '/sharing/incoming': [pending],
      'POST /sharing/s2/accept': { ok: true },
    })
    await wrapper.find('[data-test="tab-incoming"]').trigger('click')
    await flushPromises()
    const row = wrapper.find('[data-test="incoming-share"]')
    expect(wrapper.text()).toContain('Od: Jakub (Matisákovci)')
    expect(row.text()).toContain('Bábovka')
    expect(row.text()).toContain('Z Vianoc')
    await row.find('[data-test="share-accept"]').trigger('click')
    await flushPromises()
    expect(posted(calls, '/sharing/s2/accept')?.body).toBeUndefined()
  })

  it('prázdna stránka vysvetlí, ako zdieľať', async () => {
    const { wrapper } = await mountWith(SharingPage, { '/sharing/outgoing': [], '/sharing/incoming': [] })
    expect(wrapper.text()).toContain('Zatiaľ nič nezdieľaš')
  })
})

describe('upozornenia na Prehľade', () => {
  const offer: ShareNoticeDto = {
    kind: 'offer',
    shareId: 's2',
    fromName: 'Jakub',
    count: 2,
    message: 'Z Vianoc',
  }

  it('ponuka: Prijať všetko prijme celú ponuku', async () => {
    const { wrapper, calls } = await mountWith(ShareNoticeCards, {
      '/sharing/notices': [offer],
      '/sharing/incoming': [pending],
      'POST /sharing/s2/accept': { ok: true },
    })
    expect(wrapper.text()).toContain('Jakub s tebou chce zdieľať 2 recepty')
    await wrapper.find('[data-test="notice-accept"]').trigger('click')
    await flushPromises()
    expect(posted(calls, '/sharing/s2/accept')?.body).toBeUndefined()
  })

  it('ponuka: Vybrať… prijme len zaškrtnuté recepty', async () => {
    const { wrapper, calls } = await mountWith(ShareNoticeCards, {
      '/sharing/notices': [offer],
      '/sharing/incoming': [pending],
      'POST /sharing/s2/accept': { ok: true },
    })
    await wrapper.find('[data-test="notice-pick"]').trigger('click')
    await flushPromises()
    await click('[data-test="accept-recipe-r2"] input')
    await click('[data-test="accept-confirm"]')
    expect(posted(calls, '/sharing/s2/accept')?.body).toEqual({ recipeIds: ['r1'] })
  })

  it('zmenený originál: nahradenie kópie po potvrdení', async () => {
    const { wrapper, calls } = await mountWith(ShareNoticeCards, {
      '/sharing/notices': [
        { kind: 'changed', recipeId: 'c1', title: 'Bábovka', fromName: 'Jakub', sourceId: 'r1' },
      ],
      '/sharing/incoming': [],
      'POST /recipes/c1/replace-from-source': { id: 'c1', title: 'Bábovka' },
    })
    expect(wrapper.text()).toContain('Originál receptu Bábovka sa zmenil · zdieľa Jakub')
    await wrapper.find('[data-test="notice-replace"]').trigger('click')
    await flushPromises()
    await click('[data-test="confirm-ok"]')
    expect(posted(calls, '/recipes/c1/replace-from-source')).toBeTruthy()
  })

  it('bez upozornení nič nezobrazí', async () => {
    const { wrapper } = await mountWith(ShareNoticeCards, { '/sharing/notices': [], '/sharing/incoming': [] })
    expect(wrapper.find('[data-test="share-notice"]').exists()).toBe(false)
  })
})

describe('Prehľad a nováčik', () => {
  it('Prehľad ukáže upozornenie na ponuku aj bez receptov', async () => {
    const { wrapper } = await mountWith(HomePage, {
      '/recipes': { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } },
      '/sharing/notices': [{ kind: 'offer', shareId: 's2', fromName: 'Jakub', count: 5, message: null }],
      '/sharing/incoming': [],
    })
    expect(wrapper.find('[data-test="share-notice"]').text()).toContain(
      'Jakub s tebou chce zdieľať 5 receptov',
    )
  })

  it('nováčik bez domácnosti vidí, že na neho čakajú zdieľané recepty', async () => {
    const { wrapper } = await mountWith(CreateOwnHousehold, {
      '/households/account': { email: 'svokra@example.com', canCreate: true, pendingShares: 2 },
    })
    expect(wrapper.find('[data-test="newcomer-shares"]').text()).toContain(
      'Čakajú na teba 2 ponuky zdieľania receptov',
    )
  })
})
