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
  it('karta Zdieľam: krátky riadok s ukážkou receptov, nie zoznam všetkých', async () => {
    const many = {
      ...outgoing,
      recipeCount: 7,
      recipes: ['Anýzové', 'Bábovka', 'Croissant', 'Dobošova', 'Erdbeer', 'Fánky', 'Guláš'].map(
        (title, i) => ({
          id: `m${i}`,
          title,
        }),
      ),
    }
    const { wrapper } = await mountWith(SharingPage, { '/sharing/outgoing': [many], '/sharing/incoming': [] })
    const row = wrapper.find('[data-test="outgoing-share"]')
    expect(row.text()).toContain('Svokra')
    expect(row.text()).toContain('7 receptov')
    expect(row.text()).toContain('Prijaté')
    expect(row.find('[data-test="share-preview"]').text()).toBe('Anýzové, Bábovka, Croissant a ďalšie 4')
    expect(row.findAll('.v-chip').length).toBe(1)
  })

  it('okno zdieľania: hľadanie, hromadné odobratie a zrušenie celého zdieľania', async () => {
    const big = {
      ...outgoing,
      recipeCount: 7,
      recipes: [
        ...['Anýz', 'Croissant', 'Dobošova', 'Erdbeer', 'Fánky'].map((title, i) => ({ id: `f${i}`, title })),
        ...outgoing.recipes,
      ],
    }
    const { wrapper, calls } = await mountWith(SharingPage, {
      '/sharing/outgoing': [big],
      '/sharing/incoming': [],
      'POST /sharing/s1/items/remove': { ok: true },
      'POST /sharing/s1/revoke': { ok: true },
    })
    await wrapper.find('[data-test="outgoing-share"]').trigger('click')
    await flushPromises()
    const dialog = () => document.querySelector('[data-test="share-detail"]')!
    expect(dialog().textContent).toContain('Bábovka')

    const search = dialog().querySelector<HTMLInputElement>('[data-test="share-search"] input')!
    search.value = 'gul'
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(dialog().textContent).not.toContain('Bábovka')
    await click('[data-test="share-item-r2"]')
    await click('[data-test="share-remove-selected"]')
    expect(posted(calls, '/sharing/s1/items/remove')?.body).toEqual({ recipeIds: ['r2'] })

    await click('[data-test="share-revoke"]')
    await click('[data-test="confirm-ok"]')
    expect(posted(calls, '/sharing/s1/revoke')).toBeTruthy()
  })

  it('okno prijatého zdieľania ukáže recepty ako odkazy na čítanie', async () => {
    const accepted = { ...pending, id: 's3', status: 'accepted' as const }
    const { wrapper } = await mountWith(SharingPage, {
      '/sharing/outgoing': [],
      '/sharing/incoming': [accepted],
    })
    await wrapper.find('[data-test="tab-incoming"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="incoming-share"]').trigger('click')
    await flushPromises()
    const link = document.querySelector<HTMLAnchorElement>('[data-test="share-detail"] a[href="/public/r1"]')
    expect(link?.textContent).toContain('Bábovka')
    expect(document.querySelector('[data-test="share-remove-selected"]')).toBeNull()
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
