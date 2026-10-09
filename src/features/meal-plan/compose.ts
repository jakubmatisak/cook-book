import {
  MAX_LEFTOVER_DAYS,
  type ComposeBrush,
  type ComposeCell,
  type ComposeItem,
  type ComposeOption,
  type ComposeTimeLimit,
  type FillBrush,
} from '@shared/compose'
import { addDays, daysBetween, weekday } from '@shared/dates'
import type { RecipeCategory } from '@shared/recipes'
import { defaultSlotKey } from '@/i18n/defaults'

/** Sprievodca Zostaviť jedálniček: maľovanie políčok (krok 2) a úpravy návrhu (krok 3). Všetko bez zápisu. */

const SLOT_CATEGORIES: Readonly<Record<string, RecipeCategory>> = {
  breakfast: 'ranajky',
  snack: 'desiata',
  afternoonSnack: 'desiata',
}

/** Predvolené typy jedla podľa predvoleného jedla dňa (premenované a ostatné = hlavné jedlo). */
export const defaultCategories = (slotName: string): RecipeCategory[] => [
  SLOT_CATEGORIES[defaultSlotKey(slotName.trim()) ?? ''] ?? 'hlavne',
]

export function rangeDates(from: string, to: string): string[] {
  const days = daysBetween(from, to)
  return days < 0 ? [] : Array.from({ length: days + 1 }, (_, i) => addDays(from, i))
}

// ─── Krok 2: štetce ──────────────────────────────────────────────────────────

/** Štetec každého políčka; kľúč `dátum|jedlo dňa`. */
export type BrushGrid = Record<string, ComposeBrush>
export type TimeLimits = Partial<Record<string, ComposeTimeLimit>>

export const cellKey = (date: string, slotId: string) => `${date}|${slotId}`

/** Predvolene všetko „Všetky“; obsadené políčka sa nemenia, kým sa nenahrádzajú. */
export function initialGrid(
  dates: readonly string[],
  slotIds: readonly string[],
  occupied: ReadonlySet<string>,
  replace: boolean,
): BrushGrid {
  const grid: BrushGrid = {}
  for (const date of dates) {
    for (const slotId of slotIds) {
      const key = cellKey(date, slotId)
      grid[key] = !replace && occupied.has(key) ? 'skip' : 'all'
    }
  }
  return grid
}

export const paintCell = (grid: BrushGrid, date: string, slotId: string, brush: ComposeBrush): BrushGrid => ({
  ...grid,
  [cellKey(date, slotId)]: brush,
})

/** Celý deň; zamknuté (obsadené, ešte nepotvrdené) políčka ostanú, ako sú. */
export const paintRow = (
  grid: BrushGrid,
  date: string,
  slotIds: readonly string[],
  brush: ComposeBrush,
  locked: ReadonlySet<string> = new Set(),
): BrushGrid =>
  slotIds.reduce(
    (g, slotId) => (locked.has(cellKey(date, slotId)) ? g : paintCell(g, date, slotId, brush)),
    grid,
  )

/** Celé jedlo dňa; zamknuté políčka ostanú, ako sú. */
export const paintColumn = (
  grid: BrushGrid,
  dates: readonly string[],
  slotId: string,
  brush: ComposeBrush,
  locked: ReadonlySet<string> = new Set(),
): BrushGrid =>
  dates.reduce((g, date) => (locked.has(cellKey(date, slotId)) ? g : paintCell(g, date, slotId, brush)), grid)

/** Koľko políčok sa naplní ktorým štetcom („Nevypĺňať“ sa nepočíta). */
export function brushSummary(grid: BrushGrid): Partial<Record<FillBrush, number>> {
  const counts: Partial<Record<FillBrush, number>> = {}
  for (const brush of Object.values(grid)) {
    if (brush !== 'skip') counts[brush] = (counts[brush] ?? 0) + 1
  }
  return counts
}

