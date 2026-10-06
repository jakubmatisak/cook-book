import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { VApp } from 'vuetify/components'
import IngredientRows from '@/features/recipes/components/IngredientRows.vue'
import { emptyIngredientRow, type IngredientRow } from '@/features/recipes/form'
import { setLocale } from '@/i18n'
import { me, mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const row = (name: string, groupName: string): IngredientRow => ({ ...emptyIngredientRow(), name, groupName })

function mountRows(initial: IngredientRow[]) {
  stubApi({ '/me': me('owner'), '/ingredients': [] })
  const rows = ref(initial)
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(IngredientRows, { modelValue: rows.value })) },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  return { rows, wrapper }
}

describe('skupiny ingrediencií pri ručnom zadávaní', () => {
  it('nový riadok preberie skupinu posledného riadku (Korpus, Náplň… sa nemusia písať znova)', async () => {
    const { rows, wrapper } = mountRows([row('sušienky', 'Korpus'), row('maslo', 'Korpus')])
    await flushPromises()
    const add = [...wrapper.findAll('button')].find((b) => b.text().includes('Pridať ingredienciu'))
    await add!.trigger('click')
    expect(rows.value).toHaveLength(3)
    expect(rows.value[2]!.groupName).toBe('Korpus')
  })

  it('prvý riadok začína bez skupiny', async () => {
    const { rows, wrapper } = mountRows([row('', '')])
    await flushPromises()
    const add = [...wrapper.findAll('button')].find((b) => b.text().includes('Pridať ingredienciu'))
    await add!.trigger('click')
    expect(rows.value[1]!.groupName).toBe('')
  })

  it('pole skupiny ponúka skupiny, ktoré recept už má', async () => {
    const { wrapper } = mountRows([row('sušienky', 'Korpus'), row('syr', 'Náplň'), row('maslo', 'Korpus')])
    await flushPromises()
    const groups = wrapper
      .findAllComponents({ name: 'VCombobox' })
      .filter((c) => String(c.props('label')).startsWith('Skupina'))
    expect(groups.length).toBe(3)
    expect(groups[0]!.props('items')).toEqual(['Korpus', 'Náplň'])
  })
})
