import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FamilyMemberDto } from '@shared/api'
import FamilyPage from '@/features/family/pages/FamilyPage.vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'
import { describeCadence, describeExpiry, summarizeGenerate } from '@/features/pantry/format'
import SettingsPage from '@/features/settings/pages/SettingsPage.vue'
import { setLocale } from '@/i18n'
import { clearActiveHousehold } from '@/lib/household'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

const person = (over: Partial<FamilyMemberDto> & { id: string; name: string }): FamilyMemberDto => ({
  kind: 'adult',
  birthDate: null,
  portionFactor: 1,
  color: '#B4532A',
  isActive: true,
  sortOrder: 0,
  preferences: [],
  ...over,
})

const anna = person({ id: 'm1', name: 'Anna' })
const guest = person({
  id: 'g1',
  name: 'Eva',
  kind: 'guest',
  portionFactor: 0.5,
  preferences: [{ kind: 'allergy', ingredientId: 'i1', tagId: null, label: 'Peanuts' }],
})

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  clearActiveHousehold()
  localStorage.clear()
  document.body.innerHTML = ''
})

async function mountSettings(role: 'owner' | 'member') {
  setLocale('en')
  stubApi({
    '/me': { ...me(role), members: [anna, guest] },
    '/household/members': [],
    '/households': [{ id: 'h1', name: 'Doma', role }],
  })
  const wrapper = mount(SettingsPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Settings in English', () => {
  it('owner sees the settings, the export card and English texts only', async () => {
    const wrapper = await mountSettings('owner')
    const text = wrapper.text()
    expect(text).toContain('Settings')
    expect(text).toContain('Household: Doma · 2 people in the family')
    expect(text).toContain('Signed in as ja@example.com.')
    expect(text).toContain('Meal plan')
    expect(text).toContain('Backup and export')
    expect(text).toContain('Export data')
    expect(text).toContain('Household and members')
    expect(text).toContain('Default child portion')
    expect(text).toContain('0.5 × adult')
    expect(text).not.toContain('Nastavenia')
    expect(text).not.toContain('Záloha')
    expect(text).not.toContain('Domácnosť')
    expect(wrapper.find('[data-test="owner-only-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="export-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="ignore-spices"] input').attributes('disabled')).toBeUndefined()
  })

  it('member gets the owner-only explanation and no export card', async () => {
    const wrapper = await mountSettings('member')
    const note = wrapper.find('[data-test="owner-only-note"]')
    expect(note.exists()).toBe(true)
    expect(note.text()).toBe('Only the owner can change the household settings.')
    expect(wrapper.text()).toContain(
      'Only the owner can change the members, name and settings of the household.',
    )
    expect(wrapper.text()).not.toContain('Backup and export')
    expect(wrapper.text()).not.toContain('len vlastník')
    expect(wrapper.find('[data-test="export-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="ignore-spices"] input').attributes('disabled')).toBeDefined()
  })
})

describe('Family in English', () => {
  async function mountFamily(role: 'owner' | 'member') {
    setLocale('en')
    stubApi({ '/me': { ...me(role), members: [anna, guest] } })
    const wrapper = mount(FamilyPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  it('shows the guest group, portions in English and the preference chips', async () => {
    const wrapper = await mountFamily('owner')
    expect(wrapper.find('[data-test="guests-heading"]').text()).toBe('Guests')
    const text = wrapper.text()
    expect(text).toContain('At the table')
    expect(text).toContain('For one meal for the whole family: 1 serving')
    expect(text).toContain('Adult · portion 1')
    expect(text).toContain('Guest · portion 0.5')
    expect(text).toContain('Allergy: Peanuts')
    expect(text).toContain(
      'A guest is counted in portions and warnings only once you pick them for a meal in the plan.',
    )
    expect(text).toContain('Add')
    expect(text).not.toContain('Návšteva')
    expect(text).not.toContain('Pridať')
    expect(text).not.toContain('porcia')
  })

  it('member sees the read-only note without the Add button', async () => {
    const wrapper = await mountFamily('member')
    const note = wrapper.find('[data-test="family-readonly"]')
    expect(note.text()).toBe('Only the household owner can change the family and their preferences.')
    expect(wrapper.text()).not.toContain('Add')
  })
})

describe('Household picker in English', () => {
  it('shows the picker with translated role labels', async () => {
    setLocale('en')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              { id: 'a', name: 'Home', role: 'owner' },
              { id: 'b', name: 'Parents', role: 'member' },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    )
    const wrapper = mount(HouseholdGate, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Choose a household')
    expect(text).toContain('You are a member of several households.')
    const options = wrapper.findAll('[data-test="household-option"]')
    expect(options).toHaveLength(2)
    expect(options[0]!.text()).toContain('Owner')
    expect(options[1]!.text()).toContain('Member')
    expect(text).not.toContain('Vyber domácnosť')
    expect(text).not.toContain('Vlastník')
  })
})

describe('Pantry texts in English', () => {
  it('describes expiry, cadence and the generated shopping summary', () => {
    setLocale('en')
    expect(describeExpiry('2026-10-06', '2026-10-05')).toBe('Expires tomorrow')
    expect(describeExpiry('2026-10-08', '2026-10-05')).toBe('Expires in 3 days')
    expect(describeExpiry('2026-10-04', '2026-10-05')).toBe('Expired 1 day ago')
    expect(describeCadence(1)).toBe('Every week')
    expect(describeCadence(6)).toBe('Every 6 weeks')
    expect(
      summarizeGenerate({
        added: 5,
        kept: 1,
        removed: 0,
        staples: 2,
        covered: ['Flour', 'Eggs'],
        reduced: ['Salt'],
      }),
    ).toBe(
      'Added 5 items, of which 2 recurring. The pantry covered 2 items (Flour, Eggs) and reduced the quantity: Salt. Kept as bought: 1.',
    )
  })
})
