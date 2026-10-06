import {
  defaultSortDir,
  SORT_KEYS,
  TIME_BUCKETS,
  type SortDir,
  type SortKey,
  type TimeBucket,
} from '@shared/recipeFacets'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@shared/recipes'

/** Stav zoznamu receptov, ako sa ukladá do URL (názvy parametrov sú po slovensky). */
export interface RecipeListState {
  q: string | undefined
  category: RecipeCategory[]
  tag: string[]
  difficulty: number[]
  time: TimeBucket[]
  favorite: boolean
  pantry: boolean
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

const pick = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v))

const MISSING_VALUES: Readonly<Record<string, 0 | 1>> = { '0': 0, '1': 1 }

export function parseListQuery(query: Query): RecipeListState {
  const sort = one(query.zoradit)
  const dir = one(query.smer)
  return {
    q: one(query.q),
    category: pick(many(query.kategoria), RECIPE_CATEGORIES),
    tag: many(query.tag),
    difficulty: many(query.narocnost)
      .map(Number)
      .filter((n) => n === 1 || n === 2 || n === 3),
    time: pick(many(query.cas), TIME_BUCKETS),
    favorite: one(query.oblubene) === '1',
    pantry: one(query.doma) === '1',
    missing: one(query.doma) === '1' ? MISSING_VALUES[one(query.chyba) ?? ''] : undefined,
    sort: pick(sort ? [sort] : [], SORT_KEYS)[0],
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
