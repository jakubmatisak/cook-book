import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import { emptyRecipeForm, formToInput, recipeToForm } from '@/features/recipes/form'
import RecipeCard from '@/features/recipes/components/RecipeCard.vue'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const summary = (over: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto => ({
  id: 'r1',
  title: 'Guláš',
  slug: 'gulas',
  category: 'hlavne',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  isVerified: false,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  ...over,
})
const detail = (over: Partial<RecipeDetailDto> = {}): RecipeDetailDto => ({
  ...summary(),
  description: null,
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  shareToken: null,
  ingredients: [],
  steps: [],
  ...over,
})
const Blank = defineComponent({ render: () => h('div') })

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
}

describe('overený recept v detaile', () => {
  it('prepínač „Overený recept“ ho jedným ťuknutím označí', async () => {
    setViewport(390)
    const calls = stubApi({
      '/me': me('member'),
      '/recipes/r1': detail(),
      'PUT /recipes/r1/verified': () => jsonResponse(null, 204),
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/recipes/:id', component: Blank }],
    })
    await router.push('/recipes/r1')
    await router.isReady()
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(RecipeDetailPage)) },
      { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
    )
    await flushPromises()
    const input = wrapper.find('[data-test="verified-switch"] input')
    expect((input.element as HTMLInputElement).checked).toBe(false)
    await input.setValue(true)
    await flushPromises()
    expect(calls.some((c: StubCall) => c.method === 'PUT' && c.path === '/recipes/r1/verified')).toBe(true)
  })
})

describe('overený recept v editore a na karte', () => {
  it('formulár príznak prenáša; nový recept nie je overený', () => {
    expect(formToInput(emptyRecipeForm()).isVerified).toBe(false)
    const form = recipeToForm(detail({ isVerified: true }))
    expect(form.isVerified).toBe(true)
    expect(formToInput(form).isVerified).toBe(true)
  })

  it('karta overeného receptu má odznak Overený', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)', component: Blank }],
    })
    stubApi({})
    const wrapper = mount(RecipeCard, {
      props: { recipe: summary({ isVerified: true }) },
      global: { plugins: [...mountPlugins(), router] },
    })
    expect(wrapper.find('[data-test="verified-badge"]').text()).toContain('Overený')
  })
})

async function mountList(width: number, url = '/recipes') {
  setViewport(width)
  const calls = stubApi({
    '/me': me('owner'),
    '/recipes': {
      items: [summary()],
      facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} },
    },
    '/tags': [],
    'POST /recipes/bulk/update': { affected: 1 },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recipes', component: Blank }],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipesPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, router, wrapper }
}

describe('filter a hromadná úprava overených', () => {
  it('na počítači tlačidlo Overené zapne filter v adrese aj v dotaze', async () => {
    const { router, wrapper, calls } = await mountList(1440)
    await wrapper.find('[data-test="verified-toggle"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.query.verified).toBe('1'))
    await vi.waitFor(() =>
      expect(calls.some((c) => c.path === '/recipes' && /verified=1/.test(String(c.url)))).toBe(true),
    )
  })

  it('hromadná úprava pošle verified', async () => {
    const { calls, wrapper } = await mountList(1440)
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="bulk-edit"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="bulk-verified"] button[value="add"]')!.click()
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="bulk-apply"]')!.click()
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/recipes/bulk/update')?.body).toEqual({
      ids: ['r1'],
      verified: true,
    })
  })
})

describe('rozloženie ovládačov zoznamu receptov', () => {
  it('na mobile je prepínač Mriežka / Tabuľka priamo na stránke', async () => {
    const { wrapper } = await mountList(390)
    expect(wrapper.find('[data-test="view-toggle"]').exists()).toBe(true)
  })

  it('na počítači je riadok ovládačov zarovnaný vpravo', async () => {
    const { wrapper } = await mountList(1440)
    expect(wrapper.find('[data-test="list-controls"]').classes()).toContain('justify-end')
  })
})
