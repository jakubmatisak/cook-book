import { and, asc, eq, exists, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type {
  RecipeDetailDto,
  RecipeListDto,
  RecipeSummaryDto,
  SampleRecipesResult,
  TagDto,
} from '../../shared/api'
import {
  applyRecipeFilters,
  computeFacets,
  sortRecipes,
  type FacetRow,
  type RecipeFilters as FacetFilters,
  type SortDir,
  type SortKey,
} from '../../shared/recipeFacets'
import type { RecipeVisibility } from '../../shared/recipes'
import { SAMPLE_RECIPES } from '../../shared/data/sampleRecipes'
import { recipeInputSchema, type RecipeInput } from '../../shared/schemas/recipe'
import { normalizeText, slugify } from '../../shared/text'
import { newId } from '../../shared/ids'
import type { Db } from '../db/client'
import {
  images,
  ingredients,
  mealPlanEntries,
  recipeFavorites,
  recipeIngredients,
  recipes,
  recipeSteps,
  recipeTags,
  tags,
} from '../db/schema'
import type { UserRow } from '../env'
import { HttpError, isUniqueViolation } from '../errors'
import { chunk } from '../http'
import { resolveIngredients, resolveTags } from './catalog'
import { ignoredPantryCategoryIds, pantryIngredientIds } from './pantry'

type RecipeRow = typeof recipes.$inferSelect

export interface RecipeListOptions extends FacetFilters {
  q?: string
  /** Pridať chýbajúce ingrediencie a (bez explicitného zoradenia) zoradiť podľa nich. */
  pantry?: boolean
  sort?: SortKey
  dir?: SortDir
}

export const imageUrl = (r2Key: string) => `/img/${r2Key}`

const notFound = () => new HttpError(404, 'not_found', 'Recept neexistuje.')

const liveRecipe = (householdId: string, id: string) =>
  and(eq(recipes.id, id), eq(recipes.householdId, householdId), isNull(recipes.deletedAt))

async function findLive(db: Db, householdId: string, id: string): Promise<RecipeRow> {
  const row = await db.select().from(recipes).where(liveRecipe(householdId, id)).get()
  if (!row) throw notFound()
  return row
}

async function uniqueSlug(db: Db, householdId: string, base: string, exceptId?: string): Promise<string> {
  const rows = await db
    .select({ slug: recipes.slug })
    .from(recipes)
    .where(
      and(
        eq(recipes.householdId, householdId),
        or(eq(recipes.slug, base), sql`${recipes.slug} like ${`${base}-%`}`),
        exceptId ? ne(recipes.id, exceptId) : undefined,
      ),
    )
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

async function assertImage(db: Db, householdId: string, imageId: string | null) {
  if (!imageId) return
  const found = await db
    .select({ id: images.id })
    .from(images)
    .where(and(eq(images.id, imageId), eq(images.householdId, householdId)))
    .get()
  if (!found) throw new HttpError(400, 'invalid_image', 'Fotka neexistuje.')
}

const isSlugConflict = (error: unknown) => isUniqueViolation(error, 'slug')

/** Vytvorí alebo prepíše recept vrátane ingrediencií, krokov a tagov; vráti jeho id. */
export async function saveRecipe(db: Db, user: UserRow, input: RecipeInput, id?: string): Promise<string> {
  const householdId = user.householdId
  const existing = id ? await findLive(db, householdId, id) : undefined
  await assertImage(db, householdId, input.coverImageId)

  const ingredientIds = await resolveIngredients(
    db,
    householdId,
    input.ingredients.map((i) => ({ name: i.name, unit: i.unit })),
  )
  const tagIds = [...new Set(await resolveTags(db, householdId, input.tags))]
  const recipeId = existing?.id ?? newId()
  const keepSlug = existing && existing.title === input.title

  // Slug sa počíta pred zápisom; pri súbežnom uložení rovnakého názvu zlyhá UNIQUE – vtedy ho prepočítame.
  for (let attempt = 1; ; attempt++) {
    const slug = keepSlug
      ? existing.slug
      : await uniqueSlug(db, householdId, slugify(input.title), existing?.id)
    try {
      await db.batch(buildStatements(slug))
      return recipeId
    } catch (error) {
      if (keepSlug || attempt >= 5 || !isSlugConflict(error)) throw error
    }
  }

  function buildStatements(slug: string): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
    const values = {
      title: input.title,
      titleNormalized: normalizeText(input.title),
      slug,
      description: input.description,
      category: input.category,
      servings: input.servings,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      difficulty: input.difficulty,
      sourceUrl: input.sourceUrl,
      sourceText: input.sourceText,
      coverImageId: input.coverImageId,
    }

    const statements: BatchItem<'sqlite'>[] = existing
      ? [
          db.update(recipes).set(values).where(eq(recipes.id, recipeId)),
          db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)),
          db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId)),
          db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId)),
        ]
      : [db.insert(recipes).values({ id: recipeId, householdId, createdBy: user.id, ...values })]

    // Po jednom riadku na príkaz – D1 dovolí max 100 viazaných parametrov.
    input.ingredients.forEach((item, sortOrder) => {
      statements.push(
        db.insert(recipeIngredients).values({
          recipeId,
          ingredientId: ingredientIds.get(normalizeText(item.name))!,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          groupName: item.groupName,
          isOptional: item.isOptional,
          sortOrder,
        }),
      )
    })
    input.steps.forEach((step, index) => {
      statements.push(
        db.insert(recipeSteps).values({
          recipeId,
          position: index + 1,
          text: step.text,
          timerSeconds: step.timerSeconds,
        }),
      )
    })
    if (tagIds.length) {
      statements.push(db.insert(recipeTags).values(tagIds.map((tagId) => ({ recipeId, tagId }))))
    }

    const [first, ...rest] = statements
    return [first!, ...rest]
  }
}

