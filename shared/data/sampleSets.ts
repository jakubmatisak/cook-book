import type { RecipeCategory } from '../recipes'
import type { RecipeInputRaw } from '../schemas/recipe'
import { slugify } from '../text'
import { BABY_RECIPES } from './babyRecipes'
import { MEAL_SAMPLES } from './sampleMeals'
import { SAMPLE_RECIPES } from './sampleRecipes'

/**
 * Balíky základných receptov v Nastaveniach – každý sa pridáva aj odstraňuje zvlášť. Balík nie je typ jedla receptu
 * (olovrant je napr. dezert, ktorý sa hodí aj ako desiata).
 */
export const SAMPLE_GROUPS = [
  'ranajky',
  'desiata',
  'olovrant',
  'vecera',
  'polievky',
  'hlavne',
  'salaty',
  'dezerty',
  'kids',
] as const
export type SampleGroup = (typeof SAMPLE_GROUPS)[number]

/** `basic` = všetky balíky okrem detských (staršia verzia aplikácie mala jedno tlačidlo). */
export const SAMPLE_SET_NAMES = [...SAMPLE_GROUPS, 'basic'] as const
export type SampleSet = (typeof SAMPLE_SET_NAMES)[number]

export interface SampleRecipe extends RecipeInputRaw {
  /** Trvalý kľúč – podľa neho sa recept domácnosti nájde pri doplnení alebo odstránení balíka. */
  key: string
  group: SampleGroup
  category: RecipeCategory
  alsoCategories?: RecipeCategory[]
}

/** Doterajších 21 základných receptov: kľúč, balík a „hodí sa aj ako“ (podľa názvu). */
const BASIC_META: Readonly<Record<string, { key: string; group: SampleGroup; also?: RecipeCategory[] }>> = {
  'Slepačí vývar s rezancami': { key: 'slepaci-vyvar', group: 'polievky' },
  'Šošovicová polievka': { key: 'sosovicova-polievka', group: 'polievky' },
  'Paradajková polievka': { key: 'paradajkova-polievka', group: 'polievky' },
  Kapustnica: { key: 'kapustnica', group: 'polievky' },
  'Bryndzové halušky': { key: 'bryndzove-halusky', group: 'hlavne', also: ['vecera'] },
  'Vyprážaný rezeň so zemiakovou kašou': { key: 'rezen-zemiakova-kasa', group: 'hlavne' },
  'Segedínsky guláš': { key: 'segedinsky-gulas', group: 'hlavne' },
  'Špagety bolonské': { key: 'spagety-bolonske', group: 'hlavne', also: ['vecera'] },
  Lasagne: { key: 'lasagne', group: 'hlavne' },
  'Francúzske zemiaky': { key: 'francuzske-zemiaky', group: 'hlavne', also: ['vecera'] },
  'Rizoto so zeleninou': { key: 'rizoto-zelenina', group: 'hlavne', also: ['vecera'] },
  'Kuracie prsia na smotane': { key: 'kuracie-prsia-smotana', group: 'hlavne' },
  'Zemiakový šalát': { key: 'zemiakovy-salat', group: 'salaty', also: ['priloha', 'vecera'] },
  'Cestovinový šalát': { key: 'cestovinovy-salat', group: 'salaty', also: ['vecera', 'desiata'] },
  'Ryža s hráškom': { key: 'ryza-hrasok', group: 'salaty' },
  'Miešané vajíčka': { key: 'miesane-vajicka', group: 'ranajky', also: ['vecera'] },
  'Ovsená kaša s ovocím': { key: 'ovsena-kasa', group: 'ranajky', also: ['desiata'] },
  'Americké lievance': { key: 'americke-lievance', group: 'dezerty', also: ['ranajky', 'desiata', 'vecera'] },
  'Jablková štrúdľa': { key: 'jablkova-strudla', group: 'dezerty', also: ['desiata'] },
  'Parené buchty so slivkovým lekvárom': {
    key: 'parene-buchty',
    group: 'dezerty',
    also: ['hlavne', 'vecera'],
  },
  'Tvarohový koláč': { key: 'tvarohovy-kolac', group: 'dezerty', also: ['desiata'] },
}

const basic: SampleRecipe[] = SAMPLE_RECIPES.map((recipe) => {
  const meta = BASIC_META[recipe.title]
  if (!meta) throw new Error(`Základný recept bez balíka: ${recipe.title}`)
  return {
    ...recipe,
    category: recipe.category ?? 'hlavne',
    key: meta.key,
    group: meta.group,
    alsoCategories: meta.also ?? [],
  }
})
const meals: SampleRecipe[] = MEAL_SAMPLES.map(({ set, ...recipe }) => ({ ...recipe, group: set }))
const kids: SampleRecipe[] = BABY_RECIPES.map((recipe) => ({
  ...recipe,
  category: 'detske',
  key: `deti-${slugify(recipe.title)}`,
  group: 'kids',
}))

/** Všetky základné recepty v poradí balíkov. */
export const ALL_SAMPLES: readonly SampleRecipe[] = SAMPLE_GROUPS.flatMap((group) =>
  [...meals, ...basic, ...kids].filter((r) => r.group === group),
)

export const samplesOf = (set: SampleSet): SampleRecipe[] =>
  ALL_SAMPLES.filter((r) => (set === 'basic' ? r.group !== 'kids' : r.group === set))
