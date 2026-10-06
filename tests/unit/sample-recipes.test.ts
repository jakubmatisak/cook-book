import { describe, expect, it } from 'vitest'
import { BABY_RECIPES } from '@shared/data/babyRecipes'
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

describe('detské ukážkové recepty', () => {
  it('je ich 23, názvy sa neopakujú ani neprekrývajú so základnými', () => {
    expect(BABY_RECIPES).toHaveLength(23)
    const titles = [...BABY_RECIPES, ...SAMPLE_RECIPES].map((r) => normalizeText(r.title))
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('každý je v kategórii Detské so značkou veku, 1–2 porciami, ingredienciami a postupom', () => {
    for (const recipe of BABY_RECIPES) {
      expect(recipeInputSchema.safeParse(recipe).success, recipe.title).toBe(true)
      expect(recipe.category, recipe.title).toBe('detske')
      expect(recipe.tags, recipe.title).toContain('Do 18 mesiacov')
      expect(recipe.servings, recipe.title).toBeLessThanOrEqual(2)
      expect(recipe.ingredients?.length, recipe.title).toBeGreaterThanOrEqual(1)
      expect(recipe.steps?.length, recipe.title).toBeGreaterThanOrEqual(2)
      expect(recipe.description, recipe.title).toContain('Bez soli, cukru a medu')
    }
  })

  it('ingrediencie neobsahujú vodu ani soľ a cukor (nedostanú sa do nákupu)', () => {
    const names = BABY_RECIPES.flatMap((r) => r.ingredients ?? []).map((i) => normalizeText(i.name))
    for (const bad of ['voda', 'sol', 'cukor', 'med']) expect(names).not.toContain(bad)
  })
})
