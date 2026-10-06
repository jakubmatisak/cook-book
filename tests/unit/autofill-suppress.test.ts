import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
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
