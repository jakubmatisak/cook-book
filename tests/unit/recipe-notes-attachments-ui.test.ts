import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VApp } from 'vuetify/components'
import type { RecipeAttachmentDto, RecipeDetailDto, SharedRecipeDto } from '@shared/api'
import App from '@/App.vue'
import RecipeAttachmentsEditor from '@/features/recipes/components/RecipeAttachmentsEditor.vue'
import RecipeDetailPage from '@/features/recipes/pages/RecipeDetailPage.vue'
import { setLocale } from '@/i18n'
import { routes } from '@/router'
import { jsonResponse, me, mountPlugins, stubApi } from './helpers/apiStub'

vi.mock('@/lib/image', () => ({
  MAX_IMAGE_SIDE: 1600,
  resizeImage: vi.fn(async (file: File) => ({ blob: file, width: 1200, height: 1600 })),
}))

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const page = (n: number): RecipeAttachmentDto => ({
  id: `a${n}`,
  url: `/img/h/strana-${n}.webp`,
  width: 1200,
  height: 1600,
})

const detail = (over: Partial<RecipeDetailDto> = {}): RecipeDetailDto => ({
  id: 'r1',
  title: 'Krémeš',
  slug: 'kremes',
  category: 'dezert',
  servings: 12,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 2,
  coverImageUrl: null,
  tags: [],
  isFavorite: false,
  visibility: 'private',
  createdAt: 'x',
  updatedAt: 'x',
  lastCookedAt: null,
  description: null,
  sourceUrl: null,
  sourceText: null,
  coverImageId: null,
  shareToken: null,
  ingredients: [],
  steps: [],
  ...over,
})

const Blank = defineComponent({ render: () => h('div') })

async function mountDetail(recipe: RecipeDetailDto) {
  stubApi({ '/me': me('owner'), '/tags': [], '/recipes/r1': recipe })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recipes/:id', component: Blank },
      { path: '/recipes', component: Blank },
    ],
  })
  await router.push('/recipes/r1')
  await router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, null, () => h(RecipeDetailPage)) },
    { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body },
  )
  await flushPromises()
  return wrapper
}

describe('poznámky a prílohy v detaile receptu', () => {
  it('galéria príloh je nad poznámkami; klik na náhľad ju otvorí na celú obrazovku', async () => {
    const wrapper = await mountDetail(
      detail({ notes: 'Vody je odhad.\nPôvodný zápis: Preosiatu múku…', attachments: [page(1), page(2)] }),
    )
    const gallery = wrapper.find('[data-test="recipe-attachments"]')
    const notes = wrapper.find('[data-test="recipe-notes"]')
    expect(gallery.findAll('[data-test="attachment-thumb"]')).toHaveLength(2)
    expect(notes.text()).toContain('Pôvodný zápis: Preosiatu múku…')
    // Galéria je v stránke pred poznámkami.
    expect(
      gallery.element.compareDocumentPosition(notes.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await gallery.findAll('[data-test="attachment-thumb"]')[1]!.trigger('click')
    await flushPromises()
    const viewer = document.body.querySelector('[data-test="attachment-viewer"]')
    expect(viewer).not.toBeNull()
    expect(viewer!.textContent).toContain('2 / 2')
  })

  it('zdroj je úplne dole, pod galériou aj poznámkami', async () => {
    const wrapper = await mountDetail(
      detail({ notes: 'Prepis', attachments: [page(1)], sourceText: 'Katkina starká' }),
    )
    const notes = wrapper.find('[data-test="recipe-notes"]').element
    const source = wrapper.find('[data-test="recipe-source"]')
    expect(source.text()).toContain('Katkina starká')
    expect(notes.compareDocumentPosition(source.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('bez poznámok a príloh sa tieto časti neukážu', async () => {
    const wrapper = await mountDetail(detail())
    expect(wrapper.find('[data-test="recipe-attachments"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="recipe-notes"]').exists()).toBe(false)
  })
})

describe('poznámky na stránke zdieľaného receptu', () => {
  it('ukáže poznámky (prílohy odkaz nemá)', async () => {
    const shared: SharedRecipeDto = {
      id: 'r1',
      title: 'Krémeš',
      category: 'dezert',
      servings: 12,
      prepMinutes: null,
      cookMinutes: null,
      difficulty: 2,
      coverImageUrl: null,
      description: null,
      sourceUrl: null,
      sourceText: 'Katkina starká',
      notes: 'Pôvodný zápis zo zošita',
      ingredients: [],
      steps: [],
    }
    stubApi({ '/shared/kod123': shared })
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/s/kod123')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [...mountPlugins(), router] }, attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-test="recipe-notes"]').text()).toContain('Pôvodný zápis zo zošita')
    const source = wrapper.find('[data-test="recipe-source"]').element
    const notes = wrapper.find('[data-test="recipe-notes"]').element
    expect(notes.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('[data-test="recipe-attachments"]').exists()).toBe(false)
  })
})

describe('prílohy v editore receptu', () => {
  function mountEditor(initial: RecipeAttachmentDto[]) {
    let uploaded = 0
    const calls = stubApi({
      'POST /images': () => {
        uploaded++
        return jsonResponse({ id: `n${uploaded}`, url: `/img/h/n${uploaded}.webp` }, 201)
      },
    })
    const model = ref(initial)
    const wrapper = mount(
      {
        render: () =>
          h(VApp, null, () =>
            h(RecipeAttachmentsEditor, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: RecipeAttachmentDto[]) => (model.value = v),
            }),
          ),
      },
      { global: { plugins: mountPlugins() }, attachTo: document.body },
    )
    return { wrapper, model, calls }
  }

  it('nahrá viac fotiek naraz a pridá ich na koniec v poradí výberu', async () => {
    const { wrapper, model, calls } = mountEditor([page(1)])
    const input = wrapper.find<HTMLInputElement>('[data-test="attachments-input"]')
    const files = [new File(['a'], 'strana-2.jpg', { type: 'image/jpeg' }), new File(['b'], 'strana-3.jpg')]
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(calls.filter((c) => c.method === 'POST' && c.path === '/images')).toHaveLength(2)
    expect(model.value.map((a) => a.id)).toEqual(['a1', 'n1', 'n2'])
    expect(model.value[1]).toMatchObject({ url: '/img/h/n1.webp', width: 1200, height: 1600 })
  })

  it('prílohu odoberie a posunie v poradí', async () => {
    const { wrapper, model } = mountEditor([page(1), page(2), page(3)])
    await wrapper.findAll('[data-test="attachment-move-up"]')[2]!.trigger('click')
    expect(model.value.map((a) => a.id)).toEqual(['a1', 'a3', 'a2'])
    await wrapper.findAll('[data-test="attachment-remove"]')[0]!.trigger('click')
    expect(model.value.map((a) => a.id)).toEqual(['a3', 'a2'])
  })
})
