import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { SharedRecipeDto } from '@shared/api'
import App from '@/App.vue'
import { i18n, setLocale } from '@/i18n'
import { routes } from '@/router'
import { jsonResponse, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const recipe: SharedRecipeDto = {
  id: 'r1',
  title: 'Kôprová omáčka',
  category: 'omacka',
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 2,
  coverImageUrl: '/api/v1/shared/kod123/cover',
  description: 'Omáčka sa hodí ku knedlíkom.',
  sourceUrl: null,
  sourceText: 'Zdeněk Pohlreich: Taková normální kuchařka, s. 15',
  ingredients: [
    {
      id: 'i1',
      ingredientId: 'g1',
      name: 'Kôpor',
      quantity: 4,
      unit: 'PL',
      note: 'nadrobno nasekaný',
      groupName: null,
      isOptional: false,
      inPantry: false,
    },
  ],
  steps: [
    { id: 's1', position: 1, text: 'Cibuľu speňte na masle.', timerSeconds: null },
    { id: 's2', position: 2, text: 'Zalejte vývarom.', timerSeconds: null },
  ],
}

async function mountShared(api: Record<string, unknown>) {
  const calls = stubApi(api)
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/s/kod123')
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, calls }
}

describe('recept otvorený odkazom na zdieľanie', () => {
  it('zobrazí recept bez menu aplikácie a nevolá nič, čo vyžaduje prihlásenie', async () => {
    const { wrapper, calls } = await mountShared({ '/shared/kod123': recipe })

    expect(calls.map((c) => c.path)).toEqual(['/shared/kod123'])
    expect(wrapper.find('h1').text()).toBe('Kôprová omáčka')
    expect(wrapper.text()).toContain('Kôpor')
    expect(wrapper.text()).toContain('Cibuľu speňte na masle.')
    // Kroky sú číslované od 1 ako v detaile receptu (poradie v databáze začína jednotkou).
    expect(wrapper.findAll('.v-list-item .v-avatar').map((a) => a.text())).toEqual(['1', '2'])
    expect(wrapper.text()).toContain('Prílohové omáčky a Pestá')
    expect(wrapper.find('[data-test="recipe-cover"]').exists()).toBe(true)
    expect(wrapper.find('.v-navigation-drawer').exists()).toBe(false)
    expect(wrapper.find('.v-bottom-navigation').exists()).toBe(false)
  })

  it('tlačidlo Tlačiť vytlačí recept', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const { wrapper } = await mountShared({ '/shared/kod123': recipe })
    await wrapper.find('[data-test="shared-print"]').trigger('click')
    // Tlačí sa až po prekreslení do tlačového vzhľadu (ďalší snímok).
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await flushPromises()
    expect(print).toHaveBeenCalled()
  })

  it('pri tlači je recept kompaktný ako detail: suroviny a postup vedľa seba, menší nadpis a riadky', async () => {
    const { wrapper } = await mountShared({ '/shared/kod123': recipe })
    window.dispatchEvent(new Event('beforeprint'))
    await flushPromises()
    expect(wrapper.find('[data-test="recipe-ingredients-col"]').classes()).toContain('v-col--cols-5')
    expect(wrapper.find('[data-test="recipe-steps-col"]').classes()).toContain('v-col--cols-7')
    expect(wrapper.find('[data-test="recipe-step"]').classes()).not.toContain('py-3')
    expect(wrapper.find('h1').classes()).toContain('text-headline-small')
    window.dispatchEvent(new Event('afterprint'))
  })

  it('neplatný alebo zastavený odkaz povie, že už nefunguje', async () => {
    const { wrapper } = await mountShared({
      '/shared/kod123': () => jsonResponse({ error: { code: 'not_found', message: 'x' } }, 404),
    })
    expect(wrapper.text()).toContain(i18n.global.t('recipes.shared.notFoundTitle'))
  })
})
