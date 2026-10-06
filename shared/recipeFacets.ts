import { normalizeText } from './text'

export type TimeBucket = 'do30' | 'do60' | 'nad60'
export const TIME_BUCKETS: readonly TimeBucket[] = ['do30', 'do60', 'nad60']

export type SortKey = 'name' | 'created' | 'time' | 'difficulty' | 'cooked'
export type SortDir = 'asc' | 'desc'
export const SORT_KEYS: readonly SortKey[] = ['name', 'created', 'time', 'difficulty', 'cooked']

/** Minimum, ktoré filtre a zoradenie potrebujú z receptu. */
export interface FacetRow {
  id: string
  title: string
  category: string
  difficulty: number
  totalMinutes: number | null
  tagIds: string[]
  isFavorite: boolean
  createdAt: string
  lastCookedAt: string | null
  missing?: string[] | undefined
}

export interface RecipeFilters {
  category?: string[]
  tag?: string[]
  difficulty?: number[]
  time?: TimeBucket[]
  favorite?: boolean
  /** Najviac toľko chýbajúcich surovín (len pri „Čo viem uvariť“, kde recepty nesú `missing`). */
  missingMax?: number
}

export interface RecipeFacets {
  category: Record<string, number>
  tag: Record<string, number>
  difficulty: Record<number, number>
  time: Partial<Record<TimeBucket, number>>
  /** Podľa počtu chýbajúcich surovín: 0, 1, 2 (dve a viac). Prázdne mimo „Čo viem uvariť“. */
  missing: Partial<Record<0 | 1 | 2, number>>
}

type Dimension = 'category' | 'tag' | 'difficulty' | 'time' | 'missing'

export function timeBucket(minutes: number | null): TimeBucket | null {
  if (minutes === null) return null
  if (minutes <= 30) return 'do30'
  if (minutes <= 60) return 'do60'
  return 'nad60'
}

const matches = (row: FacetRow, filters: RecipeFilters, skip?: Dimension): boolean => {
  if (filters.favorite && !row.isFavorite) return false
  if (skip !== 'category' && filters.category?.length && !filters.category.includes(row.category))
    return false
  if (skip !== 'tag' && filters.tag?.length && !filters.tag.some((t) => row.tagIds.includes(t))) return false
  if (skip !== 'difficulty' && filters.difficulty?.length && !filters.difficulty.includes(row.difficulty)) {
    return false
  }
  if (skip !== 'time' && filters.time?.length) {
    const bucket = timeBucket(row.totalMinutes)
    if (!bucket || !filters.time.includes(bucket)) return false
  }
  if (skip !== 'missing' && filters.missingMax !== undefined) {
    if (!row.missing || row.missing.length > filters.missingMax) return false
  }
  return true
}

export function applyRecipeFilters<T extends FacetRow>(rows: readonly T[], filters: RecipeFilters): T[] {
  return rows.filter((r) => matches(r, filters))
}

const bump = <K extends string | number>(into: Record<K, number>, key: K) => {
  into[key] = (into[key] ?? 0) + 1
}

/**
 * Počty pri možnostiach filtra: pri každom rozmere sa berú recepty, ktoré spĺňajú
 * všetky OSTATNÉ rozmery. Vlastný rozmer sa nezužuje, aby šlo pridať ďalšiu možnosť.
 */
export function computeFacets(rows: readonly FacetRow[], filters: RecipeFilters): RecipeFacets {
  const facets: RecipeFacets = { category: {}, tag: {}, difficulty: {}, time: {}, missing: {} }
  for (const row of rows) {
    if (matches(row, filters, 'category')) bump(facets.category, row.category)
    if (matches(row, filters, 'tag')) for (const t of row.tagIds) bump(facets.tag, t)
    if (matches(row, filters, 'difficulty')) bump(facets.difficulty, row.difficulty)
    if (matches(row, filters, 'time')) {
      const bucket = timeBucket(row.totalMinutes)
      if (bucket) bump(facets.time as Record<TimeBucket, number>, bucket)
    }
    if (row.missing && matches(row, filters, 'missing')) {
      bump(facets.missing as Record<0 | 1 | 2, number>, Math.min(row.missing.length, 2) as 0 | 1 | 2)
    }
  }
  return facets
}

export const defaultSortDir = (key: SortKey): SortDir => (key === 'created' ? 'desc' : 'asc')

const byTitle = (a: FacetRow, b: FacetRow) =>
  normalizeText(a.title).localeCompare(normalizeText(b.title), 'sk')

/** Zoradenie; recepty bez hodnoty (čas, naposledy varené) idú vždy na koniec. */
export function sortRecipes<T extends FacetRow>(rows: readonly T[], key: SortKey, dir?: SortDir): T[] {
  const direction = dir ?? defaultSortDir(key)
  const sign = direction === 'asc' ? 1 : -1
  const value = (r: T): string | number | null => {
    switch (key) {
      case 'name':
        return normalizeText(r.title)
      case 'created':
        return r.createdAt
      case 'time':
        return r.totalMinutes
      case 'difficulty':
        return r.difficulty
      case 'cooked':
        return r.lastCookedAt
    }
  }
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === null && vb === null) return byTitle(a, b)
    if (va === null) return 1
    if (vb === null) return -1
    const cmp =
      typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'sk')
    return cmp === 0 ? byTitle(a, b) : cmp * sign
  })
}

export const TIME_BUCKET_LABELS: Readonly<Record<TimeBucket, string>> = {
  do30: 'Do 30 min',
  do60: '30 – 60 min',
  nad60: 'Nad 60 min',
}

export const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  name: 'Názov',
  created: 'Dátum pridania',
  time: 'Čas prípravy',
  difficulty: 'Náročnosť',
  cooked: 'Naposledy varené',
}
