import type { TimeBucket } from '@shared/recipeFacets'
import type { RecipeCategory } from '@shared/recipes'

/**
 * Adresy aplikácie sú po anglicky bez ohľadu na jazyk rozhrania. Typ jedla a čas majú v databáze slovenské
 * kľúče, v adrese ich anglické podoby (`?category=dessert&time=under30`).
 */
export const CATEGORY_SLUGS: Readonly<Record<RecipeCategory, string>> = {
  polievka: 'soup',
  hlavne: 'main',
  priloha: 'side',
  omacka: 'sauce',
  salat: 'salad',
  dezert: 'dessert',
  ranajky: 'breakfast',
  desiata: 'snack',
  vecera: 'dinner',
  napoj: 'drink',
  detske: 'kids',
  ine: 'other',
}

export const TIME_SLUGS: Readonly<Record<TimeBucket, string>> = {
  do30: 'under30',
  do60: 'under60',
  nad60: 'over60',
}

const invert = <K extends string>(map: Readonly<Record<K, string>>): Readonly<Record<string, K>> =>
  Object.fromEntries(Object.entries(map).map(([key, slug]) => [slug, key])) as Record<string, K>

const CATEGORY_BY_SLUG = invert(CATEGORY_SLUGS)
const TIME_BY_SLUG = invert(TIME_SLUGS)

export const categoryFromSlug = (slug: string): RecipeCategory | undefined => CATEGORY_BY_SLUG[slug]
export const timeFromSlug = (slug: string): TimeBucket | undefined => TIME_BY_SLUG[slug]
