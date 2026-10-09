import { daysBetween } from './dates'
import { preferenceConflicts, type PreferenceMember, type PreferenceWarning } from './preferences'
import type { RecipeCategory } from './recipes'
import type { SuggestCandidate } from './suggest'

/** Štetec v sprievodcovi Zostaviť jedálniček: z čoho sa políčko naplní (`skip` = nechať tak, do návrhu nejde). */
export const COMPOSE_BRUSHES = ['all', 'verified', 'new', 'favorite', 'skip'] as const
export type ComposeBrush = (typeof COMPOSE_BRUSHES)[number]
export type FillBrush = Exclude<ComposeBrush, 'skip'>

/** Čas na varenie v daný deň (celkový čas receptu); bez záznamu = bez limitu. */
export const COMPOSE_TIME_LIMITS = ['do30', 'do60'] as const
export type ComposeTimeLimit = (typeof COMPOSE_TIME_LIMITS)[number]
const LIMIT_MINUTES: Record<ComposeTimeLimit, number> = { do30: 30, do60: 60 }

/** Najviac toľko dní dopredu sa zvyšky navrhujú. */
export const MAX_LEFTOVER_DAYS = 3

export type ComposeCourse = 'soup' | 'main'

export interface ComposeCandidate extends SuggestCandidate {
  category: RecipeCategory
  isVerified: boolean
}

export interface ComposeSlot {
  slotId: string
  /** Typy jedla pre hlavné jedlo políčka. */
  categories: RecipeCategory[]
  /** Pridať aj polievku (napr. k obedu). */
  withSoup: boolean
}

export interface ComposeCell {
  date: string
  slotId: string
  brush: FillBrush
}

export interface ComposeRequest {
  cells: ComposeCell[]
  slots: ComposeSlot[]
  timeLimits: Partial<Record<string, ComposeTimeLimit>>
  /** Len recepty s aspoň jedným z týchto tagov (prázdne = všetky). */
  tagIds: string[]
  /** Uvarené hlavné jedlo alebo polievka vystačí ešte na toľko ďalších dní (0 = bez zvyškov). */
  leftoverDays: number
  /** Náhoda, aby každé zostavenie nebolo rovnaké (rovnaké číslo = rovnaký návrh). */
  seed: number
}

export interface ComposeContext {
  candidates: readonly ComposeCandidate[]
  pantryIngredientIds: readonly string[]
  /** Členovia rodiny aj návštevy s preferenciami. */
  members: readonly PreferenceMember[]
  /** Návštevy s pobytom v daný deň. */
  guestsOn: Readonly<Record<string, readonly string[]>>
  /** Čo už v jedálničku v zostavovanom rozsahu je (a ostane). */
  existing: readonly { date: string; slotId: string; recipeId: string }[]
  /** Recepty varené alebo naplánované tesne pred rozsahom – hlavné jedlá sa z nich nenavrhujú. */
  recentRecipeIds: readonly string[]
  today: string
}

export interface ComposeOption {
  recipeId: string
  title: string
  coverImageUrl: string | null
  totalMinutes: number | null
  category: RecipeCategory
  warnings: PreferenceWarning[]
}

export interface ComposeItem {
  /** `dátum|jedlo dňa|chod` – jednoznačné v rámci návrhu. */
  key: string
  date: string
  slotId: string
  course: ComposeCourse
  recipeId: string | null
  title: string | null
  coverImageUrl: string | null
  totalMinutes: number | null
  category: RecipeCategory | null
  /** Zvyšky: kľúč položky, kde sa varí. */
  leftoverOf: string | null
  /** Pri varení: na koľko ďalších dní vystačí (počet zvyškov v návrhu). */
  leftoverDays: number
  warnings: PreferenceWarning[]
  /** Ďalšie vhodné recepty pre „Iný návrh“ (najlepší prvý). */
  options: ComposeOption[]
  /** Iné dni, kedy je ten istý recept v jedálničku alebo v návrhu (odznak „Už máme“). */
  repeatsOn: string[]
}

/** Hlavné jedlá a polievky sa v zostavení neopakujú a varia sa na viac dní. */
const isMeal = (category: RecipeCategory | null) => category === 'hlavne' || category === 'polievka'

const MAX_RECENCY_DAYS = 60
const NEVER_COOKED_RECENCY = 20
const OPTIONS = 6

/** Jednoduchý deterministický generátor (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const passesBrush = (c: ComposeCandidate, brush: FillBrush) =>
  brush === 'verified'
    ? c.isVerified
    : brush === 'new'
      ? c.lastCookedOn === null
      : brush === 'favorite'
        ? c.isFavorite
        : true

/**
 * Návrh jedálnička pre vymaľované políčka. Kandidáti podľa typu jedla, štetca, tagov a času dňa; alergény ľudí pri
 * stole (rodina + návštevy s pobytom) sa vylúčia, neobľúbené jedlá idú až na koniec. Hlavné jedlá a polievky sa
 * neopakujú, ostatné môžu (s menšou prednosťou). Uvarené hlavné jedlo dostane zvyšky na ďalšie políčka toho istého
 * jedla dňa.
 */
