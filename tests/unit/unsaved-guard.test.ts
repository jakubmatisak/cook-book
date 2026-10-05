import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'

function setup(initial: boolean) {
  const dirty = ref(initial)
  const wrapper = mount(
    defineComponent({
      setup() {
        useUnsavedChangesGuard(dirty)
        return () => h('div')
      },
    }),
  )
  const fire = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  return { dirty, wrapper, fire }
}

describe('useUnsavedChangesGuard', () => {
  it('pri neuložených zmenách zabráni zatvoreniu alebo obnoveniu stránky', () => {
    const { fire, dirty } = setup(true)
    expect(fire()).toBe(true)
    dirty.value = false
    expect(fire()).toBe(false)
  })

  it('po odchode zo stránky už nezasahuje', () => {
    const { fire, wrapper } = setup(true)
    wrapper.unmount()
    expect(fire()).toBe(false)
  })
})
