import { describe, expect, it } from 'vitest'
import { useLeavePrompt } from '@/composables/useLeavePrompt'

describe('useLeavePrompt', () => {
  it('ask otvorí okno a vráti odpoveď používateľa', async () => {
    const prompt = useLeavePrompt()
    expect(prompt.open.value).toBe(false)
    const answer = prompt.ask()
    expect(prompt.open.value).toBe(true)
    prompt.answer(true)
    expect(await answer).toBe(true)
    expect(prompt.open.value).toBe(false)

    const second = prompt.ask()
    prompt.answer(false)
    expect(await second).toBe(false)
  })

  it('nová otázka počas otvorenej zruší predošlú ako „zostať“', async () => {
    const prompt = useLeavePrompt()
    const first = prompt.ask()
    const second = prompt.ask()
    expect(await first).toBe(false)
    prompt.answer(true)
    expect(await second).toBe(true)
  })

  it('odpoveď bez otázky nič nerobí', () => {
    const prompt = useLeavePrompt()
    expect(() => prompt.answer(true)).not.toThrow()
    expect(prompt.open.value).toBe(false)
  })
})