/** Najviac toľko ukážkových receptov sa pridá na jedno volanie (limit dopytov na jedno spustenie Workera). */
const SAMPLE_BATCH = 4

/**
 * Pridá ukážkové recepty, ktoré domácnosť ešte nemá (podľa názvu bez diakritiky), po dávkach.
 * Vráti, koľko sa pridalo a koľko ešte chýba; volá sa opakovane, kým `remaining` nie je 0.
 */
export async function addSampleRecipes(db: Db, user: UserRow): Promise<SampleRecipesResult> {
  const existing = await db
    .select({ title: recipes.titleNormalized })
    .from(recipes)
    .where(and(eq(recipes.householdId, user.householdId), isNull(recipes.deletedAt)))
  const have = new Set(existing.map((r) => r.title))
  const missing = SAMPLE_RECIPES.filter((r) => !have.has(normalizeText(r.title)))
  const batch = missing.slice(0, SAMPLE_BATCH)
  for (const sample of batch) await saveRecipe(db, user, recipeInputSchema.parse(sample))
  return { added: batch.length, remaining: missing.length - batch.length }
}

/** Zmení viditeľnosť receptu domácnosti (súkromný ↔ verejný). */
export async function setRecipeVisibility(
  db: Db,
  householdId: string,
  id: string,
  visibility: RecipeVisibility,
): Promise<void> {
  const changed = await db
    .update(recipes)
    .set({ visibility })
    .where(liveRecipe(householdId, id))
    .returning({ id: recipes.id })
  if (changed.length === 0) throw notFound()
}

/** Zmaže recept aj jeho záznamy v jedálničku (ručné záznamy bez receptu ostanú). */
export async function deleteRecipe(db: Db, householdId: string, id: string): Promise<void> {
  const [deleted] = await db.batch([
    db
      .update(recipes)
      .set({ deletedAt: new Date().toISOString() })
      .where(liveRecipe(householdId, id))
      .returning({ id: recipes.id }),
    db.delete(mealPlanEntries).where(
      and(
        eq(mealPlanEntries.householdId, householdId),
        eq(mealPlanEntries.recipeId, id),
        // len ak recept skutočne patrí domácnosti (inak by sa nesprávne ID dostalo k cudzím záznamom)
        sql`exists (select 1 from recipes r where r.id = ${id} and r.household_id = ${householdId})`,
      ),
    ),
  ])
  if (deleted.length === 0) throw notFound()
}

export async function setFavorite(db: Db, user: UserRow, id: string, favorite: boolean): Promise<void> {
  await findLive(db, user.householdId, id)
  if (favorite) {
    await db.insert(recipeFavorites).values({ recipeId: id, userId: user.id }).onConflictDoNothing()
  } else {
    await db
      .delete(recipeFavorites)
      .where(and(eq(recipeFavorites.recipeId, id), eq(recipeFavorites.userId, user.id)))
  }
}

