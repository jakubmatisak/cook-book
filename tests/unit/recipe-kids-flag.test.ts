import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeDetailDto } from '@shared/api'
import RecipeEditPage from '@/features/recipes/pages/RecipeEditPage.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  localStorage.clear()
})

const Blank = defineComponent({ render: () => h('div') })

const kidsRecipe: RecipeDetailDto = {
  id: 'k1',
  title: 'Ryžová kaša',
  slug: 'ryzova-kasa',
  category: 'detske',
  servings: 2,
  prepMinutes: 2,
  cookMinutes: 5,
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
  ingredients: [],
  steps: [],
}

async function mountEditor(url: string, routes: Record<string, unknown> = {}, userSettings: object = {}) {
  stubApi({
    '/me': { ...me('owner'), userSettings },
    '/tags': [],
    '/ingredients': [],
    ...routes,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recepty/novy', component: Blank },
      { path: '/recepty/:id/upravit', component: Blank },
      { path: '/recepty', component: Blank },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipeEditPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

const flag = (wrapper: Awaited<ReturnType<typeof mountEditor>>) =>
  wrapper.find('[data-test="kids-flag"] input')
const categoryText = (wrapper: Awaited<ReturnType<typeof mountEditor>>) =>
  wrapper.find('[data-test="recipe-category"]').text()

describe('Editor receptu: zaškrtávacie pole „Detský recept“', () => {
  it('pri novom recepte je pole viditeľné a predvolene nezaškrtnuté', async () => {
    const wrapper = await mountEditor('/recepty/novy')
    expect(flag(wrapper).exists()).toBe(true)
    expect((flag(wrapper).element as HTMLInputElement).checked).toBe(false)
    expect(categoryText(wrapper)).toContain('Hlavné jedlo')
  })

  it('zaškrtnutie nastaví typ jedla na Detské a odškrtnutie vráti predošlý typ', async () => {
    const wrapper = await mountEditor('/recepty/novy')
    await flag(wrapper).setValue(true)
    expect(categoryText(wrapper)).toContain('Detské')
    await flag(wrapper).setValue(false)
    expect(categoryText(wrapper)).toContain('Hlavné jedlo')
  })

  it('detský recept pri úprave je zaškrtnutý a odškrtnutie dá hlavné jedlo', async () => {
    const wrapper = await mountEditor('/recepty/k1/upravit', { '/recipes/k1': kidsRecipe })
    expect((flag(wrapper).element as HTMLInputElement).checked).toBe(true)
    await flag(wrapper).setValue(false)
    expect(categoryText(wrapper)).toContain('Hlavné jedlo')
  })

  it('pole sa nezobrazí, keď sú detské recepty vypnuté v nastaveniach', async () => {
    const wrapper = await mountEditor('/recepty/novy', {}, { kidsEnabled: false })
    expect(flag(wrapper).exists()).toBe(false)
  })

  it('v angličtine má popis po anglicky', async () => {
    setLocale('en')
    const wrapper = await mountEditor('/recepty/novy')
    expect(wrapper.find('[data-test="kids-flag"]').text()).toContain('Baby food recipe')
  })
})
