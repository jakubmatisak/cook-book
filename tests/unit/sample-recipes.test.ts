import { describe, expect, it } from 'vitest'
import { SAMPLE_RECIPES } from '@shared/data/sampleRecipes'
import { RECIPE_CATEGORIES } from '@shared/recipes'
import { recipeInputSchema } from '@shared/schemas/recipe'
import { normalizeText } from '@shared/text'

describe('ukážkové recepty', () => {
  it('je ich 21 a názvy sa neopakujú', () => {
    expect(SAMPLE_RECIPES).toHaveLength(21)
    const titles = SAMPLE_RECIPES.map((r) => normalizeText(r.title))
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('každý recept prejde overením, má ingrediencie aj postup a kategóriu', () => {
    for (const recipe of SAMPLE_RECIPES) {
      const parsed = recipeInputSchema.safeParse(recipe)
      expect(parsed.success, recipe.title).toBe(true)
      expect(recipe.ingredients?.length, recipe.title).toBeGreaterThanOrEqual(3)
      expect(recipe.steps?.length, recipe.title).toBeGreaterThanOrEqual(2)
      expect(RECIPE_CATEGORIES, recipe.title).toContain(recipe.category)
      expect(recipe.description, recipe.title).toBeTruthy()
    }
  })

  it('pokrýva všetky hlavné typy jedla', () => {
    const categories = new Set(SAMPLE_RECIPES.map((r) => r.category))
    for (const c of ['polievka', 'hlavne', 'priloha', 'salat', 'dezert', 'ranajky']) {
      expect(categories.has(c as never), c).toBe(true)
    }
  })
})
