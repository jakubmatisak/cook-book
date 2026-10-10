import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VApp } from 'vuetify/components'
import ShareWithDialog from '@/features/sharing/components/ShareWithDialog.vue'
import { setLocale } from '@/i18n'
import { mountPlugins, stubApi } from './helpers/apiStub'

afterEach(() => {
  setLocale('sk')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mountDialog(props: Record<string, unknown>) {
  const calls = stubApi({
    '/contacts': [{ id: 'c1', email: 'svokra@example.com', name: 'Svokra' }],
    '/tags': [{ id: 't1', name: 'Vianoce', color: null }],
    '/me': {
      user: { id: 'u1', email: 'ja@example.com', name: 'ja', memberId: null, role: 'owner', isAdmin: false },
      userSettings: {},
    },
    'POST /sharing': { sent: 2 },
  })
  const done = vi.fn()
  const wrapper = mount(
    {
      render: () => h(VApp, null, () => h(ShareWithDialog, { modelValue: true, onDone: done, ...props })),
    },
    { global: { plugins: mountPlugins() }, attachTo: document.body },
  )
  await flushPromises()
  return { wrapper, calls, done }
}

const sendButton = () => document.querySelector<HTMLButtonElement>('[data-test="share-send"]')!

describe('dialóg Zdieľať s…', () => {
  it('pošle vybrané recepty na zadané e-maily so správou a ukáže súhrn', async () => {
    const { wrapper, calls, done } = await mountDialog({ recipeIds: ['r1', 'r2'] })
    expect(sendButton().disabled).toBe(true)

    const combobox = wrapper.findComponent({ name: 'VCombobox' })
    combobox.vm.$emit('update:modelValue', ['Svokra@Example.com', 'mama@example.com'])
    await flushPromises()
    expect(document.body.textContent).toContain('Zdieľaš 2 recepty s 2 ľuďmi.')
    // Nový e-mail (nie je v kontaktoch): pripomienka Cloudflare Access.
    expect(document.querySelector('[data-test="share-access-hint"]')?.textContent).toContain(
      'mama@example.com',
    )

    const message = document.querySelector<HTMLTextAreaElement>('[data-test="share-message"] textarea')!
    message.value = 'Z Vianoc'
    message.dispatchEvent(new Event('input'))
    await flushPromises()

    sendButton().click()
    await flushPromises()
    const sent = calls.find((c) => c.method === 'POST' && c.path === '/sharing')
    expect(sent?.body).toEqual({
      emails: ['svokra@example.com', 'mama@example.com'],
      kind: 'recipes',
      recipeIds: ['r1', 'r2'],
      message: 'Z Vianoc',
    })
    expect(done).toHaveBeenCalled()
  })

  it('neplatný e-mail zablokuje odoslanie a ukáže chybu', async () => {
    const { wrapper } = await mountDialog({ recipeIds: ['r1'] })
    wrapper.findComponent({ name: 'VCombobox' }).vm.$emit('update:modelValue', ['nie-je-mail'])
    await flushPromises()
    expect(sendButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('Neplatný e-mail: nie-je-mail')
  })

  it('bez receptov ponúkne celú kategóriu alebo tag', async () => {
    const { wrapper, calls } = await mountDialog({ kind: 'tag', tagId: 't1' })
    wrapper.findComponent({ name: 'VCombobox' }).vm.$emit('update:modelValue', ['svokra@example.com'])
    await flushPromises()
    expect(document.body.textContent).toContain('Zdieľaš tag Vianoce s 1 človekom.')
    sendButton().click()
    await flushPromises()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/sharing')?.body).toEqual({
      emails: ['svokra@example.com'],
      kind: 'tag',
      tagId: 't1',
      message: null,
    })
  })
})