export function composePlan(req: ComposeRequest, ctx: ComposeContext): ComposeItem[] {
  const rng = random(req.seed)
  const pantry = new Set(ctx.pantryIngredientIds)
  const tagFilter = new Set(req.tagIds)
  const slotOrder = new Map(req.slots.map((s, i) => [s.slotId, i]))
  const slotOf = new Map(req.slots.map((s) => [s.slotId, s]))
  const recent = new Set(ctx.recentRecipeIds)
  const existingRecipes = new Set(ctx.existing.map((e) => e.recipeId))
  const usedMeals = new Set<string>()
  const useCount = new Map<string, number>()
  const leftDays = Math.max(0, Math.min(MAX_LEFTOVER_DAYS, Math.round(req.leftoverDays)))

  // Zvyšky čakajúce na ďalšie políčko toho istého jedla dňa a chodu.
  const pending = new Map<string, { item: ComposeItem; remaining: number }>()

  const cells = [...req.cells]
    .filter((c) => slotOf.has(c.slotId))
    .sort((a, b) => a.date.localeCompare(b.date) || slotOrder.get(a.slotId)! - slotOrder.get(b.slotId)!)

  const items: ComposeItem[] = []
  const warningsFor = (c: ComposeCandidate, date: string) =>
    preferenceConflicts(
      { id: c.id, title: c.title, ingredientIds: c.allIngredientIds, tagIds: c.tagIds },
      ctx.members,
      'all',
      ctx.guestsOn[date] ?? [],
    )

  for (const cell of cells) {
    const slot = slotOf.get(cell.slotId)!
    const courses: { course: ComposeCourse; categories: RecipeCategory[] }[] = slot.withSoup
      ? [
          { course: 'soup', categories: ['polievka'] },
          { course: 'main', categories: slot.categories },
        ]
      : [{ course: 'main', categories: slot.categories }]

    for (const { course, categories } of courses) {
      const key = `${cell.date}|${cell.slotId}|${course}`
      const chain = `${cell.slotId}|${course}`
      const waiting = pending.get(chain)
      if (waiting && waiting.remaining > 0) {
        const source = waiting.item
        const candidate = ctx.candidates.find((c) => c.id === source.recipeId)!
        waiting.remaining -= 1
        source.leftoverDays += 1
        items.push({
          ...source,
          key,
          date: cell.date,
          leftoverOf: source.key,
          leftoverDays: 0,
          warnings: warningsFor(candidate, cell.date),
          options: [],
          repeatsOn: [],
        })
        continue
      }
      pending.delete(chain)

      const limit = req.timeLimits[cell.date]
      const ranked = ctx.candidates
        .filter((c) => categories.includes(c.category))
        .filter((c) => passesBrush(c, cell.brush))
        .filter((c) => tagFilter.size === 0 || c.tagIds.some((t) => tagFilter.has(t)))
        .filter((c) => !limit || c.totalMinutes === null || c.totalMinutes <= LIMIT_MINUTES[limit])
        .filter(
          (c) =>
            !isMeal(c.category) || (!usedMeals.has(c.id) && !existingRecipes.has(c.id) && !recent.has(c.id)),
        )
        .map((c) => {
          const warnings = warningsFor(c, cell.date)
          if (warnings.some((w) => w.kind === 'allergy')) return null
          const disliked = warnings.some((w) => w.kind === 'dislike_recipe')
          const dislikes = warnings.filter((w) => w.kind === 'dislike').length
          const availability =
            c.required.length === 0
              ? 1
              : c.required.filter((i) => pantry.has(i.id)).length / c.required.length
          const since = c.lastCookedOn === null ? null : Math.max(0, daysBetween(c.lastCookedOn, ctx.today))
          const recency =
            since === null
              ? NEVER_COOKED_RECENCY
              : (30 * Math.min(since, MAX_RECENCY_DAYS)) / MAX_RECENCY_DAYS
          const repeats = (useCount.get(c.id) ?? 0) + (existingRecipes.has(c.id) ? 1 : 0)
          const score =
            50 * availability + recency + (c.isFavorite ? 10 : 0) - 5 * dislikes - 25 * repeats + rng() * 8
          // Poradie: najprv bez neobľúbeného jedla, potom so známym časom (pri limite dňa), potom skóre.
          const tier = (disliked ? 2 : 0) + (limit && c.totalMinutes === null ? 1 : 0)
          return { c, warnings, score, tier }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.tier - b.tier || b.score - a.score)

      const best = ranked[0]
      const item: ComposeItem = {
        key,
        date: cell.date,
        slotId: cell.slotId,
        course,
        recipeId: best?.c.id ?? null,
        title: best?.c.title ?? null,
        coverImageUrl: best?.c.coverImageUrl ?? null,
        totalMinutes: best?.c.totalMinutes ?? null,
        category: best?.c.category ?? null,
        leftoverOf: null,
        leftoverDays: 0,
        warnings: best?.warnings ?? [],
        options: ranked.slice(0, OPTIONS).map(({ c, warnings }) => ({
          recipeId: c.id,
          title: c.title,
          coverImageUrl: c.coverImageUrl,
          totalMinutes: c.totalMinutes,
          category: c.category,
          warnings,
        })),
        repeatsOn: [],
      }
      items.push(item)
      if (best) {
        useCount.set(best.c.id, (useCount.get(best.c.id) ?? 0) + 1)
        if (isMeal(best.c.category)) {
          usedMeals.add(best.c.id)
          if (leftDays > 0) pending.set(chain, { item, remaining: leftDays })
        }
      }
    }
  }

  // „Už máme“: iné dni s tým istým receptom (v jedálničku alebo v návrhu), okrem vlastných zvyškov.
  for (const item of items) {
    if (!item.recipeId || item.leftoverOf) continue
    const own = new Set([item.key, ...items.filter((i) => i.leftoverOf === item.key).map((i) => i.key)])
    const dates = [
      ...items.filter((i) => i.recipeId === item.recipeId && !own.has(i.key)).map((i) => i.date),
      ...ctx.existing.filter((e) => e.recipeId === item.recipeId).map((e) => e.date),
    ]
    item.repeatsOn = [...new Set(dates.filter((d) => d !== item.date))].sort()
  }
  return items
}
