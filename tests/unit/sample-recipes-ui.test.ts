import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { SampleGroupStatusDto } from '@shared/api'
import { setLocale } from '@/i18n'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const STATUS: SampleGroupStatusDto[] = [
  { set: 'ranajky', total: 12, imported: 2 },
  { set: 'desiata', total: 10, imported: 0 },
  { set: 'olovrant', total: 10, imported: 0 },
  { set: 'vecera', total: 10, imported: 10 },
  { set: 'polievky', total: 4, imported: 4 },
  { set: 'hlavne', total: 8, imported: 8 },
  { set: 'salaty', total: 3, imported: 3 },
  { set: 'dezerty', total: 4, imported: 4 },
  { set: 'kids', total: 23, imported: 0 },
]

/** Falošný server: dávky po 3 receptoch, ako skutočný. */
function batches(total: number) {
  let remaining = total
  return () => {
    const added = Math.min(3, remaining)
    remaining -= added
    return jsonResponse({ added, remaining })
  }
}

async function mountSettings(role: 'owner' | 'member' = 'owner', userSettings: object = {}) {
  const calls = stubApi({
    '/me': { ...me(role), userSettings },
    '/recipes/samples': STATUS,
    'POST /recipes/samples': batches(10),
    'POST /recipes/samples/remove': () => jsonResponse({ removed: 10 }),
    '/household/members': [],
    '/households': [{ id: 'h1', name: 'Doma', role }],
  })
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(SettingsPage)) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { calls, wrapper }
}

const row = (set: string) => document.body.querySelector<HTMLElement>(`[data-test="sample-group-${set}"]`)!

describe('Základné recepty v Nastaveniach', () => {
  it('ukáže balíky s počtom, koľko z nich máš; detské len pri zapnutých detských jedlách', async () => {
    await mountSettings('owner', { kidsEnabled: false })
    expect(row('ranajky').textContent).toContain('Raňajky')
    expect(row('ranajky').textContent).toContain('2 z 12')
    expect(row('vecera').textContent).toContain('10 z 10')
    expect(document.body.querySelector('[data-test="sample-group-kids"]')).toBeNull()
    document.body.innerHTML = ''
    await mountSettings()
    expect(row('kids').textContent).toContain('Detské')
  })

  it('Pridať zavolá server po dávkach pre daný balík a ohlási počet', async () => {
    const { calls } = await mountSettings()
    row('desiata').querySelector<HTMLElement>('[data-test="sample-add"]')!.click()
    await flushPromises()
    const posts = calls.filter((c) => c.method === 'POST' && c.path === '/recipes/samples')
    expect(posts).toHaveLength(4)
    expect(posts.every((c) => c.url.includes('set=desiata'))).toBe(true)
    expect(document.body.textContent).toContain('Pridané: 10 receptov.')
  })

  it('Odstrániť sa najprv opýta, potom zmaže recepty balíka', async () => {
    const { calls } = await mountSettings()
    expect(row('desiata').querySelector('[data-test="sample-remove"]')!.hasAttribute('disabled')).toBe(true)
    row('vecera').querySelector<HTMLElement>('[data-test="sample-remove"]')!.click()
    await flushPromises()
    expect(calls.some((c) => c.path === '/recipes/samples/remove')).toBe(false)
    expect(document.body.querySelector('[data-test="sample-remove-dialog"]')!.textContent).toContain('Večera')
    document.body.querySelector<HTMLElement>('[data-test="sample-remove-confirm"]')!.click()
    await flushPromises()
    const remove = calls.find((c) => c.path === '/recipes/samples/remove')!
    expect(remove.url).toContain('set=vecera')
    expect(document.body.textContent).toContain('Odstránené: 10 receptov.')
  })

  it('v angličtine má balíky po anglicky', async () => {
    setLocale('en')
    await mountSettings()
    expect(row('olovrant').textContent).toContain('Afternoon snack')
  })

  it('člen domácnosti kartu nevidí', async () => {
    await mountSettings('member')
    expect(document.body.querySelector('[data-test="samples-card"]')).toBeNull()
  })
})

describe('Základné recepty – priebeh pridávania', () => {
  it('počas pridávania ukáže v tlačidle text s priebehom, nie prekrývajúce koliesko', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    let calls = 0
    stubApi({
      '/me': me('owner'),
      '/recipes/samples': STATUS,
      'POST /recipes/samples': async () => {
        calls++
        if (calls === 2) await gate
        return jsonResponse({ added: 4, remaining: calls === 1 ? 6 : 2 })
      },
      '/household/members': [],
      '/households': [{ id: 'h1', name: 'Doma', role: 'owner' }],
    })
    mount(
      { render: () => h(VApp, null, () => h(SettingsPage)) },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    row('desiata').querySelector<HTMLElement>('[data-test="sample-add"]')!.click()
    await flushPromises()
    const button = row('desiata').querySelector<HTMLElement>('[data-test="sample-add"]')!
    expect(button.classList.contains('v-btn--loading')).toBe(false)
    expect(button.textContent).toContain('Pridávam… 4 z 10')
    expect(row('desiata').querySelector('[data-test="sample-remove"]')).toBeNull()
    release()
    await flushPromises()
  })
})
