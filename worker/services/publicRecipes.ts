import { and, desc, eq, inArray, isNull, like } from 'drizzle-orm'
import type { PublicRecipeDetailDto, PublicRecipeSummaryDto, RecipeDetailDto, TagDto } from '../../shared/api'
import type { RecipeCategory } from '../../shared/recipes'
import { recipeInputSchema } from '../../shared/schemas/recipe'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import { households, images, recipes, recipeTags, tags } from '../db/schema'
import type { AuthUser } from '../env'
import { HttpError } from '../errors'
import { chunk } from '../http'
import { storeImage } from './images'
import { getRecipeDetail, saveRecipe, toSummary } from './recipes'

/** Najviac toľko verejných receptov sa vráti naraz (zoznam je určený na prehliadanie, nie na export). */
const PUBLIC_LIST_LIMIT = 200

const notFound = () => new HttpError(404, 'not_found', 'Recept neexistuje.')

/** Verejné recepty všetkých domácností, najnovšie prvé; filtrujú sa podľa názvu a typu jedla. */
export async function listPublicRecipes(
  db: Db,
  user: Pick<AuthUser, 'householdId'>,
  query: { q?: string; category: RecipeCategory[] },
): Promise<PublicRecipeSummaryDto[]> {
  const needle = query.q ? normalizeText(query.q) : ''
  const rows = await db
    .select({ recipe: recipes, r2Key: images.r2Key, householdName: households.name })
    .from(recipes)
    .innerJoin(households, eq(households.id, recipes.householdId))
    .leftJoin(images, eq(images.id, recipes.coverImageId))
    .where(
      and(
        eq(recipes.visibility, 'public'),
        isNull(recipes.deletedAt),
        needle ? like(recipes.titleNormalized, `%${needle}%`) : undefined,
        query.category.length ? inArray(recipes.category, query.category) : undefined,
      ),
    )
    .orderBy(desc(recipes.createdAt))
    .limit(PUBLIC_LIST_LIMIT)

  const tagsOf = new Map<string, TagDto[]>()
  for (const ids of chunk(
    rows.map((r) => r.recipe.id),
    90,
  )) {
    const tagRows = await db
      .select({ recipeId: recipeTags.recipeId, id: tags.id, name: tags.name, color: tags.color })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(inArray(recipeTags.recipeId, ids))
    for (const { recipeId, ...tag } of tagRows) tagsOf.set(recipeId, [...(tagsOf.get(recipeId) ?? []), tag])
  }

  return rows.map((r) => ({
    ...toSummary(r.recipe, r.r2Key, false, tagsOf.get(r.recipe.id) ?? [], null),
    householdName: r.householdName,
    ownedByMe: r.recipe.householdId === user.householdId,
  }))
}

/** Detail verejného receptu; súkromný alebo zmazaný recept sa tvári, že neexistuje. */
export async function getPublicRecipe(
  db: Db,
  user: Pick<AuthUser, 'id' | 'householdId'>,
  id: string,
): Promise<PublicRecipeDetailDto> {
  const found = await db
    .select({ householdId: recipes.householdId, householdName: households.name })
    .from(recipes)
    .innerJoin(households, eq(households.id, recipes.householdId))
    .where(and(eq(recipes.id, id), eq(recipes.visibility, 'public'), isNull(recipes.deletedAt)))
    .get()
  if (!found) throw notFound()
  const detail = await getRecipeDetail(db, found.householdId, user.id, id)
  return {
    ...detail,
    // Špajza patrí inej domácnosti, preto sa o nej nič neprezradí.
    ingredients: detail.ingredients.map((i) => ({ ...i, inPantry: false })),
    householdName: found.householdName,
    ownedByMe: found.householdId === user.householdId,
  }
}

/** Skopíruje verejný recept do aktívnej domácnosti ako nezávislý súkromný recept (aj s fotkou). */
export async function copyPublicRecipe(
  db: Db,
  bucket: R2Bucket,
  user: AuthUser,
  id: string,
): Promise<RecipeDetailDto> {
  const source = await getPublicRecipe(db, user, id)
  if (source.ownedByMe) {
    throw new HttpError(400, 'own_recipe', 'Tento recept už máš vo svojej domácnosti.')
  }

  let coverImageId: string | null = null
  const sourceKey = source.coverImageUrl?.replace(/^\/img\//, '')
  if (sourceKey) {
    const object = await bucket.get(sourceKey)
    const meta = await db
      .select({ width: images.width, height: images.height })
      .from(images)
      .where(eq(images.r2Key, sourceKey))
      .get()
    if (object) {
      const stored = await storeImage(db, bucket, user, new Uint8Array(await object.arrayBuffer()), {
        width: meta?.width ?? null,
        height: meta?.height ?? null,
      })
      coverImageId = stored.id
    }
  }

  const input = recipeInputSchema.parse({
    title: source.title,
    description: source.description,
    category: source.category,
    servings: source.servings,
    prepMinutes: source.prepMinutes,
    cookMinutes: source.cookMinutes,
    difficulty: source.difficulty,
    sourceUrl: source.sourceUrl,
    sourceText: source.sourceText,
    coverImageId,
    ingredients: source.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note,
      groupName: i.groupName,
      isOptional: i.isOptional,
    })),
    steps: source.steps.map((s) => ({ text: s.text, timerSeconds: s.timerSeconds })),
    tags: source.tags.map((t) => t.name),
  })
  const copyId = await saveRecipe(db, user, input)
  // Pôvod kópie: ukazuje na pôvodný recept (po jeho zmazaní sa väzba sama zruší).
  await db.update(recipes).set({ parentRecipeId: id }).where(eq(recipes.id, copyId))
  return getRecipeDetail(db, user.householdId, user.id, copyId)
}

/** Fotka verejného receptu sa smie zobraziť aj ľuďom mimo domácnosti. */
export async function isPublicImage(db: Db, r2Key: string): Promise<boolean> {
  const row = await db
    .select({ id: recipes.id })
    .from(recipes)
    .innerJoin(images, eq(images.id, recipes.coverImageId))
    .where(and(eq(images.r2Key, r2Key), eq(recipes.visibility, 'public'), isNull(recipes.deletedAt)))
    .get()
  return row !== undefined
}
