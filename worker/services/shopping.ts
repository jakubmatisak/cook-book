import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { GenerateResult, ShoppingItemDto, ShoppingListDto } from '../../shared/api'
import { newId } from '../../shared/ids'
import type {
  GenerateInput,
  ItemBatchInput,
  ItemCreateInput,
  ItemPatchInput,
} from '../../shared/schemas/shopping'
import { planShopping, type ShoppingInputEntry, type ShoppingInputIngredient } from '../../shared/shopping'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import {
  images,
  ingredients,
  mealPlanEntries,
  mealPlanEntryMembers,
  pantryItems,
  recipeIngredients,
  recipes,
  shopCategories,
  shoppingItems,
  shoppingItemSources,
  shoppingLists,
  stapleItems,
} from '../db/schema'
import type { UserRow } from '../env'
import { HttpError } from '../errors'
import { chunk } from '../http'
import { listMembers } from './family'
import { listStays, stayGuestsOn } from './stays'
import { imageUrl } from './recipes'

type ItemRow = typeof shoppingItems.$inferSelect

const notFound = (what: string) => new HttpError(404, 'not_found', `${what} neexistuje.`)

async function batch(db: Db, statements: BatchItem<'sqlite'>[]) {
  if (statements.length === 0) return
  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
}

export async function listLists(db: Db, householdId: string): Promise<ShoppingListDto[]> {
  return db
    .select({ id: shoppingLists.id, name: shoppingLists.name, isDefault: shoppingLists.isDefault })
    .from(shoppingLists)
    .where(eq(shoppingLists.householdId, householdId))
    .orderBy(asc(shoppingLists.sortOrder), asc(shoppingLists.name))
}

async function assertShopCategory(db: Db, householdId: string, id: string) {
  const category = await db
    .select({ id: shopCategories.id })
    .from(shopCategories)
    .where(and(eq(shopCategories.id, id), eq(shopCategories.householdId, householdId)))
    .get()
  if (!category) throw new HttpError(400, 'invalid_shop_category', 'Kategória obchodu neexistuje.')
}

async function assertList(db: Db, householdId: string, listId: string) {
  const list = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, householdId)))
    .get()
  if (!list) throw notFound('Nákupný zoznam')
}

/** Položka len z vlastnej domácnosti (cez jej zoznam). */
async function findItem(db: Db, householdId: string, id: string): Promise<ItemRow> {
  const row = await db
    .select({ item: shoppingItems })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingItems.listId))
    .where(and(eq(shoppingItems.id, id), eq(shoppingLists.householdId, householdId)))
    .get()
  if (!row) throw notFound('Položka')
  return row.item
}

const toItemDto = (row: ItemRow, sources: ShoppingItemDto['sources']): ShoppingItemDto => ({
  id: row.id,
  listId: row.listId,
  ingredientId: row.ingredientId,
  name: row.name,
  quantity: row.quantity,
  unit: row.unit,
  shopCategoryId: row.shopCategoryId,
  isChecked: row.isChecked,
  checkedAt: row.checkedAt,
  source: row.source,
  sources,
  updatedAt: row.updatedAt,
})

