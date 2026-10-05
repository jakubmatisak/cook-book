import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useToday } from '@/composables/useToday'

afterEach(() => vi.useRealTimers())

describe('useToday', () => {
  it('po návrate do aplikácie na druhý deň ukáže nový dátum', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5, 22, 0))
    let today!: ReturnType<typeof useToday>
    mount(
      defineComponent({
        setup() {
          today = useToday()
          return () => h('div')
        },
      }),
    )
    expect(today.value).toBe('2026-10-05')
    vi.setSystemTime(new Date(2026, 9, 6, 7, 30))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(today.value).toBe('2026-10-06')
  })
})
