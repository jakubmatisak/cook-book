import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { PublicRecipeDetailDto, RecipeSummaryDto } from '@shared/api'
import RecipeCard from '@/features/recipes/components/RecipeCard.vue'
import { parseListQuery } from '@/features/recipes/listQuery'
import PublicRecipePage from '@/features/recipes/pages/PublicRecipePage.vue'
import RecipesPage from '@/features/recipes/pages/RecipesPage.vue'
import ContactsCard from '@/features/settings/components/ContactsCard.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

vi.setConfig({ testTimeout: 20_000 })

const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const summary: RecipeSummaryDto = {
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
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  lastCookedAt: null,
  householdName: 'Matisákovci',
  sharedFrom: 'Jakub',
}

const Blank = defineComponent({ render: () => h('div') })

async function mountAt(
  component: Component,
  url: string,
  routes: Record<string, unknown>,
  path = '/:p(.*)*',
) {
  const calls = stubApi({ '/me': me('owner'), '/tags': [], ...routes })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component: Blank }] })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(component)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, calls, router }
}

describe('zdieľané recepty v zozname', () => {
  it('adresa nesie filter Zdieľané so mnou a Zdieľam', () => {
    expect(parseListQuery({ shared: 'with-me' }).shared).toBe('withMe')
    expect(parseListQuery({ shared: 'by-me' }).shared).toBe('byMe')
    expect(parseListQuery({}).shared).toBe('all')
  })

  it('filter Zdieľané so mnou pošle shared=only, Zdieľam sharedByMe=1', async () => {
    const empty = { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } }
    const first = await mountAt(RecipesPage, '/recipes?shared=with-me', { '/recipes': empty }, '/recipes')
    expect(first.calls.some((c) => c.path === '/recipes' && c.url.includes('shared=only'))).toBe(true)
    const second = await mountAt(RecipesPage, '/recipes?shared=by-me', { '/recipes': empty }, '/recipes')
    expect(second.calls.some((c) => c.path === '/recipes' && c.url.includes('sharedByMe=1'))).toBe(true)
  })

  it('karta zdieľaného receptu ukáže, od koho je, a otvorí detail na čítanie', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: Blank }],
    })
    stubApi({ '/me': me('owner') })
    const wrapper = mount(RecipeCard, {
      props: { recipe: summary },
      global: { plugins: [...mountPlugins(), router] },
    })
    mounted.push(wrapper)
    expect(wrapper.find('[data-test="shared-badge"]').text()).toBe('Od Jakub')
    expect(wrapper.find('[data-test="public-badge"]').exists()).toBe(false)
    expect(wrapper.find('a').attributes('href')).toBe('/public/r1')
  })
})

describe('detail zdieľaného receptu', () => {
  const detail: PublicRecipeDetailDto = {
    ...summary,
    description: null,
    sourceUrl: null,
    sourceText: null,
    coverImageId: null,
    ingredients: [],
    steps: [],
    ownedByMe: false,
    householdName: 'Matisákovci',
    sharedFrom: 'Jakub',
  }

  it('ukáže od koho je a Pridať do plánu najprv skopíruje recept a otvorí plán s kópiou', async () => {
    const { wrapper, calls } = await mountAt(
      PublicRecipePage,
      '/public/r1',
      {
        '/public/recipes/r1': detail,
        'POST /public/recipes/r1/copy': () => jsonResponse({ ...detail, id: 'c1' }, 201),
        '/recipes': { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } },
      },
      '/public/:id',
    )
    expect(wrapper.find('[data-test="shared-from"]').text()).toBe('Od Jakub')
    await wrapper.find('[data-test="shared-plan"]').trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/public/recipes/r1/copy')).toBe(true)
    expect(document.body.textContent).toContain('Pridať jedlo')
  })
})

describe('kontakty v Nastaveniach', () => {
  const contacts = [
    { id: 'c1', email: 'svokra@example.com', name: null },
    { id: 'c2', email: 'mama@example.com', name: 'Mama' },
  ]

  it('vypíše kontakty, premenuje a zmaže', async () => {
    const { wrapper, calls } = await mountAt(ContactsCard, '/settings', {
      '/contacts': contacts,
      'PATCH /contacts/c1': { ok: true },
      'DELETE /contacts/c2': () => jsonResponse(null, 204),
    })
    expect(wrapper.text()).toContain('svokra@example.com')
    expect(wrapper.text()).toContain('Mama')

    await wrapper.find('[data-test="contact-rename-c1"]').trigger('click')
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('[data-test="contact-name"] input')!
    input.value = 'Svokra'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    document.querySelector<HTMLElement>('[data-test="contact-save"]')!.click()
    await flushPromises()
    expect(calls.find((c) => c.method === 'PATCH' && c.path === '/contacts/c1')?.body).toEqual({
      name: 'Svokra',
    })

    await wrapper.find('[data-test="contact-delete-c2"]').trigger('click')
    await flushPromises()
    document.querySelector<HTMLElement>('[data-test="confirm-ok"]')!.click()
    await flushPromises()
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/contacts/c2')).toBe(true)
  })

  it('bez kontaktov vysvetlí, odkiaľ pribudnú', async () => {
    const { wrapper } = await mountAt(ContactsCard, '/settings', { '/contacts': [] })
    expect(wrapper.text()).toContain('Kontakty pribudnú samy')
  })
})