export const lastCookedSql = sql<
  string | null
>`(select max(c.cooked_on) from cook_log c where c.recipe_id = "recipes"."id")`

export const isFavoriteSql = (userId: string) =>
  sql<number>`exists (select 1 from recipe_favorites f where f.recipe_id = "recipes"."id" and f.user_id = ${userId})`.mapWith(
    (v) => Boolean(Number(v)),
  )

export function toSummary(
  row: RecipeRow,
  r2Key: string | null,
  isFavorite: boolean,
  tagList: TagDto[],
  lastCookedAt: string | null,
): RecipeSummaryDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    difficulty: row.difficulty,
    coverImageUrl: r2Key ? imageUrl(r2Key) : null,
    tags: tagList,
    isFavorite,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastCookedAt,
  }
}

export async function getRecipeDetail(
  db: Db,
  householdId: string,
  userId: string,
  id: string,
): Promise<RecipeDetailDto> {
  const [head, ingredientRows, stepRows, tagRows] = await db.batch([
    db
      .select({
        recipe: recipes,
        r2Key: images.r2Key,
        isFavorite: isFavoriteSql(userId),
        lastCookedAt: lastCookedSql,
      })
      .from(recipes)
      .leftJoin(images, eq(images.id, recipes.coverImageId))
      .where(liveRecipe(householdId, id)),
    db
      .select({ row: recipeIngredients, name: ingredients.name })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(asc(recipeIngredients.sortOrder)),
    db.select().from(recipeSteps).where(eq(recipeSteps.recipeId, id)).orderBy(asc(recipeSteps.position)),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(recipeTags)
      .innerJoin(tags, eq(tags.id, recipeTags.tagId))
      .where(eq(recipeTags.recipeId, id))
      .orderBy(asc(tags.name)),
  ])
  const found = head[0]
  if (!found) throw notFound()
  const pantry = await pantryIngredientIds(db, householdId)
  const r = found.recipe
  return {
    ...toSummary(r, found.r2Key, found.isFavorite, tagRows, found.lastCookedAt),
    description: r.description,
    sourceUrl: r.sourceUrl,
    sourceText: r.sourceText,
    coverImageId: r.coverImageId,
    ingredients: ingredientRows.map(({ row, name }) => ({
      id: row.id,
      ingredientId: row.ingredientId,
      name,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note,
      groupName: row.groupName,
      isOptional: row.isOptional,
      inPantry: pantry.has(row.ingredientId),
    })),
    steps: stepRows.map((s) => ({
      id: s.id,
      position: s.position,
      text: s.text,
      timerSeconds: s.timerSeconds,
    })),
  }
}

const emptyList = (): RecipeListDto => ({
  items: [],
  facets: { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} },
})

const totalMinutes = (r: Pick<RecipeSummaryDto, 'prepMinutes' | 'cookMinutes'>): number | null =>
  r.prepMinutes === null && r.cookMinutes === null ? null : (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0)

