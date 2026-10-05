import { describe, expect, it } from 'vitest'
import { recipeInputSchema } from '@shared/schemas/recipe'

const valid = {
  title: 'Guláš',
  category: 'hlavne',
  servings: 4,
  difficulty: 2,
  ingredients: [{ name: 'Cibuľa', quantity: 2, unit: 'ks', isOptional: false }],
  steps: [{ text: 'Nakrájaj cibuľu.' }],
  tags: ['Rýchle'],
}

describe('recipeInputSchema', () => {
  it('prijme platný recept a doplní predvolené hodnoty', () => {
    const parsed = recipeInputSchema.parse(valid)
    expect(parsed.description).toBeNull()
    expect(parsed.prepMinutes).toBeNull()
    expect(parsed.coverImageId).toBeNull()
    expect(parsed.ingredients[0]).toMatchObject({ note: null, groupName: null })
    expect(parsed.steps[0]).toMatchObject({ timerSeconds: null })
  })

  it('oreže medzery a zahodí duplicitné tagy bez ohľadu na veľkosť písmen', () => {
    const parsed = recipeInputSchema.parse({
      ...valid,
      title: '  Guláš ',
      tags: ['Rýchle', ' rýchle', 'Detské'],
    })
    expect(parsed.title).toBe('Guláš')
    expect(parsed.tags).toEqual(['Rýchle', 'Detské'])
  })

  it('odmietne prázdny názov, nulové porcie, neznámu jednotku a zápornú hodnotu', () => {
    expect(recipeInputSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false)
    expect(recipeInputSchema.safeParse({ ...valid, servings: 0 }).success).toBe(false)
    expect(
      recipeInputSchema.safeParse({
        ...valid,
        ingredients: [{ name: 'x', unit: 'libra', isOptional: false }],
      }).success,
    ).toBe(false)
    expect(
      recipeInputSchema.safeParse({ ...valid, ingredients: [{ name: 'x', quantity: -1, isOptional: false }] })
        .success,
    ).toBe(false)
  })

  it('odmietne neplatnú URL zdroja, ale prijme prázdnu ako null', () => {
    expect(recipeInputSchema.safeParse({ ...valid, sourceUrl: 'nie je url' }).success).toBe(false)
    expect(recipeInputSchema.parse({ ...valid, sourceUrl: '' }).sourceUrl).toBeNull()
  })
})
