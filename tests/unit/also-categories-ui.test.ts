import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp, VSelect } from 'vuetify/components'
import type { RecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import { formToInput, recipeToForm } from '@/features/recipes/form'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import RecipeEditPage from '@/features/recipes/pages/RecipeEditPage.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
})

const summary = (over: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto => ({
  id: 'r1',
  title: 'Lievance',
  slug: 'lievance',
  category: 'ranajky',
  alsoCategories: ['desiata', 'dezert'],
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

async function mountAt(url: string, page: object, routes: Record<string, unknown>) {
  const calls = stubApi({ '/me': me('owner'), '/tags': [], '/ingredients': [], ...routes })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes', component: Blank },
      { path: '/recipes/:id', component: Blank },
      { path: '/recipes/:id/edit', component: Blank },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(page)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

const selectByTest = (wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'], test: string) =>
  wrapper.findAllComponents(VSelect).find((c) => c.attributes('data-test') === test)!

describe('Hodí sa aj ako – formulár a editor', () => {
  it('formulár typy prenáša tam aj späť', () => {
    expect(formToInput(recipeToForm(detail())).alsoCategories).toEqual(['desiata', 'dezert'])
  })

  it('editor ponúkne ďalšie typy bez hlavného a uloží ich', async () => {
    const { calls, wrapper } = await mountAt('/recipes/r1/edit', RecipeEditPage, {
      '/recipes/r1': detail({ alsoCategories: [] }),
      'PUT /recipes/r1': detail(),
    })
    const select = selectByTest(wrapper, 'also-categories')
    const values = (select.props('items') as { value: string }[]).map((i) => i.value)
    expect(values).toContain('desiata')
    expect(values).not.toContain('ranajky')
    select.vm.$emit('update:modelValue', ['desiata'])
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/recipes/r1')
    expect((put?.body as { alsoCategories: string[] }).alsoCategories).toEqual(['desiata'])
  })
})

describe('Hodí sa aj ako – detail a hromadná úprava', () => {
  it('detail ukáže, na čo sa recept hodí', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const { wrapper } = await mountAt('/recipes/r1', RecipeDetailPage, { '/recipes/r1': detail() })
    expect(wrapper.find('[data-test="also-categories-line"]').text()).toBe('Hodí sa aj ako: Desiata, Dezert')
  })

  it('hromadná úprava pridá a odoberie typ jedla', async () => {
    const { calls, wrapper } = await mountAt('/recipes', RecipesPage, {
      '/recipes': {
        items: [summary()],
        facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} },
      },
      'POST /recipes/bulk/update': { affected: 1 },
    })
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="bulk-edit"]').trigger('click')
    await flushPromises()
    selectByTest(wrapper, 'bulk-add-categories').vm.$emit('update:modelValue', ['desiata'])
    selectByTest(wrapper, 'bulk-remove-categories').vm.$emit('update:modelValue', ['dezert'])
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="bulk-apply"]')!.click()
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/recipes/bulk/update')?.body).toEqual({
      ids: ['r1'],
      addCategories: ['desiata'],
      removeCategories: ['dezert'],
    })
  })
})
