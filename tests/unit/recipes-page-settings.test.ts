import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

// Stránka receptov sa v plnej sade testov vykresľuje pomalšie.
vi.setConfig({ testTimeout: 20_000 })

const emptyList = { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } }

async function mountPage(userSettings: object, url = '/recepty', extra: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': { ...me('owner'), userSettings },
    '/recipes': emptyList,
    '/tags': [],
    'PUT /me/settings': (call: StubCall) => jsonResponse(call.body),
    ...extra,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/recepty', component: defineComponent({ render: () => h('div') }) }],
  })
  await router.push(url)
  await router.isReady()
  // Panel filtrov (v-navigation-drawer) potrebuje layout z v-app.
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipesPage)) },
    {
      global: { plugins: [...mountPlugins(), router] },
      attachTo: document.body,
    },
  )
  await flushPromises()
  return { calls, router, wrapper }
}

const settingsPuts = (calls: StubCall[]) =>
  calls.filter((c) => c.method === 'PUT' && c.path === '/me/settings').map((c) => c.body)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Recepty – predvolené filtre a pohľad', () => {
  it('bez filtrov v adrese vrátia uložené filtre a zoradenie', async () => {
    const { router } = await mountPage({ recipeQuery: { kategoria: 'dezert', zoradit: 'time' } })
    await vi.waitFor(() =>
      expect(router.currentRoute.value.query).toMatchObject({ kategoria: 'dezert', zoradit: 'time' }),
    )
  })

  it('filter v adrese má prednosť pred uloženými', async () => {
    const { router } = await mountPage({ recipeQuery: { kategoria: 'dezert' } }, '/recepty?doma=1')
    expect(router.currentRoute.value.query).toEqual({ doma: '1' })
  })

  it('uložený pohľad (tabuľka) sa použije', async () => {
    const { wrapper } = await mountPage({ recipeView: 'table' })
    const toggle = wrapper.find('[data-test="view-toggle"]')
    expect(toggle.find('.bg-primary').attributes('aria-label')).toBe('Zobraziť ako tabuľku')
  })

  it('zmena filtra sa po krátkej pauze uloží na server', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { calls, router } = await mountPage({})
    await router.replace({ query: { kategoria: 'polievka' } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(settingsPuts(calls)).toEqual([{ recipeQuery: { kategoria: 'polievka' } }])
  })

  it('Zrušiť všetky filtre vyčistí aktuálne aj uložené filtre', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { calls, router, wrapper } = await mountPage({ recipeQuery: { kategoria: 'dezert', doma: '1' } })
    expect(router.currentRoute.value.query).toMatchObject({ kategoria: 'dezert', doma: '1' })
    await wrapper.find('[data-test="reset-filters"]').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(settingsPuts(calls)).toEqual([{ recipeQuery: null }])
  })
})
