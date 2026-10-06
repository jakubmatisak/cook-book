import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useSyncUserSettings } from '@/composables/useSyncUserSettings'
import { currentLocale, setLocale } from '@/i18n'
import { useThemePreference } from '@/composables/useThemePreference'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

const Host = defineComponent({
  setup() {
    useSyncUserSettings()
    return () => h('div')
  },
})

const meWith = (userSettings: object) => ({ ...me('owner'), userSettings })

const mounted: { unmount: () => void }[] = []

async function mountHost(routes: Record<string, unknown>) {
  const calls = stubApi(routes)
  const wrapper = mount(Host, { global: { plugins: mountPlugins() } })
  mounted.push(wrapper)
  await flushPromises()
  return { calls, wrapper }
}

const puts = (calls: { method: string; path: string; body: unknown }[]) =>
  calls.filter((c) => c.method === 'PUT' && c.path === '/me/settings').map((c) => c.body)

afterEach(() => {
  // Najprv odpojiť komponenty, inak ich pozorovatelia reagujú aj na reset vzhľadu z nasledujúceho testu.
  for (const w of mounted.splice(0)) w.unmount()
  vi.unstubAllGlobals()
  useThemePreference().set('system')
  setLocale('sk')
  localStorage.clear()
})

describe('useSyncUserSettings – vzhľad', () => {
  it('prevezme vzhľad uložený na serveri a nič nezapisuje späť', async () => {
    const { calls } = await mountHost({ '/me': meWith({ theme: 'dark' }) })
    expect(useThemePreference().preference.value).toBe('dark')
    expect(puts(calls)).toEqual([])
  })

  it('zmena vzhľadu sa uloží na server', async () => {
    const { calls } = await mountHost({
      '/me': meWith({ theme: 'dark' }),
      'PUT /me/settings': () => jsonResponse({ theme: 'light' }),
    })
    useThemePreference().set('light')
    await flushPromises()
    expect(puts(calls)).toEqual([{ theme: 'light' }])
  })

  it('vzhľad zvolený na zariadení pred prvým uložením sa na server prenesie', async () => {
    useThemePreference().set('dark')
    const { calls } = await mountHost({
      '/me': meWith({}),
      'PUT /me/settings': () => jsonResponse({ theme: 'dark' }),
    })
    expect(puts(calls)).toEqual([{ theme: 'dark' }])
  })

  it('bez uloženého vzhľadu a s predvoleným na zariadení sa nič neukladá', async () => {
    const { calls } = await mountHost({ '/me': meWith({}) })
    expect(puts(calls)).toEqual([])
  })
})

describe('useSyncUserSettings – jazyk', () => {
  it('prevezme jazyk uložený na serveri', async () => {
    const { calls } = await mountHost({ '/me': meWith({ locale: 'en' }) })
    expect(currentLocale()).toBe('en')
    expect(puts(calls)).toEqual([])
  })

  it('zmena jazyka sa uloží na server', async () => {
    const { calls } = await mountHost({
      '/me': meWith({}),
      'PUT /me/settings': () => jsonResponse({ locale: 'en' }),
    })
    setLocale('en')
    await flushPromises()
    expect(puts(calls)).toEqual([{ locale: 'en' }])
  })

  it('jazyk zvolený na zariadení pred prvým uložením sa na server prenesie', async () => {
    setLocale('en')
    const { calls } = await mountHost({
      '/me': meWith({}),
      'PUT /me/settings': () => jsonResponse({ locale: 'en' }),
    })
    expect(puts(calls)).toEqual([{ locale: 'en' }])
  })
})
