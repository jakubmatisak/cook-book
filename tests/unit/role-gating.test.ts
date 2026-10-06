import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyMemberDto } from '@shared/api'
import FamilyPage from '@/features/family/pages/FamilyPage.vue'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const anna: FamilyMemberDto = {
  id: 'm1',
  name: 'Anna',
  kind: 'adult',
  birthDate: null,
  portionFactor: 1,
  color: '#B4532A',
  isActive: true,
  sortOrder: 0,
  preferences: [],
}

const withFamily = (role: 'owner' | 'member') => ({ ...me(role), members: [anna] })

async function mountPage(page: typeof FamilyPage | typeof SettingsPage, role: 'owner' | 'member') {
  stubApi({
    '/me': withFamily(role),
    '/household/members': [],
    '/households': [{ id: 'h1', name: 'Doma', role }],
  })
  const wrapper = mount(page, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Rodina podľa roly', () => {
  it('vlastník vidí tlačidlo Pridať a môže upravovať', async () => {
    const wrapper = await mountPage(FamilyPage, 'owner')
    expect(wrapper.text()).toContain('Pridať')
    expect(wrapper.find('[data-test="family-readonly"]').exists()).toBe(false)
  })

  it('člen vidí rodinu len na čítanie bez tlačidla Pridať', async () => {
    const wrapper = await mountPage(FamilyPage, 'member')
    expect(wrapper.text()).toContain('Anna')
    expect(wrapper.text()).not.toContain('Pridať')
    expect(wrapper.find('[data-test="family-readonly"]').exists()).toBe(true)
  })
})

describe('Nastavenia podľa roly', () => {
  it('vlastník môže meniť nastavenia domácnosti a vidí export', async () => {
    const wrapper = await mountPage(SettingsPage, 'owner')
    expect(wrapper.find('[data-test="owner-only-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="export-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="ignore-spices"] input').attributes('disabled')).toBeUndefined()
  })

  it('člen má nastavenia domácnosti zakázané, vysvetlenie a nevidí export', async () => {
    const wrapper = await mountPage(SettingsPage, 'member')
    expect(wrapper.find('[data-test="owner-only-note"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="export-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="ignore-spices"] input').attributes('disabled')).toBeDefined()
  })
})