/** Položky zoradené podľa poradia kategórie obchodu (bez kategórie na konci), potom podľa názvu. */
export async function listItems(db: Db, householdId: string, listId: string): Promise<ShoppingItemDto[]> {
  await assertList(db, householdId, listId)
  const [rows, sourceRows] = await db.batch([
    db
      // Alias: v `db.batch` by sa dva stĺpce `sort_order` prepísali a poradie kategórií by sa stratilo.
      .select({
        item: shoppingItems,
        categoryOrder: sql<number | null>`${shopCategories.sortOrder}`.as('category_order'),
      })
      .from(shoppingItems)
      .leftJoin(shopCategories, eq(shopCategories.id, shoppingItems.shopCategoryId))
      .where(eq(shoppingItems.listId, listId)),
    db
      .selectDistinct({
        itemId: shoppingItemSources.itemId,
        date: mealPlanEntries.date,
        recipeTitle: recipes.title,
        r2Key: images.r2Key,
      })
      .from(shoppingItemSources)
      .innerJoin(shoppingItems, eq(shoppingItems.id, shoppingItemSources.itemId))
      .innerJoin(mealPlanEntries, eq(mealPlanEntries.id, shoppingItemSources.planEntryId))
      .innerJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
      .leftJoin(images, eq(images.id, recipes.coverImageId))
      .where(eq(shoppingItems.listId, listId))
      .orderBy(asc(mealPlanEntries.date)),
  ])
  const sources = new Map<string, ShoppingItemDto['sources']>()
  for (const s of sourceRows) {
    sources.set(s.itemId, [
      ...(sources.get(s.itemId) ?? []),
      { date: s.date, recipeTitle: s.recipeTitle, coverImageUrl: s.r2Key ? imageUrl(s.r2Key) : null },
    ])
  }
  return rows
    .sort(
      (a, b) =>
        (a.categoryOrder ?? Number.MAX_SAFE_INTEGER) - (b.categoryOrder ?? Number.MAX_SAFE_INTEGER) ||
        normalizeText(a.item.name).localeCompare(normalizeText(b.item.name)),
    )
    .map((r) => toItemDto(r.item, sources.get(r.item.id) ?? []))
}

/** Návštevy vybrané pri jedlách (kvôli porciám). */
async function loadEntryGuests(db: Db, entryIds: string[]): Promise<Map<string, string[]>> {
  const guests = new Map<string, string[]>()
  for (const ids of chunk(entryIds, 90)) {
    const rows = await db
      .select({ entryId: mealPlanEntryMembers.entryId, memberId: mealPlanEntryMembers.memberId })
      .from(mealPlanEntryMembers)
      .where(inArray(mealPlanEntryMembers.entryId, ids))
    for (const r of rows) guests.set(r.entryId, [...(guests.get(r.entryId) ?? []), r.memberId])
  }
  return guests
}

