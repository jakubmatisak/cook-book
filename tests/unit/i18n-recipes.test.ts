import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import { recipeInputSchema } from '@shared/schemas/recipe'
import FavoriteButton from '@/features/recipes/components/FavoriteButton.vue'
import RecipeCard from '@/features/recipes/components/RecipeCard.vue'
import RecipeFilterCard from '@/features/recipes/components/RecipeFilterCard.vue'
import { describeIssues, emptyRecipeForm, formToInput, recipeToForm } from '@/features/recipes/form'
import CookingModePage from '@/features/recipes/pages/CookingModePage.vue'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import RecipeEditPage from '@/features/recipes/pages/RecipeEditPage.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const summary = (over: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto => ({
  id: 'r1',
  title: 'Goulash',
  slug: 'goulash',
  category: 'hlavne',
  servings: 4,
  prepMinutes: 20,
  cookMinutes: 70,
  difficulty: 2,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastCookedAt: null,
  ...over,
})

const detail: RecipeDetailDto = {
  ...summary(),
  description: null,
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  ingredients: [
    {
      id: 'i1',
      ingredientId: 'g1',
      name: 'Onion',
      quantity: 2,
      unit: 'ks',
      note: null,
      groupName: null,
      isOptional: true,
      inPantry: false,
    },
  ],
  steps: [{ id: 's1', position: 1, text: 'Chop the onion', timerSeconds: 600 }],
}

const facets = { category: { hlavne: 1 }, tag: {}, difficulty: { 2: 1 }, time: { nad60: 1 }, missing: {} }

const Blank = defineComponent({ render: () => h('div') })

const router = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recepty', component: Blank },
      { path: '/recepty/:id', component: Blank },
      { path: '/recepty/:id/varenie', component: Blank },
      { path: '/recepty/novy', component: Blank },
    ],
  })

