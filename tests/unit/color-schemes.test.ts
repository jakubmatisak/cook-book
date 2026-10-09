import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '@shared/userSettings'
import { userSettingsUpdateSchema } from '@shared/schemas/userSettings'
import { schemes } from '@/design/tokens'
import { createAppVuetify } from '@/plugins/vuetify'
import { parseColorScheme, themeName, useThemePreference } from '@/composables/useThemePreference'
import { useSyncUserSettings } from '@/composables/useSyncUserSettings'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

const KEYS = [
  'primary',
  'secondary',
  'background',
  'surface',
  'surface-variant',
  'on-surface-variant',
  'on-background',
  'on-surface',
  'error',
  'success',
  'warning',
  'info',
]

afterEach(() => {
  vi.unstubAllGlobals()
  useThemePreference().setScheme(DEFAULT_COLOR_SCHEME)
  localStorage.clear()
})

describe('farebné schémy', () => {
  it('je ich osem, predvolená je Šalvia a horčica', () => {
    expect(COLOR_SCHEMES).toHaveLength(8)
    expect(DEFAULT_COLOR_SCHEME).toBe('salvia-horcica')
  })

  it('každá má svetlé aj tmavé farby so všetkými kľúčmi', () => {
    for (const scheme of COLOR_SCHEMES) {
      for (const mode of ['light', 'dark'] as const) {
        const colors = schemes[scheme][mode] as unknown as Record<string, string>
        for (const key of KEYS) expect(colors[key], `${scheme} ${mode} ${key}`).toMatch(/^#[0-9A-F]{6}$/i)
      }
    }
  })

  it('Vuetify pozná svetlú aj tmavú tému každej schémy, predvolená je svetlá šalvia', () => {
    const vuetify = createAppVuetify()
    const names = Object.keys(vuetify.theme.themes.value)
    for (const scheme of COLOR_SCHEMES) {
      expect(names).toContain(themeName(scheme, 'light'))
      expect(names).toContain(themeName(scheme, 'dark'))
    }
    expect(vuetify.theme.themes.value[themeName('modrotlac', 'dark')]!.dark).toBe(true)
    expect(vuetify.theme.global.name.value).toBe('salvia-horcica-light')
  })

  it('neplatná schéma znamená predvolenú; voľba sa zapamätá na zariadení', () => {
    expect(parseColorScheme('modrotlac')).toBe('modrotlac')
    expect(parseColorScheme('ruzova')).toBe('salvia-horcica')
    expect(parseColorScheme(null)).toBe('salvia-horcica')
    useThemePreference().setScheme('terakota')
    expect(localStorage.getItem('kniha:color-scheme')).toBe('terakota')
    expect(useThemePreference().scheme.value).toBe('terakota')
  })

  it('nastavenia človeka prijmú schému a odmietnu neznámu', () => {
    expect(userSettingsUpdateSchema.safeParse({ colorScheme: 'eukalyptus' }).success).toBe(true)
    expect(userSettingsUpdateSchema.safeParse({ colorScheme: 'ruzova' }).success).toBe(false)
  })
})

describe('schéma sa ukladá pri človeku', () => {
  const Host = defineComponent({
    setup() {
      useSyncUserSettings()
      return () => h('div')
    },
  })

  it('prevezme schému zo servera a zmenu uloží', async () => {
    const calls = stubApi({
      '/me': { ...me('owner'), userSettings: { colorScheme: 'paprika' } },
      'PUT /me/settings': () => jsonResponse({}),
    })
    const wrapper = mount(Host, { global: { plugins: mountPlugins() } })
    await flushPromises()
    expect(useThemePreference().scheme.value).toBe('paprika')
    useThemePreference().setScheme('modrotlac')
    await flushPromises()
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ colorScheme: 'modrotlac' }])
    wrapper.unmount()
  })
})

describe('výber schémy v Nastaveniach', () => {
  it('ukáže všetky schémy s názvom a ťuknutím sa schéma zmení', async () => {
    const SettingsPage = (await import('@/features/settings/pages/SettingsPage.vue')).default
    stubApi({ '/me': me('owner'), '/recipes/samples': [], '/household/members': [], '/households': [] })
    const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    const options = wrapper.findAll('[data-test^="color-scheme-"]')
    expect(options).toHaveLength(8)
    expect(wrapper.find('[data-test="color-scheme-salvia-horcica"]').text()).toContain('Šalvia a horčica')
    expect(wrapper.find('[data-test="color-scheme-salvia-horcica"]').attributes('aria-pressed')).toBe('true')
    await wrapper.find('[data-test="color-scheme-modrotlac"]').trigger('click')
    expect(useThemePreference().scheme.value).toBe('modrotlac')
    expect(wrapper.find('[data-test="color-scheme-modrotlac"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})
