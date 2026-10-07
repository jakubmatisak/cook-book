import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { VDefaultsProvider } from 'vuetify/components'
import FavoriteButton from '@/features/recipes/components/FavoriteButton.vue'
import { densityDefaults } from '@/design/density'
import { mountPlugins } from './helpers/apiStub'

describe('tlačidlo obľúbených', () => {
  it('sa pri kompaktnej hustote nezmenší (srdce by sa orezalo) a v zozname má čitateľnú veľkosť', () => {
    const wrapper = mount(
      {
        render: () =>
          h(VDefaultsProvider, { defaults: densityDefaults('compact') }, () =>
            h(FavoriteButton, { recipeId: 'r1', isFavorite: true, size: 'small' }),
          ),
      },
      { global: { plugins: mountPlugins() } },
    )
    const button = wrapper.find('.v-btn')
    expect(button.classes()).toContain('v-btn--density-default')
    expect(button.classes()).toContain('v-btn--size-small')
  })
})