async function mountAt(url: string, component: object, routes: Record<string, unknown>) {
  stubApi({ '/me': me('owner'), '/tags': [], ...routes })
  const r = router()
  await r.push(url)
  await r.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(component)) },
    { global: { plugins: [...mountPlugins(), r] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => setLocale('en'))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Recipes in English', () => {
  it('list page shows English texts and category, time and servings labels', async () => {
    const wrapper = await mountAt('/recepty', RecipesPage, {
      '/recipes': { items: [summary()], facets },
    })
    const text = wrapper.text()
    expect(text).toContain('Recipes')
    expect(text).toContain('1 recipe')
    expect(text).toContain('Import from web')
    expect(text).toContain('New recipe')
    expect(text).toContain('Favorites')
    expect(text).toContain('What can I cook')
    expect(text).toContain('Main course · 1 h 30 min')
    expect(text).not.toContain('Nový recept')
    expect(text).not.toContain('Obľúbené')
    expect(text).not.toContain('Hlavné jedlo')
  })

  it('empty list shows the English welcome text', async () => {
    const wrapper = await mountAt('/recepty', RecipesPage, {
      '/recipes': { items: [], facets },
    })
    expect(wrapper.text()).toContain('Welcome to the cookbook')
    expect(wrapper.text()).toContain('1. Add recipes')
    expect(wrapper.text()).toContain('Add your first recipe')
    expect(wrapper.text()).not.toContain('Vitaj')
  })

  it('pantry hint keeps its link inside the English sentence', async () => {
    const wrapper = await mountAt('/recepty?doma=1', RecipesPage, {
      '/recipes': { items: [], facets },
    })
    expect(wrapper.text()).toContain('Recipes sorted by what you have in your pantry.')
    expect(wrapper.find('a[href="/spajza"]').text()).toBe('pantry')
  })

  it('recipe card and favorite button', () => {
    const wrapper = mount(RecipeCard, {
      props: { recipe: summary({ missing: ['Onion', 'Beef', 'Salt', 'Paprika'] }) },
      global: { plugins: mountPlugins().concat([router()]) },
    })
    expect(wrapper.text()).toContain('Missing: Onion, Beef, Salt…')
    expect(wrapper.text()).not.toContain('Chýba')
    const fav = mount(FavoriteButton, {
      props: { recipeId: 'r1', isFavorite: true },
      global: { plugins: mountPlugins() },
    })
    expect(fav.attributes('aria-label')).toBe('Remove from favorites')
  })

  it('filter panel is translated', () => {
    const wrapper = mount(RecipeFilterCard, {
      props: {
        state: { category: [], tag: [], difficulty: [], time: [], favorite: false } as never,
        facets,
        tags: [],
        resultCount: 3,
      },
      global: { plugins: mountPlugins() },
    })
    const text = wrapper.text()
    expect(text).toContain('Filters')
    expect(text).toContain('Preparation time')
    expect(text).toContain('Over 60 min')
    expect(text).toContain('Show 3')
    expect(text).not.toContain('Filtre')
  })

  it('detail page shows English chips, units and optional marker', async () => {
    const wrapper = await mountAt('/recepty/r1', RecipeDetailPage, { '/recipes/r1': detail })
    const text = wrapper.text()
    expect(text).toContain('Goulash')
    expect(text).toContain('Prep 20 min')
    expect(text).toContain('Cook 1 h 10 min')
    expect(text).toContain('4 servings')
    expect(text).toContain('Medium')
    expect(text).toContain('Cooking mode')
    expect(text).toContain('For 4 servings')
    expect(text).toContain('Onion (optional)')
    expect(text).toContain('Method')
    expect(text).not.toContain('Príprava')
    expect(text).not.toContain('voliteľné')
    expect(document.title).toBe('Goulash · Cookbook')
  })

  it('detail page of a missing recipe shows the English empty state', async () => {
    const wrapper = await mountAt('/recepty/x', RecipeDetailPage, {})
    expect(wrapper.text()).toContain('Recipe does not exist')
    expect(wrapper.text()).toContain('Back to recipes')
  })

  it('cooking mode is translated', async () => {
    const wrapper = await mountAt('/recepty/r1/varenie', CookingModePage, { '/recipes/r1': detail })
    const text = wrapper.text()
    expect(text).toContain('You are cooking for 4 servings. Tap a step when it is done.')
    expect(text).toContain('Step 1')
    expect(text).not.toContain('Krok')
    expect(wrapper.find('[aria-label="Step 1 done"]').exists()).toBe(true)
  })

  it('editor shows English labels', async () => {
    const wrapper = await mountAt('/recepty/novy', RecipeEditPage, {})
    const text = wrapper.text()
    expect(text).toContain('New recipe')
    expect(text).toContain('Recipe title')
    expect(text).toContain('Add ingredient')
    expect(text).toContain('Add step')
    expect(text).toContain('Save recipe')
    expect(text).toContain('Hard')
    expect(text).not.toContain('Názov receptu')
  })
})

describe('describeIssues and form numbers in English', () => {
  it('translates field names but keeps schema messages', () => {
    const form = emptyRecipeForm()
    form.title = ''
    form.ingredients = [
      { key: 'a', name: 'Sugar', quantity: 'lots', unit: 'g', note: '', groupName: '', isOptional: false },
    ]
    const result = recipeInputSchema.safeParse(formToInput(form))
    expect(result.success).toBe(false)
    const messages = describeIssues(result.error!.issues)
    expect(messages.some((m) => m.startsWith('Title: '))).toBe(true)
    expect(messages.some((m) => m.startsWith('Ingredient 1 – quantity: '))).toBe(true)
    expect(messages.join('\n')).not.toContain('Názov:')
  })

  it('quantities in the form use a decimal point and no grouping', () => {
    const form = recipeToForm({
      ...detail,
      ingredients: [
        { ...detail.ingredients[0]!, quantity: 1500, unit: 'g' },
        { ...detail.ingredients[0]!, id: 'i2', quantity: 1.5 },
      ],
      steps: [{ id: 's1', position: 1, text: 'x', timerSeconds: 90 }],
    })
    expect(form.ingredients.map((i) => i.quantity)).toEqual(['1500', '1.5'])
    expect(form.steps[0]!.timerMinutes).toBe('1.5')
  })
})
