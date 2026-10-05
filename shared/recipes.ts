export const RECIPE_CATEGORIES = [
  'polievka',
  'hlavne',
  'priloha',
  'salat',
  'dezert',
  'ranajky',
  'desiata',
  'napoj',
  'ine',
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  polievka: 'Polievka',
  hlavne: 'Hlavné jedlo',
  priloha: 'Príloha',
  salat: 'Šalát',
  dezert: 'Dezert',
  ranajky: 'Raňajky',
  desiata: 'Desiata',
  napoj: 'Nápoj',
  ine: 'Iné',
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Jednoduché',
  2: 'Stredné',
  3: 'Náročné',
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const
