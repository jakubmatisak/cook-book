import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HouseholdMembersCard from '@/features/households/components/HouseholdMembersCard.vue'
import { jsonResponse, me, member, mountPlugins, stubApi } from './helpers/apiStub'

const MEMBERS = [
  member({ email: 'ja@example.com', role: 'owner', locked: true, lastLoginAt: '2026-10-05T10:00:00.000Z' }),
  member({ email: 'host@example.com' }),
]

async function mountCard(isOwner: boolean, isAdmin = false, routes: Record<string, unknown> = {}) {
  const calls = stubApi({
    '/me': me(isOwner ? 'owner' : 'member', isAdmin),
    '/household/members': MEMBERS,
    ...routes,
  })
  const wrapper = mount(HouseholdMembersCard, {
    props: { isOwner },
    global: { plugins: mountPlugins() },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('HouseholdMembersCard', () => {
  it('vlastník vidí pozvánku, výber roly, odobratie a zámok pri e-maile zo zoznamu správcov', async () => {
    const { wrapper } = await mountCard(true)
    const rows = wrapper.findAll('[data-test="household-member"]')
    expect(rows).toHaveLength(2)
    expect(wrapper.find('[data-test="member-invite"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="member-role"]')).toHaveLength(2)
    // odobrať sa dá len pozvaný, nie e-mail zo zoznamu správcov (ten má zámok)
    expect(wrapper.findAll('[data-test="member-remove"]')).toHaveLength(1)
    expect(rows[0]!.text()).toContain('ja@example.com')
    expect(rows[1]!.text()).toContain('ešte sa neprihlásil')
  })

  it('člen vidí zoznam len na čítanie a vysvetlenie', async () => {
    const { wrapper } = await mountCard(false)
    expect(wrapper.findAll('[data-test="household-member"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="member-invite"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="member-role"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="member-remove"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('môže meniť len vlastník')
    expect(wrapper.find('[data-test="household-rename"] input').attributes('disabled')).toBeDefined()
  })

  it('tlačidlo Nová domácnosť vidí len správca aplikácie', async () => {
    expect((await mountCard(true, true)).wrapper.find('[data-test="household-new"]').exists()).toBe(true)
    document.body.innerHTML = ''
    expect((await mountCard(true, false)).wrapper.find('[data-test="household-new"]').exists()).toBe(false)
  })

  it('odobratie vyžaduje potvrdenie a zavolá DELETE pre daného člena', async () => {
    const { wrapper, calls } = await mountCard(true, false, {
      'DELETE /household/members/host@example.com': () => jsonResponse(null, 204),
    })
    await wrapper.find('[data-test="member-remove"]').trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    const confirm = document.body.querySelector<HTMLElement>('[data-test="member-remove-confirm"]')
    expect(confirm).not.toBeNull()
    confirm!.click()
    await flushPromises()
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual([
      '/household/members/host@example.com',
    ])
  })

  it('chybu servera (posledný vlastník) ukáže používateľovi', async () => {
    const { wrapper } = await mountCard(true, false, {
      'PUT /household/members/ja@example.com': () =>
        jsonResponse(
          { error: { code: 'last_owner', message: 'Domácnosť musí mať aspoň jedného vlastníka.' } },
          409,
        ),
    })
    const select = wrapper.findAllComponents({ name: 'VSelect' })[0]!
    select.vm.$emit('update:modelValue', 'member')
    await flushPromises()
    expect(document.body.textContent).toContain('Domácnosť musí mať aspoň jedného vlastníka.')
  })
})
