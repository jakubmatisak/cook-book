import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { PublicRecipeDetailDto, RecipeDetailDto } from '@shared/api'
import PublicRecipePage from '@/features/recipes/pages/PublicRecipePage.vue'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ingredient = (id: string, name: string, quantity: number | null, unit: 'g' | 'PL' | null) => ({
  id,
  ingredientId: `g-${id}`,
  name,
  quantity,
  unit,
  note: null,
  groupName: null,
  isOptional: false,
  inPantry: false,
})

const base: RecipeDetailDto = {
  id: 'r1',
  title: 'Guláš',
  slug: 'gulas',
  category: 'hlavne',
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
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
    ingredient('i1', 'bravčových kociek', 800, 'g'),
    ingredient('i2', 'rastlinný olej', null, null),
    ingredient('i3', 'mletej papriky', 3, 'PL'),
  ],
  steps: [{ id: 's1', position: 1, text: 'Uvar.', timerSeconds: null }],
}

const Blank = defineComponent({ render: () => h('div') })

async function mountAt(url: string, route: string, page: object, routes: Record<string, unknown>) {
  stubApi({ '/me': me('owner'), '/tags': [], ...routes })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: route, component: Blank },
      { path: '/recepty', component: Blank },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(page)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

/** Každý riadok ingrediencií má stĺpec s množstvom (aj prázdny), aby názvy začínali pod sebou. */
const hasQuantityColumn = (wrapper: Awaited<ReturnType<typeof mountAt>>) => {
  const rows = wrapper.findAll('.v-list-item').filter((r) => r.find('.v-list-item-title').exists())
  const withIngredients = rows.filter((r) => /kociek|olej|papriky/.test(r.text()))
  expect(withIngredients).toHaveLength(3)
  return withIngredients.map((r) => r.find('.v-list-item__prepend').exists())
}

describe('zarovnanie ingrediencií bez množstva', () => {
  it('detail receptu: aj ingrediencia bez množstva má stĺpec s množstvom', async () => {
    const wrapper = await mountAt('/recepty/r1', '/recepty/:id', RecipeDetailPage, { '/recipes/r1': base })
    expect(hasQuantityColumn(wrapper)).toEqual([true, true, true])
  })

  it('verejný recept: rovnako', async () => {
    const detail: PublicRecipeDetailDto = { ...base, householdName: 'Rodičia', ownedByMe: false }
    const wrapper = await mountAt('/verejne/r1', '/verejne/:id', PublicRecipePage, {
      '/public/recipes/r1': detail,
    })
    expect(hasQuantityColumn(wrapper)).toEqual([true, true, true])
  })
})