/** Chýbajúce povinné ingrediencie (to, čo nie je v špajzi) po receptoch. */
async function missingByRecipe(
  db: Db,
  householdId: string,
  ids: string[],
  ignoredCategories: ReadonlySet<string>,
): Promise<Map<string, string[]>> {
  const pantry = await pantryIngredientIds(db, householdId)
  const missing = new Map<string, string[]>()
  for (const part of chunk(ids, 90)) {
    const ingRows = await db
      .select({
        recipeId: recipeIngredients.recipeId,
        ingredientId: recipeIngredients.ingredientId,
        name: ingredients.name,
        shopCategoryId: ingredients.shopCategoryId,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(and(inArray(recipeIngredients.recipeId, part), eq(recipeIngredients.isOptional, false)))
      .orderBy(asc(recipeIngredients.sortOrder))
    for (const row of ingRows) {
      if (pantry.has(row.ingredientId)) continue
      if (row.shopCategoryId && ignoredCategories.has(row.shopCategoryId)) continue
      const list = missing.get(row.recipeId) ?? []
      if (!list.includes(row.name)) list.push(row.name)
      missing.set(row.recipeId, list)
    }
  }
  return missing
}

/**
 * Zoznam receptov s počtami pre filtre. SQL vyberie recepty domácnosti (a hľadaný text),
 * filtre, počty a zoradenie robí čistá logika zo `shared/recipeFacets` – domácnosť má
 * desiatky až stovky receptov, takže to ide v pamäti.
 */
export async function listRecipes(
  db: Db,
  householdId: string,
  userId: string,
  options: RecipeListOptions,
): Promise<RecipeListDto> {
  const conditions: (SQL | undefined)[] = [eq(recipes.householdId, householdId), isNull(recipes.deletedAt)]
  const needle = options.q ? normalizeText(options.q).replace(/[%_\\]/g, '') : ''
  if (options.q !== undefined && options.q.trim() !== '' && !needle) return emptyList()
  if (needle) {
    const like = `%${needle}%`
    conditions.push(
      or(
        sql`${recipes.titleNormalized} like ${like}`,
        exists(
          db
            .select({ one: sql`1` })
            .from(recipeIngredients)
            .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
            .where(
              and(
                eq(recipeIngredients.recipeId, recipes.id),
                sql`${ingredients.nameNormalized} like ${like}`,
              ),
            ),
        ),
      ),
    )
  }

  const rows = await db
    .select({
      recipe: recipes,
      r2Key: images.r2Key,
      isFavorite: isFavoriteSql(userId),
      lastCookedAt: lastCookedSql,
    })
    .from(recipes)
    .leftJoin(images, eq(images.id, recipes.coverImageId))
    .where(and(...conditions))
  if (rows.length === 0) return emptyList()

  const ids = rows.map((r) => r.recipe.id)
  const tagsByRecipe = new Map<string, TagDto[]>()
  const tagRows = await db
    .select({ recipeId: recipeTags.recipeId, id: tags.id, name: tags.name, color: tags.color })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .where(
      ids.length <= 90
        ? inArray(recipeTags.recipeId, ids)
        : inArray(
            recipeTags.recipeId,
            db
              .select({ id: recipes.id })
              .from(recipes)
              .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt))),
          ),
    )
    .orderBy(asc(tags.name))
  for (const t of tagRows) {
    const list = tagsByRecipe.get(t.recipeId) ?? []
    list.push({ id: t.id, name: t.name, color: t.color })
    tagsByRecipe.set(t.recipeId, list)
  }

  const ignored = options.pantry ? await ignoredPantryCategoryIds(db, householdId) : new Set<string>()
  const missing = options.pantry ? await missingByRecipe(db, householdId, ids, ignored) : null
  const candidates = rows.map((r) => {
    const tagList = tagsByRecipe.get(r.recipe.id) ?? []
    const summary: RecipeSummaryDto = {
      ...toSummary(r.recipe, r.r2Key, r.isFavorite, tagList, r.lastCookedAt),
      ...(missing ? { missing: missing.get(r.recipe.id) ?? [] } : {}),
    }
    const facetRow: FacetRow & { summary: RecipeSummaryDto } = {
      id: summary.id,
      title: summary.title,
      category: summary.category,
      difficulty: summary.difficulty,
      totalMinutes: totalMinutes(summary),
      tagIds: tagList.map((t) => t.id),
      isFavorite: summary.isFavorite,
      createdAt: summary.createdAt,
      lastCookedAt: summary.lastCookedAt,
      missing: summary.missing,
      summary,
    }
    return facetRow
  })

  // Filter „chýba najviac N“ dáva zmysel len pri „Čo viem uvariť“, kde recepty nesú chýbajúce suroviny.
  const { missingMax, ...rest } = options
  const filters = options.pantry && missingMax !== undefined ? { ...rest, missingMax } : rest
  const filtered = applyRecipeFilters(candidates, filters)
  // „Čo viem uvariť“ bez vlastného zoradenia: najmenej chýbajúceho ako prvé.
  const ordered =
    missing && !options.sort
      ? sortRecipes(filtered, 'name').sort(
          (a, b) => (a.summary.missing?.length ?? 0) - (b.summary.missing?.length ?? 0),
        )
      : sortRecipes(filtered, options.sort ?? 'name', options.dir)

  return { items: ordered.map((c) => c.summary), facets: computeFacets(candidates, filters) }
}
