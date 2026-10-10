import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { IngredientDto } from '../../shared/api'
import type { IngredientMergeInput } from '../../shared/schemas/bulk'
import { normalizeText } from '../../shared/text'
import { toBase, type UnitCode } from '../../shared/units'
import type { Db } from '../db/client'
import {
  ingredients,
  memberPreferences,
  pantryItems,
  recipeIngredients,
  shoppingItems,
  stapleItems,
} from '../db/schema'
import { HttpError } from '../errors'
import { getIngredientDto } from './catalog'

const inBase = (quantity: number | null, unit: UnitCode | null) =>
  quantity !== null && unit ? toBase(quantity, unit) : { quantity, unit }

/**
 * Zlúči ingrediencie (napr. „Banány“ do „Banán“): recepty, nákup, špajza, stále položky a alergie či averzie
 * zdrojových ingrediencií prejdú na cieľovú a zdrojové sa naozaj zmažú (inak by ich import podľa názvu obnovil).
 * Ich názvy si cieľová ingrediencia zapamätá ako alternatívne, takže ďalší import ich priradí rovno k nej.
 * Zásoby v špajzi sa sčítajú v zlučiteľnej jednotke, stále položky ostanú jedna.
 */
export async function mergeIngredients(
  db: Db,
  householdId: string,
  input: IngredientMergeInput,
): Promise<IngredientDto> {
  const ids = [input.targetId, ...input.sourceIds]
  const rows = await db
    .select()
    .from(ingredients)
    .where(
      and(
        eq(ingredients.householdId, householdId),
        isNull(ingredients.deletedAt),
        inArray(ingredients.id, ids),
      ),
    )
  const target = rows.find((r) => r.id === input.targetId)
  const sources = rows.filter((r) => input.sourceIds.includes(r.id))
  if (!target || sources.length !== new Set(input.sourceIds).size) {
    throw new HttpError(404, 'not_found', 'Ingrediencia neexistuje.')
  }

  const name = input.name ?? target.name
  const nameNormalized = normalizeText(name)
  if (nameNormalized !== target.nameNormalized) {
    const clash = await db
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(and(eq(ingredients.householdId, householdId), eq(ingredients.nameNormalized, nameNormalized)))
      .get()
    if (clash && !ids.includes(clash.id)) {
      throw new HttpError(409, 'duplicate', `Ingrediencia „${clash.name}“ už existuje.`)
    }
  }

  const sourceIds = sources.map((s) => s.id)
  const convert = input.convert ?? []
  /** Množstvo a jednotka po prepočte (1 ks = 10 g); iné jednotky ostanú. */
  const converted = <T extends { quantity: number | null; unit: UnitCode | null }>(row: T): T => {
    const rule = convert.find((c) => c.from === row.unit)
    return rule
      ? { ...row, quantity: row.quantity === null ? null : row.quantity * rule.factor, unit: rule.to }
      : row
  }
  const [pantryRows, staples] = await Promise.all([
    db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.householdId, householdId), inArray(pantryItems.ingredientId, ids))),
    db
      .select()
      .from(stapleItems)
      .where(and(eq(stapleItems.householdId, householdId), inArray(stapleItems.ingredientId, ids))),
  ])

  const pantry = pantryRows.map(converted)
  const statements: BatchItem<'sqlite'>[] = [
    db
      .update(recipeIngredients)
      .set({ ingredientId: target.id })
      .where(inArray(recipeIngredients.ingredientId, sourceIds)),
    // Prepočet jednotiek v receptoch (po prevedení na ponechanú ingredienciu).
    ...convert.map((c) =>
      db
        .update(recipeIngredients)
        .set({ unit: c.to, quantity: sql`${recipeIngredients.quantity} * ${c.factor}` })
        .where(and(eq(recipeIngredients.ingredientId, target.id), eq(recipeIngredients.unit, c.from))),
    ),
    db
      .update(shoppingItems)
      .set({ ingredientId: target.id })
      .where(inArray(shoppingItems.ingredientId, sourceIds)),
    db
      .update(memberPreferences)
      .set({ ingredientId: target.id })
      .where(inArray(memberPreferences.ingredientId, sourceIds)),
  ]

  // Špajza: jeden záznam, množstvá sa sčítajú v zlučiteľnej jednotke (kg + g), inak ostane prvé známe.
  if (pantry.length) {
    const keep = pantry.find((p) => p.ingredientId === target.id) ?? pantry[0]!
    let total = inBase(keep.quantity, keep.unit)
    for (const p of pantry) {
      if (p === keep) continue
      const amount = inBase(p.quantity, p.unit)
      if (total.quantity === null) total = amount
      else if (amount.quantity !== null && amount.unit === total.unit)
        total = { ...total, quantity: total.quantity + amount.quantity }
    }
    // Porovnáva sa s uloženým záznamom (prepočet mohol zmeniť jednotku aj jedinej zásoby).
    const stored = pantryRows.find((p) => p.id === keep.id)!
    const changed = total.quantity !== stored.quantity || total.unit !== stored.unit
    statements.push(
      db
        .update(pantryItems)
        .set({
          ingredientId: target.id,
          ...(changed ? total : {}),
          expiresOn: keep.expiresOn ?? pantry.find((p) => p.expiresOn)?.expiresOn ?? null,
        })
        .where(eq(pantryItems.id, keep.id)),
    )
    const drop = pantry.filter((p) => p !== keep).map((p) => p.id)
    if (drop.length) statements.push(db.delete(pantryItems).where(inArray(pantryItems.id, drop)))
  }

  // Stále položky: ostane jedna (cieľovej ingrediencie, ak ju má).
  if (staples.length) {
    const keep = staples.find((s) => s.ingredientId === target.id) ?? staples[0]!
    statements.push(
      db.update(stapleItems).set({ ingredientId: target.id }).where(eq(stapleItems.id, keep.id)),
    )
    const drop = staples.filter((s) => s !== keep).map((s) => s.id)
    if (drop.length) statements.push(db.delete(stapleItems).where(inArray(stapleItems.id, drop)))
  }

  // Zdrojové ingrediencie sa zmažú až keď na ne nič neodkazuje; až potom môže cieľová prevziať ich názov.
  statements.push(db.delete(ingredients).where(inArray(ingredients.id, sourceIds)))

  const aliases = new Map<string, string>()
  for (const alias of [...target.aliases, target.name, ...sources.flatMap((s) => [s.name, ...s.aliases])]) {
    const key = normalizeText(alias)
    if (key && key !== nameNormalized && !aliases.has(key)) aliases.set(key, alias)
  }
  statements.push(
    db
      .update(ingredients)
      .set({
        name,
        nameNormalized,
        aliases: [...aliases.values()],
        shopCategoryId:
          target.shopCategoryId ?? sources.find((s) => s.shopCategoryId)?.shopCategoryId ?? null,
        defaultUnit: converted({
          quantity: null,
          unit: target.defaultUnit ?? sources.find((s) => s.defaultUnit)?.defaultUnit ?? null,
        }).unit,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingredients.id, target.id)),
  )

  const [first, ...rest] = statements
  await db.batch([first!, ...rest])
  return getIngredientDto(db, householdId, target.id)
}