async function loadPlanForShopping(
  db: Db,
  householdId: string,
  input: GenerateInput,
): Promise<ShoppingInputEntry[]> {
  const entries = await db
    .select({
      id: mealPlanEntries.id,
      date: mealPlanEntries.date,
      servingsOverride: mealPlanEntries.servingsOverride,
      audience: mealPlanEntries.audience,
      recipeId: recipes.id,
      recipeTitle: recipes.title,
      recipeServings: recipes.servings,
    })
    .from(mealPlanEntries)
    .leftJoin(recipes, eq(recipes.id, mealPlanEntries.recipeId))
    .where(
      and(eq(mealPlanEntries.householdId, householdId), between(mealPlanEntries.date, input.from, input.to)),
    )
    .orderBy(asc(mealPlanEntries.date), asc(mealPlanEntries.sortOrder))

  const recipeIds = [...new Set(entries.map((e) => e.recipeId).filter((id): id is string => Boolean(id)))]
  const byRecipe = new Map<string, ShoppingInputIngredient[]>()
  for (const ids of chunk(recipeIds, 90)) {
    const rows = await db
      .select({
        recipeId: recipeIngredients.recipeId,
        recipeIngredientId: recipeIngredients.id,
        ingredientId: recipeIngredients.ingredientId,
        name: ingredients.name,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        isOptional: recipeIngredients.isOptional,
        shopCategoryId: ingredients.shopCategoryId,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(ingredients.id, recipeIngredients.ingredientId))
      .where(inArray(recipeIngredients.recipeId, ids))
      .orderBy(asc(recipeIngredients.sortOrder))
    for (const { recipeId, ...ing } of rows) byRecipe.set(recipeId, [...(byRecipe.get(recipeId) ?? []), ing])
  }

  const guests = await loadEntryGuests(
    db,
    entries.map((e) => e.id),
  )
  // Návštevy z pobytov, ktoré pokrývajú deň jedla, sa počítajú automaticky.
  const stays = await listStays(db, householdId, input.from, input.to)

  return entries.map((e) => ({
    id: e.id,
    date: e.date,
    servingsOverride: e.servingsOverride,
    audience: e.audience,
    guestIds: [...new Set([...(guests.get(e.id) ?? []), ...stayGuestsOn(stays, e.date)])],
    recipe: e.recipeId
      ? {
          id: e.recipeId,
          title: e.recipeTitle ?? '',
          servings: e.recipeServings ?? 1,
          ingredients: byRecipe.get(e.recipeId) ?? [],
        }
      : null,
  }))
}

/** Zásoby a stále položky domácnosti pre generovanie nákupu. */
async function loadPantryAndStaples(db: Db, householdId: string) {
  const [pantry, staples] = await Promise.all([
    db
      .select({
        ingredientId: pantryItems.ingredientId,
        quantity: pantryItems.quantity,
        unit: pantryItems.unit,
        expiresOn: pantryItems.expiresOn,
      })
      .from(pantryItems)
      .where(eq(pantryItems.householdId, householdId)),
    db
      .select({
        ingredientId: stapleItems.ingredientId,
        name: ingredients.name,
        shopCategoryId: ingredients.shopCategoryId,
        quantity: stapleItems.quantity,
        unit: stapleItems.unit,
        everyNWeeks: stapleItems.everyNWeeks,
      })
      .from(stapleItems)
      .innerJoin(ingredients, eq(ingredients.id, stapleItems.ingredientId))
      .where(eq(stapleItems.householdId, householdId)),
  ])
  return { pantry, staples }
}

/**
 * Vygeneruje položky z jedálnička a stálych položiek a odpočíta špajzu. Nekúpené vygenerované
 * (aj stále) sa nahradia, kúpené ostanú (ich ingrediencia sa znova nepridá), ručné ostanú vždy.
 */
export async function generateItems(
  db: Db,
  householdId: string,
  listId: string,
  input: GenerateInput,
): Promise<GenerateResult> {
  await assertList(db, householdId, listId)
  const [entries, members, stock, existing] = await Promise.all([
    loadPlanForShopping(db, householdId, input),
    listMembers(db, householdId),
    loadPantryAndStaples(db, householdId),
    db
      .select({
        id: shoppingItems.id,
        ingredientId: shoppingItems.ingredientId,
        isChecked: shoppingItems.isChecked,
        rangeFrom: shoppingItems.generatedRangeFrom,
        rangeTo: shoppingItems.generatedRangeTo,
      })
      .from(shoppingItems)
      .where(and(eq(shoppingItems.listId, listId), inArray(shoppingItems.source, ['generated', 'staple']))),
  ])

  // Kúpené potláča opätovné pridanie len v tom istom období; v ďalšom týždni sa stála položka vráti.
  const bought = new Set(
    existing
      .filter((e) => e.isChecked && e.ingredientId && e.rangeFrom === input.from && e.rangeTo === input.to)
      .map((e) => e.ingredientId),
  )
  const toRemove = existing.filter((e) => !e.isChecked).map((e) => e.id)
  const plan = planShopping({ entries, members, ...stock, from: input.from })
  const generated = plan.items.filter((item) => !bought.has(item.ingredientId))

  const statements: BatchItem<'sqlite'>[] = []
  for (const ids of chunk(toRemove, 90)) {
    statements.push(db.delete(shoppingItems).where(inArray(shoppingItems.id, ids)))
  }
  for (const item of generated) {
    const itemId = newId()
    statements.push(
      db.insert(shoppingItems).values({
        id: itemId,
        listId,
        ingredientId: item.ingredientId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        shopCategoryId: item.shopCategoryId,
        source: item.kind === 'staple' ? 'staple' : 'generated',
        generatedRangeFrom: input.from,
        generatedRangeTo: input.to,
      }),
    )
    for (const source of item.sources) {
      statements.push(
        db
          .insert(shoppingItemSources)
          .values({
            itemId,
            planEntryId: source.planEntryId,
            recipeIngredientId: source.recipeIngredientId,
            quantityContrib: source.quantity,
          })
          .onConflictDoNothing(),
      )
    }
  }
  await batch(db, statements)
  return {
    added: generated.length,
    kept: bought.size,
    removed: toRemove.length,
    staples: generated.filter((item) => item.kind === 'staple').length,
    covered: [...new Set(plan.covered)],
    reduced: [...new Set(plan.reduced)],
  }
}

export async function createItem(
  db: Db,
  householdId: string,
  listId: string,
  input: ItemCreateInput,
): Promise<ShoppingItemDto> {
  await assertList(db, householdId, listId)
  const known = await db
    .select({ id: ingredients.id, shopCategoryId: ingredients.shopCategoryId })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.householdId, householdId),
        eq(ingredients.nameNormalized, normalizeText(input.name)),
        isNull(ingredients.deletedAt),
      ),
    )
    .get()
  if (input.shopCategoryId) await assertShopCategory(db, householdId, input.shopCategoryId)
  const [row] = await db
    .insert(shoppingItems)
    .values({
      listId,
      ingredientId: known?.id ?? null,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      shopCategoryId: input.shopCategoryId ?? known?.shopCategoryId ?? null,
      source: 'manual',
    })
    .returning()
  return toItemDto(row!, [])
}

