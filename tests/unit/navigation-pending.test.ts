import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { trackNavigation } from '@/router/navigationPending'

const Page = defineComponent({ render: () => h('div') })

describe('indikátor prechodu na inú stránku', () => {
  it('je zapnutý, kým sa sťahuje kód novej stránky, potom sa vypne', async () => {
    let finish!: () => void
    const slow = new Promise<typeof Page>((resolve) => (finish = () => resolve(Page)))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/ingredients', component: () => slow },
      ],
    })
    const pending = trackNavigation(router)
    await router.push('/')
    expect(pending.value).toBe(false)

    const navigation = router.push('/ingredients')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pending.value).toBe(true)
    finish()
    await navigation
    expect(pending.value).toBe(false)
  })

  it('vypne sa aj pri zlyhanej navigácii', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/zle', component: () => Promise.reject(new Error('offline')) },
      ],
    })
    const pending = trackNavigation(router)
    await router.push('/')
    await router.push('/zle').catch(() => {})
    expect(pending.value).toBe(false)
  })
})
