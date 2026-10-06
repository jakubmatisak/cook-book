import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { VApp } from 'vuetify/components'
import type { FamilyMemberDto, GuestStayDto, MealSlotDto } from '@shared/api'
import EntryDialog from '@/features/meal-plan/components/EntryDialog.vue'
import { setLocale } from '@/i18n'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

// jsdom nemá IndexedDB, ktorý používa fronta odškrtnutí bez signálu.
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => {}, del: async () => {} }))

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
const romana = person({ id: 'g1', name: 'Romana' })
const peter = person({ id: 'g2', name: 'Peter' })
const slots: MealSlotDto[] = [{ id: 's1', name: 'Obed', sortOrder: 0, isEnabled: true, defaultTime: '12:00' }]
const stay = (memberId: string, fromDate: string, toDate: string): GuestStayDto => ({
  id: `stay-${memberId}`,
  memberId,
  fromDate,
  toDate,
})

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/** Dialóg sa v aplikácii otvára za behu, preto sa pripojí zatvorený a otvorí sa až potom. */
async function openDialog(stays: GuestStayDto[], initialDate = '2026-10-06') {
  const calls = stubApi({
    '/me': me('owner'),
    '/recipes': { items: [], facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} } },
    'POST /plan/entries': jsonResponse({}, 201),
  })
  const open = ref(false)
  mount(
    {
      render: () =>
        h(VApp, null, () =>
          h(EntryDialog, {
            modelValue: open.value,
            'onUpdate:modelValue': (v: boolean) => (open.value = v),
            entry: null,
            initialDate,
            initialSlotId: 's1',
            slots,
            dates: ['2026-10-05', '2026-10-06', '2026-10-12'],
            members: [mama, romana, peter],
            stays,
          }),
        ),
    },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  open.value = true
  await nextTick()
  await flushPromises()
  return { calls }
}

const guestSelect = () => document.body.querySelector('[data-test="entry-guests"]')
const chips = () => [...(guestSelect()?.querySelectorAll('.v-chip') ?? [])].map((c) => c.textContent?.trim())

describe('Pridať jedlo: návšteva podľa pobytu', () => {
  it('návšteva s pobytom na ten deň je v poli „Návšteva pri jedle“ predvolene vybraná', async () => {
    await openDialog([stay('g1', '2026-10-05', '2026-10-11')])
    expect(chips()).toEqual(['Romana'])
  })

  it('návšteva, ktorá v ten deň nie je, vybraná nie je', async () => {
    await openDialog([stay('g1', '2026-10-05', '2026-10-11')], '2026-10-12')
    expect(chips()).toEqual([])
  })

  it('pobyty viacerých návštev v ten deň sa vyberú všetky', async () => {
    await openDialog([stay('g1', '2026-10-05', '2026-10-11'), stay('g2', '2026-10-06', '2026-10-06')])
    expect(chips().sort()).toEqual(['Peter', 'Romana'])
  })

  it('vybraná návšteva z pobytu sa nedá odobrať (chip nie je zatvárateľný)', async () => {
    await openDialog([stay('g1', '2026-10-05', '2026-10-11')])
    expect(guestSelect()?.querySelector('.v-chip .v-chip__close')).toBeNull()
  })

  it('porcie sa počítajú aj s návštevou z pobytu a nápis o pobyte pod poľom už nie je', async () => {
    await openDialog([stay('g1', '2026-10-05', '2026-10-11')])
    expect(document.body.querySelector('[data-test="entry-stay-hint"]')).toBeNull()
    const placeholders = [...document.body.querySelectorAll('input')].map((i) =>
      i.getAttribute('placeholder'),
    )
    expect(placeholders).toContain('2 podľa rodiny')
  })
})
