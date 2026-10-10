import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto } from '@shared/api'
import BulkBar from '@/components/BulkBar.vue'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import TagsPage from '@/features/tags/pages/TagsPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const detail = (extra: Partial<RecipeDetailDto> = {}): RecipeDetailDto => ({
  id: 'r1',
  title: 'Bábovka',
  slug: 'babovka',
  category: 'dezert',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  description: null,
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  shareToken: null,
  ingredients: [],
  steps: [],
  ...extra,
})

const Blank = defineComponent({ render: () => h('div') })

async function mountDetail(recipe: RecipeDetailDto) {
  stubApi({ '/me': me('owner'), '/tags': [], '/contacts': [], '/recipes/r1': recipe })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/:id', component: Blank },
      { path: '/recipes', component: Blank },
      { path: '/sharing', component: Blank },
    ],
  })
  await router.push('/recipes/r1')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipeDetailPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

describe('zdieľanie s e-mailom v detaile receptu', () => {
  it('v ponuke je jediné „Zdieľať…“; okno ponúkne spôsoby a e-mail otvorí dialóg', async () => {
    const wrapper = await mountDetail(detail())
    await wrapper.find('[aria-label="Ďalšie akcie"]').trigger('click')
    await flushPromises()
    const menu = document.querySelector('.v-overlay--active .v-list')!
    for (const old of ['share-link', 'share-with', 'visibility', 'share']) {
      expect(menu.querySelector(`[data-test="${old}"]`), old).toBeNull()
    }
    document.querySelector<HTMLElement>('[data-test="share-open"]')!.click()
    await flushPromises()
    const options = document.querySelector('[data-test="share-options"]')!
    expect(options.textContent).toContain('S konkrétnymi ľuďmi')
    expect(options.textContent).toContain('Odkazom')
    expect(options.textContent).toContain('Verejne v aplikácii')
    document.querySelector<HTMLElement>('[data-test="share-with"]')!.click()
    await flushPromises()
    expect(document.querySelector('[data-test="share-dialog"]')).not.toBeNull()
  })

  it('ukáže, komu je recept zdieľaný, a pri kópii od koho je', async () => {
    const wrapper = await mountDetail(detail({ sharedWith: ['Mama', 'Svokra'], copiedFrom: 'Jakub' }))
    expect(wrapper.find('[data-test="shared-with"]').text()).toBe('Zdieľané s: Mama, Svokra')
    expect(wrapper.find('[data-test="copied-from"]').text()).toBe('Skopírované od: Jakub')
  })

  it('nezdieľaný recept riadok so zdieľaním nemá', async () => {
    const wrapper = await mountDetail(detail({ sharedWith: [] }))
    expect(wrapper.find('[data-test="shared-with"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="copied-from"]').exists()).toBe(false)
  })
})

describe('hromadná lišta', () => {
  it('pri zdieľateľných položkách ponúkne „Zdieľať s…“', async () => {
    const wrapper = mount(BulkBar, {
      props: { count: 2, total: 5, shareable: true },
      global: { plugins: mountPlugins() },
    })
    await wrapper.find('[data-test="bulk-share"]').trigger('click')
    expect(wrapper.emitted('share')).toHaveLength(1)
    expect(
      mount(BulkBar, { props: { count: 2, total: 5 }, global: { plugins: mountPlugins() } })
        .find('[data-test="bulk-share"]')
        .exists(),
    ).toBe(false)
  })
})

describe('stránka Tagy', () => {
  it('pri tagu je „Zdieľať tag“, ktoré otvorí dialóg so zdieľaním celého tagu', async () => {
    stubApi({
      '/me': me('owner'),
      '/tags': [{ id: 't1', name: 'Vianoce', color: null, recipeCount: 2 }],
      '/contacts': [],
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: Blank }],
    })
    await router.push('/tags')
    const wrapper = mount(
      { render: () => h(VApp, null, () => h(TagsPage)) },
      { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
    )
    await flushPromises()
    await wrapper.find('[data-test="share-tag"]').trigger('click')
    await flushPromises()
    wrapper.findComponent({ name: 'VCombobox' }).vm.$emit('update:modelValue', ['svokra@example.com'])
    await flushPromises()
    expect(document.querySelector('[data-test="share-summary"]')?.textContent).toBe(
      'Zdieľaš tag Vianoce s 1 človekom. Nové recepty pribudnú samy.',
    )
  })
})
