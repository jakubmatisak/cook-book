import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import ImportFromUrlPage from '@/features/recipes/pages/ImportFromUrlPage.vue'
import { importHandoff } from '@/features/recipes/importHandoff'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

const Blank = defineComponent({ render: () => h('div') })
const imported = {
  recipe: { title: 'Jablkový koláč', category: 'dezert', servings: 6, ingredients: [], steps: [] },
  coverImageUrl: null,
  warnings: [],
}

async function mountPage(url: string, routes: Record<string, unknown>) {
  const calls = stubApi({ '/me': me('owner'), ...routes })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes', component: Blank },
      { path: '/recipes/new', component: Blank },
      { path: '/recipes/import', component: ImportFromUrlPage },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(ImportFromUrlPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, router, wrapper }
}

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
  importHandoff.take()
})

describe('stránka Import z adresy', () => {
  it('načíta recept z adresy, odovzdá ho editoru a presmeruje na nový recept', async () => {
    const { calls, router } = await mountPage('/recipes/import?url=https%3A%2F%2Fa.sk%2Fr%3Fid%3D1', {
      'POST /recipes/import': imported,
    })
    expect(calls.find((c) => c.path === '/recipes/import')?.body).toEqual({ url: 'https://a.sk/r?id=1' })
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/recipes/new?import=1'))
    expect(importHandoff.take()?.recipe.title).toBe('Jablkový koláč')
  })

  it('chýbajúca alebo neplatná adresa vráti na zoznam receptov bez volania importu', async () => {
    const missing = await mountPage('/recipes/import', {})
    await vi.waitFor(() => expect(missing.router.currentRoute.value.path).toBe('/recipes'))
    expect(missing.calls.some((c) => c.path === '/recipes/import')).toBe(false)

    const invalid = await mountPage('/recipes/import?url=javascript%3Aalert(1)', {})
    await vi.waitFor(() => expect(invalid.router.currentRoute.value.path).toBe('/recipes'))
  })

  it('pri chybe ukáže hlášku s možnosťou skúsiť znova a vyplniť ručne', async () => {
    const { calls, router, wrapper } = await mountPage('/recipes/import?url=https%3A%2F%2Fa.sk%2Fr', {
      'POST /recipes/import': () =>
        jsonResponse({ error: { code: 'no_recipe', message: 'Recept sa nenašiel.' } }, 422),
    })
    expect(wrapper.find('[data-test="import-error"]').exists()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/recipes/import')

    await wrapper.find('[data-test="import-retry"]').trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.path === '/recipes/import')).toHaveLength(2)

    await wrapper.find('[data-test="import-manual"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/recipes/new'))
    expect(router.currentRoute.value.query.import).toBeUndefined()
  })

  it('texty sú v jazyku aplikácie', async () => {
    setLocale('en')
    const { wrapper } = await mountPage('/recipes/import?url=https%3A%2F%2Fa.sk%2Fr', {
      'POST /recipes/import': () => jsonResponse({ error: { code: 'x', message: 'no' } }, 500),
    })
    expect(wrapper.find('[data-test="import-retry"]').text()).toBe('Try again')
    expect(wrapper.find('[data-test="import-manual"]').text()).toBe('Fill in manually')
  })
})
