import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto } from '@shared/api'
import CookingModePage from '@/features/recipes/pages/CookingModePage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const detail: RecipeDetailDto = {
  id: 'r1',
  title: 'Knedľa',
  slug: 'knedla',
  category: 'hlavne',
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
  ingredients: [
    {
      id: 'i1',
      ingredientId: 'g1',
      name: 'Mlieko',
      quantity: 100,
      unit: 'ml',
      note: null,
      groupName: null,
      isOptional: false,
      inPantry: false,
    },
  ],
  steps: [{ id: 's1', position: 1, text: 'Nakrájajte chlieb.', timerSeconds: null }],
}

const Blank = defineComponent({ render: () => h('div') })

/** Režim varenia otvorený z detailu, do ktorého sa prišlo zo zoznamu receptov. */
async function mountFromDetail() {
  stubApi({ '/me': me('owner'), '/recipes/r1': detail })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes', component: Blank },
      { path: '/recipes/:id', component: Blank },
      { path: '/recipes/:id/cook', component: CookingModePage },
    ],
  })
  await router.push('/recipes')
  await router.push('/recipes/r1')
  await router.push('/recipes/r1/cook')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(CookingModePage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, router }
}

describe('režim varenia', () => {
  it('Späť vedie o úroveň vyššie na detail receptu', async () => {
    const { wrapper, router } = await mountFromDetail()
    await wrapper.find('[data-test="cooking-back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/recipes/r1')
  })

  it('panel ingrediencií má na desktope riadny nadpis ako na mobile', async () => {
    const { wrapper } = await mountFromDetail()
    await wrapper.find('[data-test="cooking-ingredients"]').trigger('click')
    await flushPromises()
    const title = document.body.querySelector('.v-navigation-drawer .v-card-title')
    expect(title?.textContent).toContain('Ingrediencie pre 4 porcie')
  })
})
