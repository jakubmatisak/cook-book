import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import RecipeCover from '@/features/recipes/components/RecipeCover.vue'
import { mountPlugins } from './helpers/apiStub'

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  document.body.innerHTML = ''
})

function mountCover(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  return mount(RecipeCover, {
    props: { src: '/img/default/foto.webp' },
    global: { plugins: mountPlugins() },
    attachTo: document.body,
  })
}

describe('titulná fotka v detaile receptu', () => {
  it('od 600 px je menší štvorec vpravo, text ju obteká', () => {
    const img = mountCover(1280).find('[data-test="recipe-cover"]')
    expect(img.classes()).toContain('float-right')
    expect(img.attributes('style')).toContain('width: 40%')
    expect(img.attributes('style')).toContain('max-width: 320px')
  })

  it('na úzkom mobile (pod 600 px) je hore na celú šírku', () => {
    const img = mountCover(390).find('[data-test="recipe-cover"]')
    expect(img.classes()).not.toContain('float-right')
    expect(img.attributes('style') ?? '').not.toContain('max-width: 320px')
  })
})
