import type { PlanAudience } from './family'
import { entryPortions, type PortionMember } from './portions'
import { normalizeText } from './text'
import { toBase, UNITS, type UnitCode } from './units'

export interface ShoppingInputIngredient {
  recipeIngredientId: string
  ingredientId: string
  name: string
  quantity: number | null
  unit: UnitCode | null
  isOptional: boolean
  shopCategoryId: string | null
}

export interface ShoppingInputEntry {
  id: string
  date: string
  servingsOverride: number | null
  audience: PlanAudience
  recipe: { id: string; title: string; servings: number; ingredients: ShoppingInputIngredient[] } | null
}

export interface GeneratedItemSource {
  planEntryId: string
  recipeIngredientId: string
  /** Príspevok v jednotke položky (pred zaokrúhlením na nákup), null ak recept množstvo neuvádza. */
  quantity: number | null
}

export interface GeneratedItem {
  /** `ingredientId|jednotka` – jedna položka na ingredienciu a (základnú) jednotku. */
  key: string
  ingredientId: string
  name: string
  quantity: number | null
  unit: UnitCode | null
  shopCategoryId: string | null
  sources: GeneratedItemSource[]
}

const ROUND_UP: ReadonlySet<UnitCode> = new Set(['ks', 'balenie'])

/** Zaokrúhlenie na nákup: kusy a balenia nahor na celé, ostatné na 2 desatinné miesta. */
export function roundForShopping(quantity: number | null, unit: UnitCode | null): number | null {
  if (quantity === null) return null
  if (unit && ROUND_UP.has(unit)) return Math.ceil(quantity - 1e-9)
  return Math.round(quantity * 100) / 100
}

/**
 * Položky nákupu z naplánovaných jedál: prepočet porcií, prevod na základné jednotky,
 * súčet rovnakých ingrediencií. Voliteľné ingrediencie a jedlá bez receptu sa vynechajú.
 */
export function buildShoppingItems(input: {
  entries: readonly ShoppingInputEntry[]
  members: readonly PortionMember[]
}): GeneratedItem[] {
  const items = new Map<string, GeneratedItem>()

  for (const entry of input.entries) {
    const recipe = entry.recipe
    if (!recipe) continue
    const portions = entryPortions(entry, input.members) ?? recipe.servings
    const factor = recipe.servings > 0 ? portions / recipe.servings : 1

    for (const ing of recipe.ingredients) {
      if (ing.isOptional) continue
      let quantity: number | null = null
      let unit: UnitCode | null = ing.unit
      if (ing.quantity !== null) {
        if (unit) {
          const base = toBase(ing.quantity * factor, unit)
          quantity = base.quantity
          unit = base.unit
        } else {
          quantity = ing.quantity * factor
        }
      }
      const key = `${ing.ingredientId}|${quantity === null ? '?' : (unit ?? '-')}`
      const item = items.get(key) ?? {
        key,
        ingredientId: ing.ingredientId,
        name: ing.name,
        quantity: null,
        unit: quantity === null ? null : unit,
        shopCategoryId: ing.shopCategoryId,
        sources: [],
      }
      if (quantity !== null) item.quantity = (item.quantity ?? 0) + quantity
      item.sources.push({ planEntryId: entry.id, recipeIngredientId: ing.recipeIngredientId, quantity })
      items.set(key, item)
    }
  }

  // Položka „bez množstva“ sa zlúči do položky s množstvom tej istej ingrediencie, ak existuje.
  for (const [key, item] of items) {
    if (!key.endsWith('|?')) continue
    const withQuantity = [...items.values()].find(
      (other) => other !== item && other.ingredientId === item.ingredientId && other.quantity !== null,
    )
    if (withQuantity) {
      withQuantity.sources.push(...item.sources)
      items.delete(key)
    }
  }

  return [...items.values()]
    .map((item) => ({ ...item, quantity: roundForShopping(item.quantity, item.unit) }))
    .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)))
}

const UNIT_BY_TEXT = new Map(UNITS.map((u) => [normalizeText(u.code), u.code]))

/** „2 kg zemiaky“ → { quantity: 2, unit: 'kg', name: 'zemiaky' }; bez čísla je celý text názov. */
export function parseItemText(text: string): {
  name: string
  quantity: number | null
  unit: UnitCode | null
} {
  const trimmed = text.trim()
  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]?.match(/^(\d+(?:[.,]\d+)?)([^\d\s]*)$/)
  if (!first || tokens.length < 2) return { name: trimmed, quantity: null, unit: null }

  const quantity = Number(first[1]!.replace(',', '.'))
  const attached = first[2] ? UNIT_BY_TEXT.get(normalizeText(first[2])) : undefined
  if (first[2] && !attached) return { name: trimmed, quantity: null, unit: null }
  if (attached) return { name: tokens.slice(1).join(' '), quantity, unit: attached }

  const second = UNIT_BY_TEXT.get(normalizeText(tokens[1]!))
  if (second && tokens.length > 2) return { name: tokens.slice(2).join(' '), quantity, unit: second }
  return { name: tokens.slice(1).join(' '), quantity, unit: null }
}
