import type { RecipeInputRaw } from '../schemas/recipe'
import { BABY_RECIPES } from './babyRecipes'
import { SAMPLE_RECIPES } from './sampleRecipes'

/** Sady ukážkových receptov: základné slovenské jedlá a detské (kaše a príkrmy). Každú pridáva vlastník zvlášť. */
export const SAMPLE_SET_NAMES = ['basic', 'kids'] as const
export type SampleSet = (typeof SAMPLE_SET_NAMES)[number]

export const SAMPLE_SETS: Readonly<Record<SampleSet, readonly RecipeInputRaw[]>> = {
  basic: SAMPLE_RECIPES,
  kids: BABY_RECIPES,
}