/** Políčka na návrh (bez „Nevypĺňať“). */
export function gridCells(grid: BrushGrid): ComposeCell[] {
  return Object.entries(grid).flatMap(([key, brush]) => {
    if (brush === 'skip') return []
    const [date, slotId] = key.split('|') as [string, string]
    return [{ date, slotId, brush }]
  })
}

const isWeekend = (date: string) => [0, 6].includes(weekday(date))

/** Predvoľby času: pracovné dni do 30 min alebo víkend bez limitu (ostatné dni sa nemenia). */
export function weekdayLimits(
  dates: readonly string[],
  limits: TimeLimits,
  preset: 'workdays' | 'weekend',
): TimeLimits {
  const next = { ...limits }
  for (const date of dates) {
    if (preset === 'workdays' && !isWeekend(date)) next[date] = 'do30'
    if (preset === 'weekend' && isWeekend(date)) delete next[date]
  }
  return next
}

// ─── Krok 3: úpravy návrhu ───────────────────────────────────────────────────

const isMeal = (category: RecipeCategory | null) => category === 'hlavne' || category === 'polievka'

const recipeFields = (option: ComposeOption) => ({
  recipeId: option.recipeId,
  title: option.title,
  coverImageUrl: option.coverImageUrl,
  totalMinutes: option.totalMinutes,
  category: option.category,
  warnings: option.warnings,
})

function makeEmpty(item: ComposeItem, options: ComposeOption[]) {
  Object.assign(item, {
    recipeId: null,
    title: null,
    coverImageUrl: null,
    totalMinutes: null,
    category: null,
    leftoverOf: null,
    leftoverDays: 0,
    warnings: [],
    options,
    repeatsOn: [],
  })
}

/** Pri varení: počet zvyškov, ktoré naň odkazujú. */
function recount(items: ComposeItem[]): ComposeItem[] {
  for (const item of items) {
    if (!item.leftoverOf) item.leftoverDays = items.filter((i) => i.leftoverOf === item.key).length
  }
  return items
}

const cloneAll = (items: readonly ComposeItem[]) => items.map((i) => ({ ...i }))

/** Vlastný recept v políčku; zvyšky varenia dostanú ten istý recept, zo zvyškov sa stane samostatné varenie. */
export function chooseRecipe(
  items: readonly ComposeItem[],
  key: string,
  option: ComposeOption,
): ComposeItem[] {
  const next = cloneAll(items)
  const item = next.find((i) => i.key === key)
  if (!item) return next
  if (item.leftoverOf) {
    const source = next.find((i) => i.key === item.leftoverOf)
    item.leftoverOf = null
    if (!item.options.length) item.options = source?.options ?? []
  }
  Object.assign(item, recipeFields(option))
  for (const leftover of next.filter((i) => i.leftoverOf === key))
    Object.assign(leftover, recipeFields(option))
  return recount(next)
}

/** Ďalší vhodný recept z návrhov políčka; hlavné jedlá a polievky, ktoré už v návrhu sú, sa preskočia. */
export function nextOption(items: readonly ComposeItem[], key: string): ComposeItem[] {
  const item = items.find((i) => i.key === key)
  if (!item || item.leftoverOf || !item.options.length) return [...items]
  const used = new Set(
    items.filter((i) => i.key !== key && !i.leftoverOf && i.recipeId).map((i) => i.recipeId),
  )
  const start = item.options.findIndex((o) => o.recipeId === item.recipeId)
  for (let step = 1; step <= item.options.length; step++) {
    const option = item.options[(start + step) % item.options.length]!
    if (option.recipeId === item.recipeId) break
    if (isMeal(option.category) && used.has(option.recipeId)) continue
    return chooseRecipe(items, key, option)
  }
  return [...items]
}

/**
 * Zvyšky +N: nasledujúcich N políčok toho istého jedla dňa a chodu dostane recept varenia. Prepísané varenie príde
 * aj o svoje zvyšky; políčka uvoľnené znížením dostanú návrhy varenia.
 */
