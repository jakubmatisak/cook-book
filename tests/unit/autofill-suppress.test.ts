import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'
import { VAutocomplete, VCombobox } from 'vuetify/components'
import { createAppVuetify } from '@/plugins/vuetify'

describe('vypnuté dopĺňanie prehliadača', () => {
  it.each([
    ['v-autocomplete', VAutocomplete],
    ['v-combobox', VCombobox],
  ])('%s nenavrhuje uložené hodnoty prehliadača', (_name, component) => {
    const wrapper = mount(() => h(component, { items: ['a', 'b'], label: 'Alergie' }), {
      global: { plugins: [createAppVuetify()] },
    })
    const input = wrapper.find('input')
    expect(input.attributes('autocomplete')).toBe('off')
  })
})

describe('výber z ponuky', () => {
  it('v-autocomplete po výbere položky zmaže napísané hľadanie', async () => {
    const selected = ref<string[]>([])
    const wrapper = mount(
      () =>
        h(VAutocomplete, {
          items: ['Karfiol', 'Kel'],
          multiple: true,
          modelValue: selected.value,
          'onUpdate:modelValue': (v: string[]) => (selected.value = v),
        }),
      { global: { plugins: [createAppVuetify()] }, attachTo: document.body },
    )
    const input = wrapper.find('input[type="text"]')
    await input.trigger('focus')
    await input.setValue('karf')
    await flushPromises()
    const item = document.body.querySelector<HTMLElement>('.v-list-item')
    expect(item?.textContent).toContain('Karfiol')
    item?.click()
    await flushPromises()
    expect(selected.value).toEqual(['Karfiol'])
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})
