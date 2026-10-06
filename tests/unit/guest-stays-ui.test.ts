import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { FamilyMemberDto, GuestStayDto, PlanEntryDto } from '@shared/api'
import GuestStayDialog from '@/features/meal-plan/components/GuestStayDialog.vue'
import GuestStaysBar from '@/features/meal-plan/components/GuestStaysBar.vue'
import PlanEntryCard from '@/features/meal-plan/components/PlanEntryCard.vue'
import { setLocale } from '@/i18n'
import { createAppVuetify } from '@/plugins/vuetify'
import { jsonResponse, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

const person = (over: Partial<FamilyMemberDto> & { id: string; name: string }): FamilyMemberDto => ({
  kind: 'guest',
  birthDate: null,
  portionFactor: 1,
  color: '#B4532A',
  isActive: true,
  sortOrder: 0,
  preferences: [],
  ...over,
})

const mama = person({ id: 'a1', name: 'Mama', kind: 'adult' })
const eva = person({ id: 'g1', name: 'Teta Eva' })
const peter = person({ id: 'g2', name: 'Strýko Peter' })
const stay = (id: string, memberId: string, fromDate: string, toDate: string): GuestStayDto => ({
  id,
  memberId,
  fromDate,
  toDate,
})

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('GuestStaysBar', () => {
  const mountBar = (stays: GuestStayDto[]) =>
    mount(GuestStaysBar, {
      props: { stays, members: [mama, eva, peter] },
      global: { plugins: [createAppVuetify()] },
    })

  it('pobyty s rovnakými dňami zlúči do jedného čipu s menami a rozsahom dní', () => {
    const wrapper = mountBar([
      stay('s1', 'g1', '2026-10-06', '2026-10-08'),
      stay('s2', 'g2', '2026-10-06', '2026-10-08'),
      stay('s3', 'g1', '2026-10-10', '2026-10-10'),
    ])
    const chips = wrapper.findAll('[data-test="stay-chip"]')
    expect(chips.map((c) => c.text())).toEqual([
      'Teta Eva, Strýko Peter · 6. 10. – 8. 10.',
      'Teta Eva · 10. 10.',
    ])
  })

  it('zrušenie čipu vyšle všetky pobyty skupiny a pridanie vyšle add', async () => {
    const wrapper = mountBar([
      stay('s1', 'g1', '2026-10-06', '2026-10-08'),
      stay('s2', 'g2', '2026-10-06', '2026-10-08'),
    ])
    await wrapper.find('[data-test="stay-chip"] .v-chip__close').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual([['s1', 's2']])
    await wrapper.find('[data-test="stay-add"]').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('bez pobytov ostane len tlačidlo na pridanie', () => {
    const wrapper = mountBar([])
    expect(wrapper.findAll('[data-test="stay-chip"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Pridať návštevu')
  })
})

describe('GuestStayDialog', () => {
  async function mountDialog(members: FamilyMemberDto[], canAddGuests = true) {
    const calls = stubApi({
      'POST /plan/stays': (call: StubCall) =>
        jsonResponse(
          (call.body as { memberIds: string[] }).memberIds.map((memberId, i) => ({
            id: `s${i}`,
            memberId,
            fromDate: '2026-10-06',
            toDate: '2026-10-08',
          })),
          201,
        ),
    })
    const saved = vi.fn()
    mount(
      {
        render: () =>
          h(VApp, null, () =>
            h(GuestStayDialog, {
              modelValue: true,
              members,
              weekFrom: '2026-10-05',
              weekTo: '2026-10-11',
              canAddGuests,
              onSaved: saved,
            }),
          ),
      },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    return { calls, saved }
  }

  it('predvyplní týždeň a po výbere členov návštevy uloží pobyt pre všetkých naraz', async () => {
    const { calls, saved } = await mountDialog([mama, eva, peter])
    const from = document.body.querySelector<HTMLInputElement>('[data-test="stay-from"] input')!
    const to = document.body.querySelector<HTMLInputElement>('[data-test="stay-to"] input')!
    expect([from.value, to.value]).toEqual(['2026-10-05', '2026-10-11'])

    // výber viacerých osôb z návštevy
    const select = document.body.querySelector<HTMLElement>('[data-test="stay-guests"] input')!
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()
    const items = [...document.body.querySelectorAll<HTMLElement>('.v-list-item')]
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Teta Eva', 'Strýko Peter']) // dospelý sa nenavrhuje
    items[0]!.click()
    await flushPromises()
    document.body.querySelectorAll<HTMLElement>('.v-list-item')[1]!.click()
    await flushPromises()

    document.body.querySelector<HTMLElement>('[data-test="stay-save"]')!.click()
    await flushPromises()
    const post = calls.find((c) => c.method === 'POST' && c.path === '/plan/stays')!
    expect(post.body).toEqual({ memberIds: ['g1', 'g2'], fromDate: '2026-10-05', toDate: '2026-10-11' })
    expect(saved).toHaveBeenCalled()
  })

  it('bez výberu osoby ukáže chybu a nič nepošle', async () => {
    const { calls } = await mountDialog([mama, eva, peter])
    document.body.querySelector<HTMLElement>('[data-test="stay-save"]')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-test="stay-error"]')?.textContent).toContain(
      'Vyber aspoň jednu osobu z návštevy.',
    )
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('jediná návšteva je predvybraná', async () => {
    const { calls } = await mountDialog([mama, eva])
    document.body.querySelector<HTMLElement>('[data-test="stay-save"]')!.click()
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ memberIds: ['g1'] })
  })

  it('bez návštev v Rodine vysvetlí, čo urobiť, a uloženie je zakázané', async () => {
    await mountDialog([mama])
    expect(document.body.querySelector('[data-test="stay-no-guests"]')?.textContent).toContain(
      'Najprv pridaj návštevu v sekcii Pri stole',
    )
    expect(document.body.querySelector('[data-test="stay-save"]')?.hasAttribute('disabled')).toBe(true)
  })

  it('v angličtine sú texty po anglicky', async () => {
    setLocale('en')
    await mountDialog([mama, eva])
    expect(document.body.textContent).toContain('Visitors staying with us')
    expect(document.body.textContent).toContain('Whole displayed week')
  })
})

describe('karta jedla s pobytom návštevy', () => {
  const entry: PlanEntryDto = {
    id: 'e1',
    date: '2026-10-06',
    slotId: 's1',
    recipeId: null,
    recipe: null,
    freeText: 'Obed',
    servingsOverride: null,
    note: null,
    sortOrder: 0,
    audience: 'all',
    guestIds: [],
    presentGuestIds: ['g1'],
    warnings: [],
  }

  it('prítomná návšteva z pobytu sa ukáže a počíta do porcií, hoci nebola vybraná ručne', () => {
    const wrapper = mount(PlanEntryCard, {
      props: { entry, members: [mama, eva] },
      global: { plugins: [createAppVuetify()] },
    })
    expect(wrapper.text()).toContain('2 porc.')
    expect(wrapper.text()).toContain('Návšteva: Teta Eva')
  })
})
