import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { IngredientDto, RecipeSummaryDto } from '@shared/api'
import { inBatches } from '@/api/bulk'
import IngredientsPage from '@/features/ingredients/pages/IngredientsPage.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { useSelection } from '@/composables/useSelection'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

const recipe = (id: string, title: string): RecipeSummaryDto => ({
  id,
  title,
  slug: id,
  category: 'hlavne',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastCookedAt: null,
})
const facets = { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} }
const recipeList = {
  items: [recipe('r1', 'Guláš'), recipe('r2', 'Rezeň'), recipe('r3', 'Polievka')],
  facets,
}
const Blank = defineComponent({ render: () => h('div') })
const body = () => document.body

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('výber (useSelection)', () => {
  it('prepína, vyberá všetko, čistí a pri zmene zoznamu necháva len prítomné', () => {
    const s = useSelection()
    s.start()
    s.toggle('a')
    s.toggle('b')
    expect(s.selected.value).toEqual(['a', 'b'])
    s.toggle('a')
    expect(s.has('a')).toBe(false)
    s.set(['a', 'b', 'b', 'c'])
    expect(s.count.value).toBe(3)
    s.keepOnly(['a', 'c', 'x'])
    expect(s.selected.value).toEqual(['a', 'c'])
    s.stop()
    expect(s.active.value).toBe(false)
    expect(s.selected.value).toEqual([])
  })
})

