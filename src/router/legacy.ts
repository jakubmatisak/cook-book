import type { TimeBucket } from '@shared/recipeFacets'
import type { RecipeCategory } from '@shared/recipes'
import { CATEGORY_SLUGS, TIME_SLUGS } from './urlSlugs'

/**
 * Staré slovenské adresy (záložky, nainštalovaná aplikácia, staršie rozšírenie do Chromu) sa presmerujú na
 * anglické: cesta, názvy parametrov aj ich hodnoty.
 */
const PATHS: readonly [RegExp, string][] = [
  [/^\/recepty\/novy$/, '/recipes/new'],
  [/^\/recepty\/([^/]+)\/upravit$/, '/recipes/$1/edit'],
  [/^\/recepty\/([^/]+)\/varenie$/, '/recipes/$1/cook'],
  [/^\/recepty(\/.*)?$/, '/recipes$1'],
  [/^\/verejne\/([^/]+)$/, '/public/$1'],
  [/^\/nakup$/, '/shopping'],
  [/^\/spajza$/, '/pantry'],
  [/^\/rodina$/, '/people'],
  [/^\/ingrediencie$/, '/ingredients'],
  [/^\/tagy$/, '/tags'],
  [/^\/(nastavenia|viac)$/, '/settings'],
]

const KEYS: Readonly<Record<string, string>> = {
  kategoria: 'category',
  narocnost: 'difficulty',
  cas: 'time',
  oblubene: 'favorites',
  detske: 'kids',
  verejne: 'public',
  doma: 'pantry',
  chyba: 'missing',
  zoradit: 'sort',
  smer: 'dir',
  tyzden: 'week',
  porcie: 'servings',
}

const mapList = (value: string, map: Readonly<Record<string, string>>) =>
  value
    .split(',')
    .map((part) => map[part] ?? part)
    .join(',')

const VALUES: Readonly<Record<string, (value: string) => string>> = {
  category: (v) => mapList(v, CATEGORY_SLUGS as Record<RecipeCategory, string>),
  time: (v) => mapList(v, TIME_SLUGS as Record<TimeBucket, string>),
  kids: (v) => (v === '1' ? 'include' : v === 'len' ? 'only' : v),
  public: (v) => (v === '1' ? 'include' : v === 'len' ? 'only' : v),
}

type Query = Record<string, unknown>

/** Preloží staré názvy parametrov a ich hodnoty; nové a neznáme parametre nechá. */
export function translateLegacyQuery<Q extends Query>(query: Q): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    const english = KEYS[key]
    if (!english) {
      result[key] = value
      continue
    }
    const translate = VALUES[english]
    result[english] = translate && typeof value === 'string' ? translate(value) : value
  }
  return result
}

const hasLegacyKey = (query: Query) => Object.keys(query).some((key) => key in KEYS)

/** Nová adresa pre starú slovenskú, alebo `null`, ak adresa už je nová. */
export function legacyRedirect(
  path: string,
  query: Query,
): { path: string; query: Record<string, unknown> } | null {
  if (path === '/verejne')
    return { path: '/recipes', query: { public: 'only', ...translateLegacyQuery(query) } }
  const rule = PATHS.find(([pattern]) => pattern.test(path))
  if (!rule && !hasLegacyKey(query)) return null
  return {
    path: rule ? path.replace(rule[0], rule[1]) : path,
    query: translateLegacyQuery(query),
  }
}
