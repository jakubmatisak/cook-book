import { describe, expect, it } from 'vitest'
import type { ImportRecipeResultDto } from '@shared/api'
import { importToForm } from '@/features/recipes/form'
import { createImportHandoff } from '@/features/recipes/importHandoff'
import { formToInput } from '@/features/recipes/form'

const result: ImportRecipeResultDto = {
  recipe: {
    title: 'Palacinky',
    description: 'Tenké.',
    category: 'dezert',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: null,
    sourceUrl: 'https://example.com/p',
    coverImageId: 'img1',
    tags: ['detské', 'rýchle'],
    ingredients: [
      { name: 'mlieka', quantity: 250, unit: 'ml', note: null, isOptional: false },
      { name: 'cukru', quantity: 1.5, unit: 'PL', note: '2–3', isOptional: false },
      { name: 'soľ', quantity: null, unit: null, note: null, isOptional: false },
    ],
    steps: [{ text: 'Zmiešaj.' }, { text: 'Upeč.', timerSeconds: 150 }],
  },
  coverImageUrl: '/img/h/img1.png',
  warnings: ['Postup sa nenašiel, doplň ho ručne.'],
}

describe('importToForm', () => {
  it('prevedie importovaný recept na formulár so zobrazením čísel po slovensky', () => {
    const form = importToForm(result)
    expect(form).toMatchObject({
      title: 'Palacinky',
      category: 'dezert',
      servings: 4,
      prepMinutes: '10',
      cookMinutes: '',
      sourceUrl: 'https://example.com/p',
      coverImageId: 'img1',
      coverImageUrl: '/img/h/img1.png',
      tags: ['detské', 'rýchle'],
    })
    expect(form.ingredients.map((i) => [i.name, i.quantity, i.unit, i.note])).toEqual([
      ['mlieka', '250', 'ml', ''],
      ['cukru', '1,5', 'PL', '2–3'],
      ['soľ', '', null, ''],
    ])
    expect(form.steps.map((s) => [s.text, s.timerMinutes])).toEqual([
      ['Zmiešaj.', ''],
      ['Upeč.', '2,5'],
    ])
  })

  it('po spätnom prevode na vstup zachová obsah receptu', () => {
    const input = formToInput(importToForm(result))
    expect(input).toMatchObject({
      title: 'Palacinky',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: null,
      coverImageId: 'img1',
    })
    expect(input.ingredients?.[1]).toMatchObject({ name: 'cukru', quantity: 1.5, unit: 'PL', note: '2–3' })
    expect(input.steps?.[1]).toMatchObject({ text: 'Upeč.', timerSeconds: 150 })
  })

  it('prázdny import dostane aspoň po jednom prázdnom riadku', () => {
    const form = importToForm({ recipe: { title: 'Nič' }, coverImageUrl: null, warnings: [] })
    expect(form.ingredients).toHaveLength(1)
    expect(form.steps).toHaveLength(1)
    expect(form).toMatchObject({ servings: 4, category: 'hlavne', difficulty: 1, coverImageUrl: null })
  })
})

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('createImportHandoff', () => {
  it('odovzdá výsledok práve raz', () => {
    const handoff = createImportHandoff(fakeStorage())
    handoff.put(result)
    expect(handoff.take()).toEqual(result)
    expect(handoff.take()).toBeNull()
  })

  it('poškodený obsah alebo zlyhanie úložiska je null, nie chyba', () => {
    const storage = fakeStorage()
    storage.setItem('kniha:import', '{nie json')
    expect(createImportHandoff(storage).take()).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('zablokované')
      },
      setItem: () => {
        throw new Error('zablokované')
      },
      removeItem: () => {
        throw new Error('zablokované')
      },
    }
    const handoff = createImportHandoff(broken)
    expect(() => handoff.put(result)).not.toThrow()
    expect(handoff.take()).toBeNull()
  })

  it('výsledok bez názvu receptu sa neprijme', () => {
    const storage = fakeStorage()
    storage.setItem('kniha:import', JSON.stringify({ recipe: {}, coverImageUrl: null, warnings: [] }))
    expect(createImportHandoff(storage).take()).toBeNull()
  })
})
