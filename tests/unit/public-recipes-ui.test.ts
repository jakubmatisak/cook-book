import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { PublicRecipeDetailDto, PublicRecipeSummaryDto, RecipeDetailDto } from '@shared/api'
import { setLocale } from '@/i18n'
import PublicRecipePage from '@/features/recipes/pages/PublicRecipePage.vue'
import PublicRecipesPage from '@/features/recipes/pages/PublicRecipesPage.vue'
import VisibilityDialog from '@/features/recipes/components/VisibilityDialog.vue'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

const summary = (
  over: Partial<PublicRecipeSummaryDto> & { id: string; title: string },
): PublicRecipeSummaryDto => ({
  slug: over.id,
  category: 'dezert',
  servings: 4,
  prepMinutes: 20,
  cookMinutes: 40,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'public',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  householdName: 'Rodičia',
  ownedByMe: false,
  ...over,
})

const detail = (over: Partial<PublicRecipeDetailDto> = {}): PublicRecipeDetailDto => ({
  ...summary({ id: 'p1', title: 'Grófkin koláč' }),
  description: 'Jablkový koláč',
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  ingredients: [
    {
      id: 'i1',
      ingredientId: 'g1',
      name: 'Jablká',
      quantity: 1500,
      unit: 'g',
      note: null,
      groupName: null,
      isOptional: false,
      inPantry: false,
    },
  ],
  steps: [{ id: 's1', position: 0, text: 'Nastrúhaj jablká.', timerSeconds: null }],
  ...over,
})

const stubBase = (extra: Record<string, unknown> = {}) =>
  stubApi({ '/me': me('owner'), '/public/recipes': [], ...extra })

async function mountPage(page: object, url: string, route = '/verejne') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: route, component: defineComponent({ render: () => h('div') }) },
      { path: '/recepty/:id', component: defineComponent({ render: () => h('div') }) },
      { path: '/verejne', component: defineComponent({ render: () => h('div') }) },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(page)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, router }
}

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Verejné recepty – zoznam', () => {
  it('ukáže karty s autorom a vlastné recepty označí', async () => {
    stubBase({
      '/public/recipes': [
        summary({ id: 'p1', title: 'Grófkin koláč', householdName: 'Rodičia' }),
        summary({ id: 'p2', title: 'Môj guláš', ownedByMe: true }),
      ],
    })
    const { wrapper } = await mountPage(PublicRecipesPage, '/verejne')
    const cards = wrapper.findAll('[data-test="public-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('Grófkin koláč')
    expect(cards[0]!.find('[data-test="author-chip"]').text()).toBe('Od: Rodičia')
    expect(cards[1]!.find('[data-test="mine-chip"]').text()).toBe('Tvoj recept')
  })

  it('typ jedla filtruje na serveri', async () => {
    const calls = stubBase()
    const { wrapper } = await mountPage(PublicRecipesPage, '/verejne')
    const chip = wrapper.findAll('.v-chip').find((c) => c.text() === 'Dezert')!
    await chip.trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.path === '/public/recipes' && c.method === 'GET')).toBe(true)
    expect(calls.map((c) => c.path)).toContain('/public/recipes')
    // druhé volanie nesie vybraný typ jedla (adresa s ?category=dezert sa v stube odreže, preto ho kontrolujeme cez fetch)
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes('category=dezert'))).toBe(
      true,
    )
  })

  it('prázdny zoznam vysvetlí, ako sa recept zverejní', async () => {
    stubBase()
    const { wrapper } = await mountPage(PublicRecipesPage, '/verejne')
    expect(wrapper.text()).toContain('Zatiaľ tu nič nie je')
    expect(wrapper.text()).toContain('Vlastník domácnosti môže recept zverejniť')
  })

  it('v angličtine sú texty aj názvy typov jedla po anglicky', async () => {
    setLocale('en')
    stubBase({ '/public/recipes': [summary({ id: 'p1', title: 'Apple cake' })] })
    const { wrapper } = await mountPage(PublicRecipesPage, '/verejne')
    expect(wrapper.text()).toContain('Public recipes')
    expect(wrapper.text()).toContain('From: Rodičia')
    expect(wrapper.text()).toContain('Dessert')
    expect(wrapper.text()).not.toContain('Verejné recepty')
  })
})

describe('Verejné recepty – detail', () => {
  const route = '/verejne/:id'

  it('cudzí recept ide skopírovať do vlastnej domácnosti', async () => {
    const calls = stubBase({
      '/public/recipes/p1': detail(),
      'POST /public/recipes/p1/copy': () =>
        jsonResponse({ ...detail(), id: 'novy', visibility: 'private' } as unknown as RecipeDetailDto, 201),
    })
    const { wrapper } = await mountPage(PublicRecipePage, '/verejne/p1', route)
    expect(wrapper.find('[data-test="public-author"]').text()).toBe('Zdieľa: Rodičia')
    expect(wrapper.text()).toContain('1,5 kg') // 1500 g sa ukáže ako kilogramy
    expect(wrapper.text()).toContain('Nastrúhaj jablká.')
    await wrapper.find('[data-test="public-copy"]').trigger('click')
    await flushPromises()
    expect(calls.filter((c: StubCall) => c.method === 'POST').map((c) => c.path)).toEqual([
      '/public/recipes/p1/copy',
    ])
    expect(document.body.textContent).toContain('Recept je v tvojich receptoch.')
  })

  it('vlastný recept sa kopírovať nedá a ponúkne sa otvorenie', async () => {
    stubBase({ '/public/recipes/p1': detail({ ownedByMe: true }) })
    const { wrapper } = await mountPage(PublicRecipePage, '/verejne/p1', route)
    expect(wrapper.find('[data-test="public-copy"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="public-mine"]').text()).toContain('Toto je recept tvojej domácnosti.')
  })

  it('neexistujúci alebo skrytý recept ukáže vysvetlenie', async () => {
    stubBase({
      '/public/recipes/p1': () =>
        jsonResponse({ error: { code: 'not_found', message: 'Recept neexistuje.' } }, 404),
    })
    const { wrapper } = await mountPage(PublicRecipePage, '/verejne/p1', route)
    expect(wrapper.text()).toContain('Recept sa nenašiel')
  })
})

describe('Zverejnenie receptu', () => {
  async function mountDialog(visibility: 'private' | 'public') {
    const calls = stubBase({
      'PUT /recipes/r1/visibility': (call: StubCall) =>
        jsonResponse({ id: 'r1', visibility: (call.body as { visibility: string }).visibility }),
    })
    const done = vi.fn()
    mount(
      {
        render: () =>
          h(VApp, null, () =>
            h(VisibilityDialog, { modelValue: true, recipeId: 'r1', visibility, onDone: done }),
          ),
      },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    return { calls, done }
  }

  it('súkromný recept sa po potvrdení zverejní', async () => {
    const { calls, done } = await mountDialog('private')
    expect(document.body.textContent).toContain('Zverejniť recept?')
    document.body.querySelector<HTMLElement>('[data-test="visibility-confirm"]')!.click()
    await flushPromises()
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ visibility: 'public' }])
    expect(done).toHaveBeenCalledWith('Recept je verejný.')
  })

  it('verejný recept sa po potvrdení skryje', async () => {
    const { calls, done } = await mountDialog('public')
    expect(document.body.textContent).toContain('Skryť recept?')
    document.body.querySelector<HTMLElement>('[data-test="visibility-confirm"]')!.click()
    await flushPromises()
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ visibility: 'private' }])
    expect(done).toHaveBeenCalledWith('Recept je súkromný.')
  })
})
