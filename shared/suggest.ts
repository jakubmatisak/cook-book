import { daysBetween } from './dates'
import { describeWarning, preferenceConflicts, type PreferenceMember } from './preferences'
import { normalizeText } from './text'

/** Recept, z ktorého sa dá vyberať, s údajmi potrebnými na hodnotenie. */
export interface SuggestCandidate {
  id: string
  title: string
  coverImageUrl: string | null
  isFavorite: boolean
  totalMinutes: number | null
  /** Povinné ingrediencie (voliteľné sa do „čo chýba“ nerátajú). */
  required: { id: string; name: string }[]
  /** Všetky ingrediencie vrátane voliteľných, pre alergie a averzie. */
  allIngredientIds: string[]
  tagIds: string[]
  /** `YYYY-MM-DD` posledného varenia, alebo null. */
  lastCookedOn: string | null
}

export interface Suggestion {
  recipeId: string
  title: string
  coverImageUrl: string | null
  totalMinutes: number | null
  score: number
  /** Krátke dôvody po slovensky („Máš všetko doma“, „Naposledy pred 5 týždňami“). */
  reasons: string[]
  /** Názvy povinných ingrediencií, ktoré nie sú doma. */
  missing: string[]
}

const MAX_RECENCY_DAYS = 60
const NEVER_COOKED_RECENCY = 20
const DEFAULT_LIMIT = 6

/** „Naposledy pred 5 týždňami“ podľa počtu dní od posledného varenia. */
export function describeSince(days: number): string {
  if (days <= 0) return 'Varené dnes'
  if (days === 1) return 'Naposledy včera'
  if (days < 14) return `Naposledy pred ${days} dňami`
  if (days < 60) return `Naposledy pred ${Math.floor(days / 7)} týždňami`
  if (days < 365) return `Naposledy pred ${Math.floor(days / 30)} mesiacmi`
  return 'Naposledy pred viac ako rokom'
}

/**
 * Čo uvariť dnes: vylúči už naplánované recepty a recepty s alergénom pre rodinu, ostatné ohodnotí
 * (50 b. podľa toho, koľko povinného je doma, do 30 b. za dlhšie nevarené, 10 b. obľúbené,
 * −5 b. za každú averziu) a vráti najlepšie s dôvodmi.
 */
export function scoreSuggestions(input: {
  candidates: readonly SuggestCandidate[]
  pantryIngredientIds: readonly string[]
  plannedRecipeIds: readonly string[]
  members: readonly PreferenceMember[]
  today: string
  limit?: number
}): Suggestion[] {
  const pantry = new Set(input.pantryIngredientIds)
  const planned = new Set(input.plannedRecipeIds)
  const suggestions: Suggestion[] = []

  for (const c of input.candidates) {
    if (planned.has(c.id)) continue
    const conflicts = preferenceConflicts(
      { ingredientIds: c.allIngredientIds, tagIds: c.tagIds },
      input.members,
      'all',
    )
    if (conflicts.some((w) => w.kind === 'allergy')) continue
    const dislikes = conflicts.filter((w) => w.kind === 'dislike')

    const missing = c.required.filter((i) => !pantry.has(i.id)).map((i) => i.name)
    const availability = c.required.length === 0 ? 1 : 1 - missing.length / c.required.length
    const since = c.lastCookedOn === null ? null : Math.max(0, daysBetween(c.lastCookedOn, input.today))
    const recency =
      since === null ? NEVER_COOKED_RECENCY : (30 * Math.min(since, MAX_RECENCY_DAYS)) / MAX_RECENCY_DAYS
    const score = 50 * availability + recency + (c.isFavorite ? 10 : 0) - 5 * dislikes.length

    const reasons: string[] = []
    if (c.required.length > 0) {
      if (missing.length === 0) reasons.push('Máš všetko doma')
      else reasons.push(`Chýba: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`)
    }
    reasons.push(since === null ? 'Zatiaľ nevarené' : describeSince(since))
    if (c.isFavorite) reasons.push('Obľúbené')
    for (const w of dislikes) reasons.push(describeWarning(w))

    suggestions.push({
      recipeId: c.id,
      title: c.title,
      coverImageUrl: c.coverImageUrl,
      totalMinutes: c.totalMinutes,
      score: Math.round(score * 10) / 10,
      reasons,
      missing,
    })
  }

  return suggestions
    .sort((a, b) => b.score - a.score || normalizeText(a.title).localeCompare(normalizeText(b.title), 'sk'))
    .slice(0, input.limit ?? DEFAULT_LIMIT)
}
