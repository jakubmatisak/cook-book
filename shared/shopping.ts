import type { PlanAudience } from './family'
import { daysBetween } from './dates'
import { entryPortions, type PortionMember } from './portions'
import { normalizeText } from './text'
import { toBase, unitFromText, type UnitCode } from './units'

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
  /** Návštevy vybrané pri tomto jedle. */
  guestIds?: readonly string[]
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
  /** `staple` = stála položka (bez zdroja v jedálničku). */
  kind: 'recipe' | 'staple'
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

/** Zásoba doma: jedna položka špajze. Bez množstva znamená „mám, nemerané“. */
export interface PantryStock {
  ingredientId: string
  quantity: number | null
  unit: UnitCode | null
  /** `YYYY-MM-DD`; po tomto dni sa položka nepočíta. */
  expiresOn: string | null
}

/** Stála položka, ktorá sa pridáva do nákupu pravidelne (mlieko, chlieb). */
export interface StapleInput {
  ingredientId: string
  name: string
  shopCategoryId: string | null
  quantity: number | null
  unit: UnitCode | null
  everyNWeeks: number
}

export interface ShoppingPlan {
  items: GeneratedItem[]
  /** Názvy položiek, ktoré špajza pokryla celé (do nákupu nejdú). */
  covered: string[]
  /** Názvy položiek, ktorým špajza znížila množstvo. */
  reduced: string[]
  staplesAdded: number
}

/** 1970-01-05 je pondelok: týždne sa rátajú od neho, takže rytmus nezávisí od dňa v týždni. */
const WEEK_EPOCH = '1970-01-05'

/** Je stála položka s rytmom „každých N týždňov“ na rade v týždni, do ktorého patrí `from`? */
export function isStapleDue(everyNWeeks: number, from: string): boolean {
  const every = Number.isInteger(everyNWeeks) && everyNWeeks > 1 ? everyNWeeks : 1
  return Math.floor(daysBetween(WEEK_EPOCH, from) / 7) % every === 0
}

interface Stock {
  /** Je aspoň jedna položka bez množstva: ingrediencia je doma v neobmedzenom množstve. */
  unbounded: boolean
  byUnit: Map<string, number>
}

function buildStock(pantry: readonly PantryStock[], from: string | undefined): Map<string, Stock> {
  const stock = new Map<string, Stock>()
  for (const row of pantry) {
    if (from !== undefined && row.expiresOn !== null && row.expiresOn < from) continue
    const entry = stock.get(row.ingredientId) ?? { unbounded: false, byUnit: new Map<string, number>() }
    if (row.quantity === null || !(row.quantity > 0)) {
      entry.unbounded = true
    } else {
      const base = row.unit ? toBase(row.quantity, row.unit) : { quantity: row.quantity, unit: null }
      const key = base.unit ?? '-'
      entry.byUnit.set(key, (entry.byUnit.get(key) ?? 0) + base.quantity)
    }
    stock.set(row.ingredientId, entry)
  }
  return stock
}

/**
 * Nákup z naplánovaných jedál: prepočet porcií, prevod na základné jednotky, súčet rovnakých
 * ingrediencií, pridanie stálych položiek na rade a odpočet špajze (pred zaokrúhlením na nákup).
 * Voliteľné ingrediencie a jedlá bez receptu sa vynechajú. `from` je prvý deň obdobia.
 */
export function planShopping(input: {
  entries: readonly ShoppingInputEntry[]
  members: readonly PortionMember[]
  pantry?: readonly PantryStock[]
  staples?: readonly StapleInput[]
  from?: string
}): ShoppingPlan {
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
        kind: 'recipe' as const,
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

  // Stále položky na rade v tomto týždni (bez dňa nevieme, ktorý týždeň to je).
  const from = input.from
  const dueStaples =
    from === undefined ? [] : (input.staples ?? []).filter((s) => isStapleDue(s.everyNWeeks, from))
  for (const staple of dueStaples) {
    const hasQuantity = staple.quantity !== null && staple.quantity > 0
    const base = hasQuantity
      ? staple.unit
        ? toBase(staple.quantity!, staple.unit)
        : { quantity: staple.quantity!, unit: null }
      : null
    const key = `staple|${staple.ingredientId}|${base ? (base.unit ?? '-') : '?'}`
    const item = items.get(key) ?? {
      key,
      ingredientId: staple.ingredientId,
      name: staple.name,
      quantity: null,
      unit: base?.unit ?? null,
      shopCategoryId: staple.shopCategoryId,
      sources: [],
      kind: 'staple' as const,
    }
    if (base) item.quantity = (item.quantity ?? 0) + base.quantity
    items.set(key, item)
  }

  // Špajza: zásoba sa spotrebúva v poradí položiek (najprv recepty, potom stále položky).
  const stock = buildStock(input.pantry ?? [], from)
  const covered: string[] = []
  const reduced: string[] = []
  for (const [key, item] of [...items]) {
    const have = stock.get(item.ingredientId)
    if (!have) continue
    if (have.unbounded || item.quantity === null) {
      items.delete(key)
      covered.push(item.name)
      continue
    }
    const unitKey = item.unit ?? '-'
    const available = have.byUnit.get(unitKey) ?? 0
    if (available <= 0) continue
    const used = Math.min(available, item.quantity)
    have.byUnit.set(unitKey, available - used)
    const remaining = item.quantity - used
    if (remaining <= 1e-9) {
      items.delete(key)
      covered.push(item.name)
    } else {
      item.quantity = remaining
      reduced.push(item.name)
    }
  }

  const result = [...items.values()]
    .map((item) => ({ ...item, quantity: roundForShopping(item.quantity, item.unit) }))
    .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)))
  return {
    items: result,
    covered,
    reduced,
    staplesAdded: result.filter((i) => i.kind === 'staple').length,
  }
}

/** Položky nákupu z jedálnička bez špajze a stálych položiek (skratka pre `planShopping(...).items`). */
export function buildShoppingItems(input: {
  entries: readonly ShoppingInputEntry[]
  members: readonly PortionMember[]
}): GeneratedItem[] {
  return planShopping(input).items
}

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
  const attached = first[2] ? unitFromText(first[2]) : null
  if (first[2] && !attached) return whole
  if (attached) return { name: tokens.slice(1).join(' '), quantity, unit: attached }

  const second = unitFromText(tokens[1]!)
  if (second) {
    return tokens.length > 2 ? { name: tokens.slice(2).join(' '), quantity, unit: second } : whole
  }
  return { name: tokens.slice(1).join(' '), quantity, unit: null }
}
