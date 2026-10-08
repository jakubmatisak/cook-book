import { focusManager } from '@tanstack/vue-query'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useShoppingItems } from '@/api/shopping'
import { mountPlugins, stubApi } from './helpers/apiStub'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  focusManager.setFocused(undefined)
})

const Items = defineComponent({
  setup() {
    const { data } = useShoppingItems('l1')
    return () => h('div', String(data.value?.length ?? '-'))
  },
})

const itemCalls = (calls: { path: string }[]) =>
  calls.filter((c) => c.path === '/shopping/lists/l1/items').length

describe('žiadne samovoľné požiadavky na server', () => {
  it('otvorený nákupný zoznam sa sám od seba neobnovuje', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    const calls = stubApi({ '/shopping/lists/l1/items': [] })
    mount(Items, { global: { plugins: mountPlugins() } })
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()
    expect(itemCalls(calls)).toBe(1)

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(itemCalls(calls)).toBe(1)
  })

  it('po návrate do aplikácie sa zoznam načíta znova (zmeny od druhého človeka)', async () => {
    const calls = stubApi({ '/shopping/lists/l1/items': [] })
    mount(Items, { global: { plugins: mountPlugins() } })
    await flushPromises()
    expect(itemCalls(calls)).toBe(1)

    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await flushPromises()
    expect(itemCalls(calls)).toBe(2)
  })
})
