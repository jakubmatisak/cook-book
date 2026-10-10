import { and, asc, desc, eq, exists, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { RecipeDetailDto, RecipeListDto, RecipeSummaryDto, TagDto } from '../../shared/api'
import {
  applyRecipeFilters,
  computeFacets,
  sortRecipes,
  type FacetRow,
  type RecipeFilters as FacetFilters,
  type SortDir,
  type SortKey,
} from '../../shared/recipeFacets'
import { normalizeAlsoCategories, type RecipeVisibility } from '../../shared/recipes'
import type { RecipeInput } from '../../shared/schemas/recipe'
import { normalizeText, slugify } from '../../shared/text'
import { newId } from '../../shared/ids'
import type { Db } from '../db/client'
import {
  households,
  images,
  ingredients,
  mealPlanEntries,
  recipeAttachments,
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
import { releaseImages } from './imageCleanup'
import { ignoredPantryCategoryIds, pantryIngredientIds } from './pantry'
import { sharedByOwner, sharedFromName, sharedWithHouseholds, sharedWithLabels } from './sharing'

type RecipeRow = typeof recipes.$inferSelect

export interface RecipeListOptions extends FacetFilters {
  q?: string
  /** Pridať chýbajúce ingrediencie a (bez explicitného zoradenia) zoradiť podľa nich. */
  pantry?: boolean
  /** Recepty iných domácností (verejné): `include` ich pridá k mojim, `only` ukáže len cudzie. */
  publicMode?: 'include' | 'only'
  /** `only`: len cudzie recepty zdieľané s mojou domácnosťou (prijaté zdieľanie). */
  sharedMode?: 'only'
  /** Len moje recepty, ktoré niekomu zdieľam (čakajúca alebo prijatá ponuka). */
  sharedByMe?: boolean
  sort?: SortKey
  dir?: SortDir
}

/** Najviac toľko cudzích verejných receptov sa pridá do zoznamu (zoznam je na prehliadanie). */
const FOREIGN_LIMIT = 200

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
        // Bez LIKE: D1 povolí vzor najviac 50 bajtov a dlhý názov receptu by uloženie zhodil.
        or(eq(recipes.slug, base), sql`substr(${recipes.slug}, 1, ${base.length + 1}) = ${`${base}-`}`),
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

/** Všetky prílohy musia byť fotky tejto domácnosti. */
async function assertAttachments(db: Db, householdId: string, imageIds: readonly string[]) {
  if (imageIds.length === 0) return
  let found = 0
  for (const part of chunk(imageIds, 90)) {
    const rows = await db
      .select({ id: images.id })
      .from(images)
      .where(and(eq(images.householdId, householdId), inArray(images.id, part)))
    found += rows.length
  }
  if (found !== imageIds.length) throw new HttpError(400, 'invalid_image', 'Fotka neexistuje.')
}

/** Fotky príloh uvedených receptov (na zmazanie spolu s receptom). */
export async function attachmentImageIds(db: Db, recipeIds: readonly string[]): Promise<string[]> {
  const ids: string[] = []
  for (const part of chunk(recipeIds, 90)) {
    const rows = await db
      .select({ imageId: recipeAttachments.imageId })
      .from(recipeAttachments)
      .where(inArray(recipeAttachments.recipeId, part))
    ids.push(...rows.map((r) => r.imageId))
  }
  return ids
}

const isSlugConflict = (error: unknown) => isUniqueViolation(error, 'slug')

/**
 * Vytvorí alebo prepíše recept vrátane ingrediencií, krokov a tagov; vráti jeho id. S `bucket` po výmene titulnej
 * fotky zmaže starú, ak ju už nič nepoužíva.
 */
export async function saveRecipe(
  db: Db,
  user: UserRow,
  input: RecipeInput,
  id?: string,
  bucket?: R2Bucket,
  /** Len pri základných receptoch z Nastavení. */
  sampleKey?: string,
): Promise<string> {
  const householdId = user.householdId
  const existing = id ? await findLive(db, householdId, id) : undefined
  await assertImage(db, householdId, input.coverImageId)
  const attachmentIds = input.attachmentIds
  if (attachmentIds) await assertAttachments(db, householdId, attachmentIds)
  // Pri výmene príloh si zapamätáme pôvodné, aby sa odobraté fotky dali zmazať.
  const previousAttachments = existing && attachmentIds ? await attachmentImageIds(db, [existing.id]) : []

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
      if (bucket && existing) {
        const removed = previousAttachments.filter((imageId) => !attachmentIds?.includes(imageId))
        if (existing.coverImageId && existing.coverImageId !== input.coverImageId)
          removed.push(existing.coverImageId)
        await releaseImages(db, bucket, householdId, removed)
      }
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
      // Bez poľa (staršia verzia aplikácie) ostanú doterajšie; hlavný typ medzi nimi nebýva.
      alsoCategories: normalizeAlsoCategories(
        input.category,
        input.alsoCategories ?? existing?.alsoCategories ?? [],
      ),
      servings: input.servings,
      prepMinutes: input.prepMinutes,
      cookMinutes: input.cookMinutes,
      difficulty: input.difficulty,
      sourceUrl: input.sourceUrl,
      sourceText: input.sourceText,
      coverImageId: input.coverImageId,
      // Chýbajúce poznámky (staršia verzia aplikácie) sa nemenia.
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
      ...(sampleKey ? { sampleKey } : {}),
    }

    const statements: BatchItem<'sqlite'>[] = existing
      ? [
          db.update(recipes).set(values).where(eq(recipes.id, recipeId)),
          db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId)),
          db.delete(recipeSteps).where(eq(recipeSteps.recipeId, recipeId)),
          db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId)),
          ...(attachmentIds
            ? [db.delete(recipeAttachments).where(eq(recipeAttachments.recipeId, recipeId))]
            : []),
        ]
      : [db.insert(recipes).values({ id: recipeId, householdId, createdBy: user.id, ...values })]

    // Prílohy viacerými riadkami naraz (5 parametrov na riadok, D1 dovolí max 100).
    chunk(attachmentIds ?? [], 15).forEach((part, index) => {
      statements.push(
        db
          .insert(recipeAttachments)
          .values(part.map((imageId, i) => ({ recipeId, imageId, sortOrder: index * 15 + i }))),
      )
    })
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
/** Zmaže recept (označením) aj jeho plán; s `bucket` aj titulnú fotku, ak ju nepoužíva iný recept. */
export async function deleteRecipe(
  db: Db,
  householdId: string,
  id: string,
  bucket?: R2Bucket,
): Promise<void> {
  const attached = bucket ? await attachmentImageIds(db, [id]) : []
  const [deleted] = await db.batch([
    db
      .update(recipes)
      .set({ deletedAt: new Date().toISOString() })
      .where(liveRecipe(householdId, id))
      .returning({ id: recipes.id, coverImageId: recipes.coverImageId }),
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
  if (bucket) await releaseImages(db, bucket, householdId, [deleted[0]!.coverImageId, ...attached])
}

/** Overený recept – príznak domácnosti, mení sa bez otvárania editora. */
export async function setVerified(db: Db, householdId: string, id: string, verified: boolean): Promise<void> {
  await findLive(db, householdId, id)
  await db.update(recipes).set({ isVerified: verified }).where(eq(recipes.id, id))
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
    alsoCategories: row.alsoCategories,
    servings: row.servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    difficulty: row.difficulty,
    coverImageUrl: r2Key ? imageUrl(r2Key) : null,
    tags: tagList,
    isFavorite,
    isVerified: row.isVerified,
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
  const [head, ingredientRows, stepRows, tagRows, attachmentRows] = await db.batch([
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
    db
      .select({ id: images.id, r2Key: images.r2Key, width: images.width, height: images.height })
      .from(recipeAttachments)
      .innerJoin(images, eq(images.id, recipeAttachments.imageId))
      .where(eq(recipeAttachments.recipeId, id))
      .orderBy(asc(recipeAttachments.sortOrder)),
  ])
  const found = head[0]
  if (!found) throw notFound()
  const pantry = await pantryIngredientIds(db, householdId)
  const sharedWith = await sharedWithLabels(db, householdId, id)
  const r = found.recipe
  return {
    ...toSummary(r, found.r2Key, found.isFavorite, tagRows, found.lastCookedAt),
    description: r.description,
    sourceUrl: r.sourceUrl,
    sourceText: r.sourceText,
    coverImageId: r.coverImageId,
    shareToken: r.shareToken,
    copiedFrom: r.copiedFromName,
    sharedWith,
    notes: r.notes,
    attachments: attachmentRows.map((a) => ({
      id: a.id,
      url: imageUrl(a.r2Key),
      width: a.width,
      height: a.height,
    })),
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
 * desiatky až stovky receptov, takže to ide v pamäti. S `publicMode` pribudnú verejné recepty iných
 * domácností (s názvom domácnosti); štítky sa s mojimi párujú podľa názvu.
 */
export async function listRecipes(
  db: Db,
  householdId: string,
  userId: string,
  options: RecipeListOptions,
): Promise<RecipeListDto> {
  const needle = options.q ? normalizeText(options.q).replace(/[%_\\]/g, '') : ''
  if (options.q !== undefined && options.q.trim() !== '' && !needle) return emptyList()
  const like = `%${needle}%`
  const needleSql = needle
    ? or(
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
      )
    : undefined

  // „Len cudzie“ a „Zdieľané so mnou“: moje recepty sa preskočia.
  const rows =
    options.publicMode === 'only' || options.sharedMode === 'only'
      ? []
      : await db
          .select({
            recipe: recipes,
            r2Key: images.r2Key,
            isFavorite: isFavoriteSql(userId),
            lastCookedAt: lastCookedSql,
          })
          .from(recipes)
          .leftJoin(images, eq(images.id, recipes.coverImageId))
          .where(
            and(
              eq(recipes.householdId, householdId),
              isNull(recipes.deletedAt),
              needleSql,
              options.sharedByMe ? sharedByOwner() : undefined,
            ),
          )

  // Cudzie recepty zdieľané s mojou domácnosťou.
  const sharedRows =
    options.sharedMode === 'only'
      ? await db
          .select({ recipe: recipes, r2Key: images.r2Key, householdName: households.name })
          .from(recipes)
          .innerJoin(households, eq(households.id, recipes.householdId))
          .leftJoin(images, eq(images.id, recipes.coverImageId))
          .where(
            and(
              isNull(recipes.deletedAt),
              ne(recipes.householdId, householdId),
              sharedWithHouseholds([householdId]),
              needleSql,
            ),
          )
          .orderBy(desc(recipes.createdAt))
          .limit(FOREIGN_LIMIT)
      : []
  const senderName = new Map<string, string>()
  for (const id of new Set(sharedRows.map((r) => r.recipe.householdId))) {
    senderName.set(id, await sharedFromName(db, householdId, id))
  }

  // Cudzie verejné recepty (nie pri „čo viem uvariť“, kde sa počíta moja špajza).
  const publicRows =
    options.publicMode && !options.pantry && options.sharedMode !== 'only'
      ? await db
          .select({ recipe: recipes, r2Key: images.r2Key, householdName: households.name })
          .from(recipes)
          .innerJoin(households, eq(households.id, recipes.householdId))
          .leftJoin(images, eq(images.id, recipes.coverImageId))
          .where(
            and(
              eq(recipes.visibility, 'public'),
              isNull(recipes.deletedAt),
              ne(recipes.householdId, householdId),
              needleSql,
            ),
          )
          .orderBy(desc(recipes.createdAt))
          .limit(FOREIGN_LIMIT)
      : []
  const foreignRows: ((typeof publicRows)[number] & { sharedFrom?: string })[] = [
    ...sharedRows.map((r) => ({ ...r, sharedFrom: senderName.get(r.recipe.householdId) })),
    ...publicRows,
  ]
  if (rows.length === 0 && foreignRows.length === 0) return emptyList()

  const ids = rows.map((r) => r.recipe.id)
  const tagsByRecipe = new Map<string, TagDto[]>()
  const addTagRows = (tagRows: { recipeId: string; id: string; name: string; color: string | null }[]) => {
    for (const t of tagRows) {
      const list = tagsByRecipe.get(t.recipeId) ?? []
      list.push({ id: t.id, name: t.name, color: t.color })
      tagsByRecipe.set(t.recipeId, list)
    }
  }
  if (ids.length > 0) {
    addTagRows(
      await db
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
        .orderBy(asc(tags.name)),
    )
  }
  for (const part of chunk(
    foreignRows.map((r) => r.recipe.id),
    90,
  )) {
    addTagRows(
      await db
        .select({ recipeId: recipeTags.recipeId, id: tags.id, name: tags.name, color: tags.color })
        .from(recipeTags)
        .innerJoin(tags, eq(tags.id, recipeTags.tagId))
        .where(inArray(recipeTags.recipeId, part))
        .orderBy(asc(tags.name)),
    )
  }
  // Štítky cudzieho receptu sa v mojich filtroch zhodujú podľa názvu (id patria inej domácnosti).
  const myTagIdByName = new Map<string, string>()
  if (foreignRows.length > 0) {
    const mine = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.householdId, householdId))
    for (const t of mine) myTagIdByName.set(normalizeText(t.name), t.id)
  }

  const ignored = options.pantry ? await ignoredPantryCategoryIds(db, householdId) : new Set<string>()
  const missing =
    options.pantry && ids.length > 0 ? await missingByRecipe(db, householdId, ids, ignored) : null
  const toCandidate = (
    recipe: RecipeRow,
    r2Key: string | null,
    isFavorite: boolean,
    lastCookedAt: string | null,
    householdName?: string,
    sharedFrom?: string,
  ) => {
    const tagList = tagsByRecipe.get(recipe.id) ?? []
    const summary: RecipeSummaryDto = {
      ...toSummary(recipe, r2Key, isFavorite, tagList, lastCookedAt),
      // Overenie patrí domácnosti – cudzí recept ho nemá.
      ...(householdName ? { isVerified: false } : {}),
      ...(missing ? { missing: missing.get(recipe.id) ?? [] } : {}),
      ...(householdName ? { householdName } : {}),
      ...(sharedFrom ? { sharedFrom } : {}),
    }
    const tagIds = householdName
      ? tagList.flatMap((t) => myTagIdByName.get(normalizeText(t.name)) ?? [])
      : tagList.map((t) => t.id)
    const facetRow: FacetRow & { summary: RecipeSummaryDto } = {
      id: summary.id,
      title: summary.title,
      category: summary.category,
      alsoCategories: summary.alsoCategories,
      difficulty: summary.difficulty,
      totalMinutes: totalMinutes(summary),
      tagIds,
      isFavorite: summary.isFavorite,
      isVerified: summary.isVerified,
      createdAt: summary.createdAt,
      lastCookedAt: summary.lastCookedAt,
      missing: summary.missing,
      summary,
    }
    return facetRow
  }
  const candidates = [
    ...rows.map((r) => toCandidate(r.recipe, r.r2Key, r.isFavorite, r.lastCookedAt)),
    ...foreignRows.map((r) => toCandidate(r.recipe, r.r2Key, false, null, r.householdName, r.sharedFrom)),
  ]

  // Filter „chýba najviac N“ dáva zmysel len pri „Čo viem uvariť“, kde recepty nesú chýbajúce suroviny.
  const {
    missingMax,
    publicMode: _publicMode,
    sharedMode: _sharedMode,
    sharedByMe: _sharedByMe,
    ...rest
  } = options
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
