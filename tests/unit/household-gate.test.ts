import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { householdsKey } from '@/api/households'
import { h } from 'vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'
import { activeHouseholdId, clearActiveHousehold } from '@/lib/household'
import { createAppVuetify } from '@/plugins/vuetify'

function stubFetch(households: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(households), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

interface Call {
  method: string
  path: string
  body: unknown
}

/** Falošné API podľa cesty (hodnota alebo funkcia, ktorá ju vráti pri každom volaní). */
function stubRoutes(routes: Record<string, unknown>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url).replace('/api/v1', '').split('?')[0]!
      const method = init?.method ?? 'GET'
      calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const route = routes[`${method} ${path}`] ?? routes[path]
      const body = typeof route === 'function' ? (route as () => unknown)() : route
      return Promise.resolve(
        new Response(JSON.stringify(body ?? { error: { code: 'x', message: path } }), {
          status: route === undefined ? 404 : method === 'POST' ? 201 : 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }),
  )
  return calls
}

async function mountGate() {
  const wrapper = mount(HouseholdGate, {
    global: {
      plugins: [
        createAppVuetify(),
        [VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }],
      ],
    },
    slots: { default: () => h('p', { 'data-test': 'content' }, 'obsah') },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearActiveHousehold()
  localStorage.clear()
  document.body.innerHTML = ''
})

const home = (id: string, name: string) => ({ id, name, role: 'owner' })

describe('HouseholdGate', () => {
  it('jedinú domácnosť zvolí sama a pustí obsah bez výberu', async () => {
    stubFetch([home('a', 'Doma')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="household-picker"]').exists()).toBe(false)
    expect(activeHouseholdId()).toBe('a')
  })

  it('pri viacerých domácnostiach žiada výber a po kliknutí pustí obsah', async () => {
    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    const options = wrapper.findAll('[data-test="household-option"]')
    expect(options.map((o) => o.text())).toEqual([
      expect.stringContaining('Doma'),
      expect.stringContaining('Rodičia'),
    ])

    await options[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(activeHouseholdId()).toBe('b')
  })

  it('platnú domácnosť zvolenú v tomto okne použije bez opýtania', async () => {
    sessionStorage.setItem('kniha:household', 'b')
    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(activeHouseholdId()).toBe('b')
  })

  it('bez členstva ponúkne založiť vlastnú domácnosť a ukáže, ktorým e-mailom je prihlásený', async () => {
    const calls = stubRoutes({
      '/households': [],
      '/households/account': { email: 'kolega@example.com', canCreate: true },
    })
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Zatiaľ nie si v žiadnej domácnosti')
    expect(wrapper.text()).toContain('kolega@example.com')
    const name = wrapper.find('[data-test="own-household-name"] input')
    expect((name.element as HTMLInputElement).value).toBe('Domácnosť kolega')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('po založení je vlastníkom novej domácnosti a aplikácia sa otvorí', async () => {
    let households: unknown[] = []
    const calls = stubRoutes({
      '/households': () => households,
      '/households/account': { email: 'kolega@example.com', canCreate: true },
      'POST /households': () => {
        households = [home('n1', 'Naši')]
        return home('n1', 'Naši')
      },
    })
    const wrapper = await mountGate()
    await wrapper.find('[data-test="own-household-name"] input').setValue('Naši')
    await wrapper.find('[data-test="own-household-create"]').trigger('click')
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Naši' })
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(activeHouseholdId()).toBe('n1')
  })

  it('pri chybe načítania ponúkne skúsiť znova', async () => {
    stubFetch({ error: { code: 'server', message: 'Chyba servera' } }, 500)
    const wrapper = await mountGate()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Skúsiť znova')
  })
})

describe('HouseholdGate – zmena domácností počas relácie', () => {
  it('keď aktívna domácnosť zanikne (odobratý člen), aplikácia sa načíta odznova', async () => {
    vi.resetModules()
    const reloadApp = vi.fn()
    vi.doMock('@/lib/household', async (original) => ({
      ...(await original<typeof import('@/lib/household')>()),
      reloadApp,
    }))
    const { default: Gate } = await import('@/features/households/components/HouseholdGate.vue')
    const { QueryClient: QC, VueQueryPlugin: VQ } = await import('@tanstack/vue-query')
    const client = new QC({ defaultOptions: { queries: { retry: false } } })

    stubFetch([home('a', 'Doma'), home('b', 'Rodičia')])
    sessionStorage.setItem('kniha:household', 'a')
    const wrapper = mount(Gate, {
      global: { plugins: [createAppVuetify(), [VQ, { queryClient: client }]] },
      slots: { default: () => h('p', { 'data-test': 'content' }, 'obsah') },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(reloadApp).not.toHaveBeenCalled()

    stubFetch([home('b', 'Rodičia')]) // z domácnosti a už nie je členom
    await client.invalidateQueries({ queryKey: householdsKey })
    await flushPromises()
    expect(reloadApp).toHaveBeenCalledTimes(1)
    vi.doUnmock('@/lib/household')
  })
})
