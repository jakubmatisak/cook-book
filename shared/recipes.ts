export const RECIPE_CATEGORIES = [
  'polievka',
  'hlavne',
  'priloha',
  'omacka',
  'salat',
  'dezert',
  'ranajky',
  'desiata',
  'napoj',
  'detske',
  'ine',
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]

/** „Hodí sa aj ako“ bez hlavného typu a bez opakovania, v poradí kategórií. */
export const normalizeAlsoCategories = (
  main: RecipeCategory,
  also: readonly RecipeCategory[],
): RecipeCategory[] => RECIPE_CATEGORIES.filter((c) => c !== main && also.includes(c))

/** Súkromný recept vidí len domácnosť, verejný vidia všetci prihlásení v ktorejkoľvek domácnosti. */
export const RECIPE_VISIBILITIES = ['private', 'public'] as const
export type RecipeVisibility = (typeof RECIPE_VISIBILITIES)[number]

export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = {
  polievka: 'Polievka',
  hlavne: 'Hlavné jedlo',
  priloha: 'Príloha',
  omacka: 'Prílohové omáčky a Pestá',
  salat: 'Šalát',
  dezert: 'Dezert',
  ranajky: 'Raňajky',
  desiata: 'Desiata',
  napoj: 'Nápoj',
  detske: 'Detské',
  ine: 'Iné',
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Jednoduché',
  2: 'Stredné',
  3: 'Náročné',
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const
