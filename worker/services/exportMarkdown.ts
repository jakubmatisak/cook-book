import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { RecipeMarkdownInput } from '../../shared/markdown'
import type { Db } from '../db/client'
import { ingredients, recipeIngredients, recipes, recipeSteps, recipeTags, tags } from '../db/schema'

/**
 * Všetky recepty domácnosti pre export do Markdownu, zoradené podľa názvu.
 * Jeden `db.batch` (štyri dotazy), aby sa export zmestil do limitu dotazov na jedno volanie Workera.
 */
export async function loadRecipesForMarkdown(db: Db, householdId: string): Promise<RecipeMarkdownInput[]> {
  const live = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt)))

  const [recipeRows, ingredientRows, stepRows, tagRows] = await db.batch([
    db
      .select()
      .from(recipes)
      .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt)))
      .orderBy(asc(recipes.titleNormalized)),
    db
      .select({
        recipeId: recipeIngredients.recipeId,
        name: ingredients.name,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        note: recipeIngredients.note,
        groupName: recipeIngredients.groupName,
        isOptional: recipeIngredients.isOptional,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(inArray(recipeIngredients.recipeId, live))
      .orderBy(asc(recipeIngredients.sortOrder)),
    db
      .select({
        recipeId: recipeSteps.recipeId,
        text: recipeSteps.text,
        timerSeconds: recipeSteps.timerSeconds,
      })
      .from(recipeSteps)
      .where(inArray(recipeSteps.recipeId, live))
      .orderBy(asc(recipeSteps.position)),
    db
      .select({ recipeId: recipeTags.recipeId, name: tags.name })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(inArray(recipeTags.recipeId, live))
      .orderBy(asc(tags.name)),
  ])

  const group = <T extends { recipeId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>()
    for (const row of rows) map.set(row.recipeId, [...(map.get(row.recipeId) ?? []), row])
    return map
  }
  const ingredientsOf = group(ingredientRows)
  const stepsOf = group(stepRows)
  const tagsOf = group(tagRows)

  return recipeRows.map((r) => ({
    title: r.title,
    description: r.description,
    category: r.category,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    difficulty: r.difficulty,
    sourceUrl: r.sourceUrl,
    sourceText: r.sourceText,
    tags: (tagsOf.get(r.id) ?? []).map((t) => ({ name: t.name })),
    ingredients: (ingredientsOf.get(r.id) ?? []).map(({ recipeId: _recipeId, ...i }) => i),
    steps: (stepsOf.get(r.id) ?? []).map(({ recipeId: _recipeId, ...s }) => s),
  }))
}
