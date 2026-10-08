import { defaultSortDir, SORT_KEYS, type SortDir, type SortKey, type TimeBucket } from '@shared/recipeFacets'
import type { RecipeCategory } from '@shared/recipes'
import { translateLegacyQuery } from '@/router/legacy'
import { categoryFromSlug, CATEGORY_SLUGS, timeFromSlug, TIME_SLUGS } from '@/router/urlSlugs'

/** Stav zoznamu receptov, ako sa ukladá do URL (parametre aj hodnoty sú po anglicky). */
export interface RecipeListState {
  q: string | undefined
  category: RecipeCategory[]
  tag: string[]
  difficulty: number[]
  time: TimeBucket[]
  favorite: boolean
  pantry: boolean
  /** Detské recepty: skryté (predvolene), pridané (`kids=include`) alebo len ony (`kids=only`). */
  kids: KidsMode
  /** Verejné recepty iných domácností: bez (predvolene), s nimi (`public=include`) alebo len cudzie (`public=only`). */
  public: PublicMode
  /** Najviac toľko chýbajúcich surovín (0 = viem uvariť, 1 = chýba jedna); len pri „Čo viem uvariť“. */
  missing: 0 | 1 | undefined
  sort: SortKey | undefined
  dir: SortDir | undefined
}

type Query = Record<string, unknown>

/** vue-router dáva pri opakovanom parametri pole; berieme prvú hodnotu. */
const one = (v: unknown): string | undefined => {
  const value = Array.isArray(v) ? v[0] : v
  return typeof value === 'string' && value ? value : undefined
}

const many = (v: unknown): string[] =>
  (one(v) ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

const fromSlugs = <T extends string>(values: string[], parse: (slug: string) => T | undefined): T[] =>
  values.map(parse).filter((v): v is T => v !== undefined)

/** Typy jedla a časy do adresy (anglické podoby). */
export const categoriesToParam = (list: readonly RecipeCategory[]): string | undefined =>
  listToParam(list.map((c) => CATEGORY_SLUGS[c]))
export const timesToParam = (list: readonly TimeBucket[]): string | undefined =>
  listToParam(list.map((b) => TIME_SLUGS[b]))

export type KidsMode = 'hide' | 'include' | 'only'
const KIDS_PARAM: Readonly<Record<string, KidsMode>> = { include: 'include', only: 'only' }

export type PublicMode = 'hide' | 'include' | 'only'
const PUBLIC_PARAM: Readonly<Record<string, PublicMode>> = { include: 'include', only: 'only' }

const MISSING_VALUES: Readonly<Record<string, 0 | 1>> = { '0': 0, '1': 1 }

export function parseListQuery(query: Query): RecipeListState {
  const sort = one(query.sort)
  const dir = one(query.dir)
  return {
    q: one(query.q),
    category: fromSlugs(many(query.category), categoryFromSlug),
    tag: many(query.tag),
    difficulty: many(query.difficulty)
      .map(Number)
      .filter((n) => n === 1 || n === 2 || n === 3),
    time: fromSlugs(many(query.time), timeFromSlug),
    favorite: one(query.favorites) === '1',
    pantry: one(query.pantry) === '1',
    kids: KIDS_PARAM[one(query.kids) ?? ''] ?? 'hide',
    public: PUBLIC_PARAM[one(query.public) ?? ''] ?? 'hide',
    missing: one(query.pantry) === '1' ? MISSING_VALUES[one(query.missing) ?? ''] : undefined,
    sort: SORT_KEYS.find((key) => key === sort),
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
  }
}

export const toggleValue = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export const listToParam = (list: readonly (string | number)[]): string | undefined =>
  list.length ? list.join(',') : undefined

/** Počet aktívnych filtrov na tlačidle „Filtre (n)“; hľadanie a „čo viem uvariť“ sa nerátajú. */
export const activeFilterCount = (s: RecipeListState): number =>
  s.category.length + s.tag.length + s.difficulty.length + s.time.length + (s.favorite ? 1 : 0)

/** Kľúče stĺpcov tabuľky ↔ kľúče zoradenia. */
const TABLE_KEYS: Readonly<Record<string, SortKey>> = {
  title: 'name',
  category: 'category',
  totalMinutes: 'time',
  difficulty: 'difficulty',
  lastCookedAt: 'cooked',
  createdAt: 'created',
}

export interface TableSort {
  key: string
  order: 'asc' | 'desc'
}

export function tableSortToState(sortBy: readonly TableSort[]): { sort: SortKey; dir: SortDir } | null {
  const first = sortBy[0]
  const sort = first ? TABLE_KEYS[first.key] : undefined
  return first && sort ? { sort, dir: first.order } : null
}

export function stateToTableSort(sort: SortKey | undefined, dir: SortDir | undefined): TableSort[] {
  const key = sort ?? 'name'
  const column = Object.entries(TABLE_KEYS).find(([, v]) => v === key)![0]
  return [{ key: column, order: dir ?? defaultSortDir(key) }]
}

export type FilterDimension = 'category' | 'tag' | 'difficulty' | 'time'

export type RecipeView = 'grid' | 'table'

/** Uložený pohľad (mriežka/tabuľka); čokoľvek iné je mriežka. */
export const parseRecipeView = (raw: string | null | undefined): RecipeView =>
  raw === 'table' ? 'table' : 'grid'

/** Parametre adresy, ktoré sa ukladajú ako predvolené filtre a zoradenie (hľadaný text nie). */
const SAVED_QUERY_KEYS = [
  'category',
  'tag',
  'difficulty',
  'time',
  'favorites',
  'kids',
  'public',
  'pantry',
  'missing',
  'sort',
  'dir',
] as const

/** Všetky parametre zoznamu receptov vrátane hľadania; ak je niektorý v adrese, uložené filtre sa nevracajú. */
const LIST_QUERY_KEYS = ['q', ...SAVED_QUERY_KEYS] as const

/** Filtre a zoradenie z adresy na uloženie k používateľovi; bez filtrov `null` (uložené sa vymažú). */
export function savableListQuery(query: Query): Record<string, string> | null {
  const saved: Record<string, string> = {}
  for (const key of SAVED_QUERY_KEYS) {
    const value = one(query[key])
    if (value) saved[key] = value
  }
  return Object.keys(saved).length > 0 ? saved : null
}

/** Uložené filtre na obnovenie pri otvorení Receptov bez filtrov v adrese, inak `null`. */
export function queryToRestore(
  query: Query,
  saved: Record<string, string> | undefined,
): Record<string, string> | null {
  if (!saved || Object.keys(saved).length === 0) return null
  if (LIST_QUERY_KEYS.some((key) => one(query[key]))) return null
  // Filtre uložené pred prechodom na anglické adresy majú slovenské názvy.
  return translateLegacyQuery(saved) as Record<string, string>
}