export async function patchItem(
  db: Db,
  user: UserRow,
  id: string,
  patch: ItemPatchInput,
): Promise<ShoppingItemDto> {
  const current = await findItem(db, user.householdId, id)
  const { isChecked, ...fields } = patch
  if (fields.shopCategoryId) await assertShopCategory(db, user.householdId, fields.shopCategoryId)
  const set: Partial<ItemRow> = { ...fields }
  if (isChecked !== undefined) {
    set.isChecked = isChecked
    set.checkedAt = isChecked ? new Date().toISOString() : null
    set.checkedBy = isChecked ? user.id : null
  }
  if (Object.keys(set).length === 0) return toItemDto(current, [])
  const [row] = await db.update(shoppingItems).set(set).where(eq(shoppingItems.id, id)).returning()
  return toItemDto(row!, [])
}

/** Odškrtnutia z offline režimu: použije sa len zmena novšia ako posledná úprava položky. */
export async function applyBatch(db: Db, user: UserRow, input: ItemBatchInput): Promise<number> {
  const latest = new Map<string, { isChecked: boolean; at: string }>()
  for (const change of input.changes) {
    const prev = latest.get(change.id)
    if (!prev || prev.at < change.at) latest.set(change.id, change)
  }
  const statements: BatchItem<'sqlite'>[] = []
  for (const ids of chunk([...latest.keys()], 90)) {
    const rows = await db
      .select({ id: shoppingItems.id, updatedAt: shoppingItems.updatedAt })
      .from(shoppingItems)
      .innerJoin(shoppingLists, eq(shoppingLists.id, shoppingItems.listId))
      .where(and(inArray(shoppingItems.id, ids), eq(shoppingLists.householdId, user.householdId)))
    for (const row of rows) {
      const change = latest.get(row.id)!
      if (change.at <= row.updatedAt) continue
      statements.push(
        db
          .update(shoppingItems)
          .set({
            isChecked: change.isChecked,
            checkedAt: change.isChecked ? change.at : null,
            checkedBy: change.isChecked ? user.id : null,
          })
          .where(eq(shoppingItems.id, row.id)),
      )
    }
  }
  await batch(db, statements)
  return statements.length
}

export async function deleteItem(db: Db, householdId: string, id: string): Promise<void> {
  await findItem(db, householdId, id)
  await db.delete(shoppingItems).where(eq(shoppingItems.id, id))
}

export async function clearChecked(db: Db, householdId: string, listId: string): Promise<number> {
  await assertList(db, householdId, listId)
  const deleted = await db
    .delete(shoppingItems)
    .where(and(eq(shoppingItems.listId, listId), eq(shoppingItems.isChecked, true)))
    .returning({ id: shoppingItems.id })
  return deleted.length
}
