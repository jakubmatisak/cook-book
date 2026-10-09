import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { VApp } from 'vuetify/components'
import type { FamilyMemberDto, RecipeSummaryDto } from '@shared/api'
import MemberDialog from '@/features/family/components/MemberDialog.vue'
import FamilyPage from '@/features/family/pages/FamilyPage.vue'
import { jsonResponse, me, mountPlugins, stubApi, type StubCall } from './helpers/apiStub'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const anna: FamilyMemberDto = {
  id: 'm1',
  name: 'Anna',
  kind: 'adult',
  birthDate: null,
  portionFactor: 1,
  color: '#B4532A',
  isActive: true,
  sortOrder: 0,
  preferences: [{ kind: 'dislike_recipe', ingredientId: null, tagId: null, recipeId: 'r1', label: 'Guláš' }],
}
const gulas: RecipeSummaryDto = {
  id: 'r1',
  title: 'Guláš',
  slug: 'gulas',
  category: 'hlavne',
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 1,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
}

describe('neobľúbené jedlá v Pri stole', () => {
  it('zoznam ukáže neobľúbené jedlo ako štítok', async () => {
    stubApi({ '/me': { ...me('owner'), members: [anna] } })
    const wrapper = mount(FamilyPage, { global: { plugins: mountPlugins() }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.text()).toContain('Neobľúbené jedlo: Guláš')
  })

  it('v okne člena sa dá dopísať jedlo, ktoré v kuchárke nie je, a uloží sa spolu s receptom', async () => {
    const calls = stubApi({
      '/me': { ...me('owner'), members: [anna] },
      '/ingredients': [],
      '/tags': [],
      '/recipes': {
        items: [gulas],
        facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} },
      },
      'PUT /members/m1': anna,
      'PUT /members/m1/preferences': () => jsonResponse(anna),
    })
    const open = ref(false)
    const wrapper = mount(
      {
        render: () =>
          h(VApp, null, () =>
            h(MemberDialog, { modelValue: open.value, member: anna, childFactor: 0.5, nextColor: '#B4532A' }),
          ),
      },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    await flushPromises()
    open.value = true
    await nextTick()
    await flushPromises()
    const field = document.body.querySelector('[data-test="disliked-recipes"]')!
    expect(field.textContent).toContain('Guláš')
    // Dopísaný text (Enter v poli) pridá do zoznamu reťazec vedľa vybraného receptu.
    const combobox = wrapper.findComponent({ name: 'VCombobox' })
    combobox.vm.$emit('update:modelValue', [{ title: 'Guláš', value: 'r1' }, 'rybacia polievka'])
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-test="member-save"]')!.click()
    await flushPromises()
    const put = calls.find((c: StubCall) => c.method === 'PUT' && c.path === '/members/m1/preferences')
    expect((put?.body as { dislikedRecipes: unknown }).dislikedRecipes).toEqual([
      { recipeId: 'r1' },
      { text: 'rybacia polievka' },
    ])
    wrapper.unmount()
  })
})