export function setLeftoverDays(items: readonly ComposeItem[], key: string, days: number): ComposeItem[] {
  const next = cloneAll(items)
  const source = next.find((i) => i.key === key)
  if (!source || source.leftoverOf || !source.recipeId) return next
  const count = Math.max(0, Math.min(MAX_LEFTOVER_DAYS, Math.round(days)))
  const chain = next
    .filter((i) => i.slotId === source.slotId && i.course === source.course && i.date > source.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const targets = new Set(chain.slice(0, count).map((i) => i.key))

  for (const item of next) {
    if (item.leftoverOf === key && !targets.has(item.key)) makeEmpty(item, source.options)
  }
  for (const target of chain.filter((i) => targets.has(i.key))) {
    if (target.leftoverOf === key) continue
    if (!target.leftoverOf) {
      for (const own of next.filter((i) => i.leftoverOf === target.key && !targets.has(i.key))) {
        makeEmpty(own, target.options)
      }
    }
    Object.assign(target, {
      recipeId: source.recipeId,
      title: source.title,
      coverImageUrl: source.coverImageUrl,
      totalMinutes: source.totalMinutes,
      category: source.category,
      warnings: source.warnings,
      leftoverOf: key,
      leftoverDays: 0,
      options: [],
    })
  }
  return recount(next)
}

/** Vymaže políčko; pri varení aj jeho zvyšky. Uvoľnené zvyšky dostanú návrhy varenia. */
export function clearItem(items: readonly ComposeItem[], key: string): ComposeItem[] {
  const next = cloneAll(items)
  const item = next.find((i) => i.key === key)
  if (!item) return next
  const source = item.leftoverOf ? next.find((i) => i.key === item.leftoverOf) : undefined
  const options = source ? source.options : item.options
  for (const leftover of next.filter((i) => i.leftoverOf === key)) makeEmpty(leftover, item.options)
  makeEmpty(item, options)
  return recount(next)
}

/** „Už máme“: iné dni s tým istým receptom v návrhu alebo v jedálničku (okrem vlastných zvyškov). */
export function repeatsOf(
  items: readonly ComposeItem[],
  existing: readonly { date: string; recipeId: string }[],
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const item of items) {
    if (!item.recipeId || item.leftoverOf) {
      result.set(item.key, [])
      continue
    }
    const own = new Set([item.key, ...items.filter((i) => i.leftoverOf === item.key).map((i) => i.key)])
    const dates = [
      ...items.filter((i) => i.recipeId === item.recipeId && !own.has(i.key)).map((i) => i.date),
      ...existing.filter((e) => e.recipeId === item.recipeId).map((e) => e.date),
    ]
    result.set(item.key, [...new Set(dates.filter((d) => d !== item.date))].sort())
  }
  return result
}

/** Položky na uloženie: len s receptom, zvyšky s odkazom na varenie. */
export function applyItems(items: readonly ComposeItem[]) {
  const withRecipe = new Set(items.filter((i) => i.recipeId).map((i) => i.key))
  return items
    .filter((i) => i.recipeId && (!i.leftoverOf || withRecipe.has(i.leftoverOf)))
    .map((i) => ({
      key: i.key,
      date: i.date,
      slotId: i.slotId,
      recipeId: i.recipeId!,
      leftoverOf: i.leftoverOf,
      leftoverDays: i.leftoverOf ? 0 : items.filter((l) => l.leftoverOf === i.key).length,
    }))
}

export function summarize(items: readonly ComposeItem[]) {
  const filled = items.filter((i) => i.recipeId)
  return {
    meals: filled.length,
    cooked: filled.filter((i) => !i.leftoverOf).length,
    leftovers: filled.filter((i) => i.leftoverOf).length,
    empty: items.length - filled.length,
  }
}
