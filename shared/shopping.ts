import type { PlanAudience } from './family'
import { entryPortions, type PortionMember } from './portions'
import { normalizeText } from './text'
import { toBase, UNIT_ALIASES, UNITS, type UnitCode } from './units'

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

const MASS_OR_VOLUME: ReadonlySet<UnitCode> = new Set(['g', 'ml'])

/** Krok pre gramy a mililitre: do 10 po 1, do 100 po 5, inak po 10. */
const stepFor = (q: number) => (q < 10 ? 1 : q < 100 ? 5 : 10)

/**
 * Zaokrúhlenie na nákup: kusy a balenia nahor na celé, gramy a mililitre nahor na rozumný krok
 * (208,33 g → 210 g), ostatné na 2 desatinné miesta.
 */
export function roundForShopping(quantity: number | null, unit: UnitCode | null): number | null {
  if (quantity === null) return null
  if (unit && ROUND_UP.has(unit)) return Math.ceil(quantity - 1e-9)
  if (unit && MASS_OR_VOLUME.has(unit)) {
    const step = stepFor(quantity)
    return Math.ceil(quantity / step - 1e-9) * step
  }
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

const UNIT_BY_TEXT = new Map<string, UnitCode>([
  ...UNITS.map((u): [string, UnitCode] => [normalizeText(u.code), u.code]),
  ...Object.entries(UNIT_ALIASES),
])

/**
 * „2 kg zemiaky“ → { quantity: 2, unit: 'kg', name: 'zemiaky' }; rozpozná aj skloňované tvary
 * („2 šálky múky“). Bez čísla, s nulovým množstvom alebo bez názvu („100 g“) je celý text názov.
 */
export function parseItemText(text: string): {
  name: string
  quantity: number | null
  unit: UnitCode | null
} {
  const trimmed = text.trim()
  const whole = { name: trimmed, quantity: null, unit: null }
  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]?.match(/^(\d+(?:[.,]\d+)?)([^\d\s]*)$/)
  if (!first || tokens.length < 2) return whole

  const quantity = Number(first[1]!.replace(',', '.'))
  if (!(quantity > 0)) return whole
  const attached = first[2] ? UNIT_BY_TEXT.get(normalizeText(first[2])) : undefined
  if (first[2] && !attached) return whole
  if (attached) return { name: tokens.slice(1).join(' '), quantity, unit: attached }

  const second = UNIT_BY_TEXT.get(normalizeText(tokens[1]!))
  if (second) {
    return tokens.length > 2 ? { name: tokens.slice(2).join(' '), quantity, unit: second } : whole
  }
  return { name: tokens.slice(1).join(' '), quantity, unit: null }
}