describe('inBatches', () => {
  it('rozdelí výber na dávky po 50', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`)
    const sizes = await inBatches(ids, async (batch) => batch.length)
    expect(sizes).toEqual([50, 50, 20])
  })
})

async function mountRecipes(role: 'owner' | 'member' = 'owner', extra: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': me(role),
    '/recipes': recipeList,
    '/tags': [{ id: 't1', name: 'rýchle', color: null, usageCount: 1 }],
    'POST /recipes/bulk/delete': { affected: 2 },
    'POST /recipes/bulk/update': { affected: 2 },
    ...extra,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recepty', component: Blank }],
  })
  await router.push('/recepty')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipesPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}
const bulkCall = (calls: StubCall[], path: string) =>
  calls.find((c) => c.method === 'POST' && c.path === path)

describe('hromadné operácie v zozname receptov', () => {
  it('výber sa zapne tlačidlom, zaškrtnutie ukáže lištu s počtom a „Vybrať všetko“', async () => {
    const { wrapper } = await mountRecipes()
    expect(wrapper.find('[data-test="bulk-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="select-r1"]').exists()).toBe(false)

    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 0')
    expect(wrapper.find('[data-test="bulk-edit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="select-r2"] input').setValue(true)
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 2')

    await wrapper.find('[data-test="bulk-select-all"]').trigger('click')
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 3')
    await wrapper.find('[data-test="bulk-clear"]').trigger('click')
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 0')

    await wrapper.find('[data-test="bulk-close"]').trigger('click')
    expect(wrapper.find('[data-test="bulk-bar"]').exists()).toBe(false)
  })

  it('klik na kartu v režime výberu recept vyberie (neotvorí)', async () => {
    const { wrapper } = await mountRecipes()
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="recipe-card-r3"]').trigger('click')
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Vybrané: 1')
  })

  it('vymazanie vyžaduje potvrdenie a pošle vybrané id', async () => {
    const { calls, wrapper } = await mountRecipes()
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="select-r3"] input').setValue(true)
    await wrapper.find('[data-test="bulk-remove"]').trigger('click')
    await flushPromises()
    expect(body().textContent).toContain('Vymazať vybrané recepty?')
    expect(bulkCall(calls, '/recipes/bulk/delete')).toBeUndefined()

    body().querySelector<HTMLElement>('[data-test="confirm-ok"]')!.click()
    await flushPromises()
    expect(bulkCall(calls, '/recipes/bulk/delete')?.body).toEqual({ ids: ['r1', 'r3'] })
    expect(body().textContent).toContain('Vymazané: 2 recepty.')
    expect(wrapper.find('[data-test="bulk-bar"]').exists()).toBe(false)
  })

  it('úprava pošle len vyplnené polia (kategória, štítky, obľúbené, viditeľnosť)', async () => {
    const { calls, wrapper } = await mountRecipes()
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="select-r2"] input').setValue(true)
    await wrapper.find('[data-test="bulk-edit"]').trigger('click')
    await flushPromises()
    expect(body().querySelector('[data-test="bulk-edit-dialog"]')).not.toBeNull()

    // nič nevyplnené: chyba, žiadne volanie
    body().querySelector<HTMLElement>('[data-test="bulk-apply"]')!.click()
    await flushPromises()
    expect(body().textContent).toContain('Vyber, čo sa má zmeniť.')
    expect(bulkCall(calls, '/recipes/bulk/update')).toBeUndefined()

    body().querySelector<HTMLElement>('[data-test="bulk-favorite"] button[value="add"]')!.click()
    body().querySelector<HTMLElement>('[data-test="bulk-visibility"] button[value="public"]')!.click()
    await flushPromises()
    body().querySelector<HTMLElement>('[data-test="bulk-apply"]')!.click()
    await flushPromises()
    expect(bulkCall(calls, '/recipes/bulk/update')?.body).toEqual({
      ids: ['r1', 'r2'],
      favorite: true,
      visibility: 'public',
    })
    expect(body().textContent).toContain('Upravené: 2 recepty.')
  })

  it('člen domácnosti pri úprave nevidí viditeľnosť', async () => {
    const { wrapper } = await mountRecipes('member')
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-r1"] input').setValue(true)
    await wrapper.find('[data-test="bulk-edit"]').trigger('click')
    await flushPromises()
    expect(body().querySelector('[data-test="bulk-favorite"]')).not.toBeNull()
    expect(body().querySelector('[data-test="bulk-visibility"]')).toBeNull()
  })

  it('v angličtine sú popisy po anglicky', async () => {
    setLocale('en')
    const { wrapper } = await mountRecipes()
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="bulk-count"]').text()).toBe('Selected: 0')
    expect(wrapper.find('[data-test="bulk-edit"]').text()).toBe('Edit')
    expect(wrapper.find('[data-test="bulk-remove"]').text()).toBe('Delete')
  })
})

const ingredient = (id: string, name: string, usageCount = 0): IngredientDto => ({
  id,
  name,
  defaultUnit: null,
  shopCategoryId: null,
  usageCount,
})

async function mountIngredients(routes: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': me('owner'),
    '/ingredients': [ingredient('i1', 'Mrkva'), ingredient('i2', 'Soľ'), ingredient('i3', 'Jablko', 2)],
    '/shop-categories': [{ id: 'c1', name: 'Zelenina', sortOrder: 1 }],
    'POST /ingredients/bulk/update': { affected: 2 },
    ...routes,
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

describe('hromadné operácie v ingredienciách', () => {
  it('hromadne priradí kategóriu obchodu a pošle len vyplnené polia', async () => {
    const { calls, wrapper } = await mountIngredients()
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-i1"] input').setValue(true)
    await wrapper.find('[data-test="select-i2"] input').setValue(true)
    await wrapper.find('[data-test="bulk-edit"]').trigger('click')
    await flushPromises()

    // výber kategórie cez vnútorný stav komponentu (zoznam položiek je v menu mimo wrappera)
    const dialog = wrapper.findComponent({ name: 'IngredientBulkEditDialog' })
    ;(dialog.vm as unknown as { $: { setupState: { shopCategory: string } } }).$.setupState.shopCategory =
      'c1'
    await flushPromises()
    body().querySelector<HTMLElement>('[data-test="bulk-apply"]')!.click()
    await flushPromises()
    expect(bulkCall(calls, '/ingredients/bulk/update')?.body).toEqual({
      ids: ['i1', 'i2'],
      shopCategoryId: 'c1',
    })
    expect(body().textContent).toContain('Upravené: 2 ingrediencie.')
  })

  it('pri mazaní ohlási preskočené ingrediencie použité v receptoch', async () => {
    const { calls, wrapper } = await mountIngredients({
      'POST /ingredients/bulk/delete': () => jsonResponse({ deleted: 1, skipped: ['Jablko'] }),
    })
    await wrapper.find('[data-test="select-mode"]').trigger('click')
    await wrapper.find('[data-test="select-i2"] input').setValue(true)
    await wrapper.find('[data-test="select-i3"] input').setValue(true)
    await wrapper.find('[data-test="bulk-remove"]').trigger('click')
    await flushPromises()
    expect(body().textContent).toContain('Vymazať vybrané ingrediencie?')
    body().querySelector<HTMLElement>('[data-test="confirm-ok"]')!.click()
    await flushPromises()
    expect(bulkCall(calls, '/ingredients/bulk/delete')?.body).toEqual({ ids: ['i2', 'i3'] })
    expect(body().textContent).toContain('Vymazané: 1 ingrediencia.')
    expect(body().textContent).toContain('Preskočené (použité v receptoch): Jablko.')
  })
})
