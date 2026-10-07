import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RecipeSummaryDto } from '@shared/api'
import RecipeTable from '@/features/recipes/components/RecipeTable.vue'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
}

const recipe = (id: string, title: string): RecipeSummaryDto => ({
  id,
  title,
  slug: id,
  category: 'hlavne',
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 15,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  lastCookedAt: null,
})

const Blank = defineComponent({ render: () => h('div') })

async function mountTable(width: number, selectable = false) {
  setViewport(width)
  stubApi({ '/me': me('owner') })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes', component: Blank },
      { path: '/recipes/:id', component: Blank },
    ],
  })
  await router.push('/recipes')
  await router.isReady()
  const wrapper = mount(RecipeTable, {
    props: { items: [recipe('r1', 'Guláš'), recipe('r2', 'Palacinky')], sortBy: [], selectable },
    global: { plugins: [...mountPlugins(), router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { router, wrapper }
}

describe('tabuľka receptov na mobile', () => {
  it('je kompaktný zoznam: riadok má len názov, kategóriu a čas', async () => {
    const { wrapper } = await mountTable(390)
    expect(wrapper.find('.v-data-table').exists()).toBe(false)
    const rows = wrapper.findAll('[data-test="recipe-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Guláš')
    expect(rows[0]!.text()).toContain('Hlavné jedlo · 25 min')
    expect(rows[0]!.text()).not.toContain('Náročnosť')
  })

  it('klik na riadok otvorí recept, v režime výberu ho vyberie', async () => {
    const { router, wrapper } = await mountTable(390)
    await wrapper.find('[data-test="recipe-row"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/recipes/r1')

    document.body.innerHTML = ''
    const selecting = await mountTable(390, true)
    await selecting.wrapper.find('[data-test="recipe-row"]').trigger('click')
    expect(selecting.wrapper.emitted('update:selected')?.at(-1)).toEqual([['r1']])
  })

  it('na počítači ostáva tabuľka', async () => {
    const { wrapper } = await mountTable(1280)
    expect(wrapper.find('.v-data-table').exists()).toBe(true)
  })
})
