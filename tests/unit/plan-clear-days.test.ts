import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import type { PlanEntryDto } from '@shared/api'
import { weekDates } from '@shared/dates'
import ClearDaysDialog from '@/features/meal-plan/components/ClearDaysDialog.vue'
import { jsonResponse, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const MON = '2026-10-05'
const TUE = '2026-10-06'
const WED = '2026-10-07'

const entry = (id: string, date: string, leftoverOfEntryId: string | null = null) =>
  ({ id, date, slotId: 's1', recipeId: 'r1', leftoverOfEntryId }) as unknown as PlanEntryDto

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
async function click(selector: string) {
  const el = q(selector)
  if (!el) throw new Error(`Chýba ${selector}`)
  el.click()
  await flushPromises()
}

function mountDialog(entries: PlanEntryDto[]) {
  const calls = stubApi({ 'POST /plan/clear': () => jsonResponse({ removed: 3 }) })
  const onCleared = vi.fn()
  mount(
    {
      render: () =>
        h(VApp, null, () =>
          h(ClearDaysDialog, { modelValue: true, dates: weekDates(MON), entries, onCleared }),
        ),
    },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  return { calls, onCleared }
}

describe('vymazať jedlá vybraných dní', () => {
  it('vyberie dni, ukáže počet jedál a po potvrdení ich zmaže', async () => {
    const { calls, onCleared } = mountDialog([
      entry('a', MON),
      entry('b', MON),
      entry('c', TUE),
      entry('d', WED),
    ])
    await flushPromises()
    expect(q('[data-test="clear-days-confirm"]')!.hasAttribute('disabled')).toBe(true)
    await click(`[data-test="clear-day-${MON}"]`)
    await click(`[data-test="clear-day-${TUE}"]`)
    expect(q('[data-test="clear-days-dialog"]')!.textContent).toContain('Zmaže sa 3 jedlá.')
    await click('[data-test="clear-days-confirm"]')
    const call = calls.find((c) => c.path === '/plan/clear')!
    expect(call.body).toEqual({ dates: [MON, TUE] })
    expect(onCleared).toHaveBeenCalledWith(3)
  })

  it('celý týždeň vyberie všetky dni; upozorní na zvyšky v nevybraných dňoch', async () => {
    mountDialog([entry('a', MON), entry('b', TUE, 'a')])
    await flushPromises()
    await click(`[data-test="clear-day-${MON}"]`)
    expect(q('[data-test="clear-days-dialog"]')!.textContent).toContain('zmažú sa aj jeho zvyšky')
    await click('[data-test="clear-days-week"]')
    expect(q('[data-test="clear-days-dialog"]')!.textContent).toContain('Zmaže sa 2 jedlá.')
    expect(q('[data-test="clear-days-dialog"]')!.textContent).not.toContain('zmažú sa aj jeho zvyšky')
  })
})
