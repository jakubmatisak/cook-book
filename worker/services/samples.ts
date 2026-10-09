import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { SampleGroupStatusDto, SampleRecipesResult } from '../../shared/api'
import {
  ALL_SAMPLES,
  SAMPLE_GROUPS,
  samplesOf,
  type SampleRecipe,
  type SampleSet,
} from '../../shared/data/sampleSets'
import { normalizeAlsoCategories } from '../../shared/recipes'
import { BULK_MAX } from '../../shared/schemas/bulk'
import { recipeInputSchema } from '../../shared/schemas/recipe'
import { normalizeText } from '../../shared/text'
import type { Db } from '../db/client'
import { recipes, recipeSteps } from '../db/schema'
import type { UserRow } from '../env'
import { chunk } from '../http'
import { bulkDeleteRecipes } from './bulk'
import { storeImage } from './images'
import { saveRecipe } from './recipes'

/** Fotka základného receptu (z balíka aplikácie) a riadok o autorovi do poznámky. */
export interface SamplePhotos {
  bucket: R2Bucket
  load: (key: string) => Promise<{ bytes: Uint8Array; credit: string } | null>
}

/** Najviac toľko receptov na jedno volanie (limit dopytov na jedno spustenie Workera, fotka pridá zápisy). */
const SAMPLE_BATCH = 3

const groupOf = new Map(ALL_SAMPLES.map((r) => [r.key, r.group]))

interface LiveRow {
  id: string
  titleNormalized: string
  sampleKey: string | null
  coverImageId: string | null
  description: string | null
  notes: string | null
  category: SampleRecipe['category']
  alsoCategories: SampleRecipe['category'][]
}

async function liveRecipes(db: Db, householdId: string): Promise<LiveRow[]> {
  return db
    .select({
      id: recipes.id,
      titleNormalized: recipes.titleNormalized,
      sampleKey: recipes.sampleKey,
      coverImageId: recipes.coverImageId,
      description: recipes.description,
      notes: recipes.notes,
      category: recipes.category,
      alsoCategories: recipes.alsoCategories,
    })
    .from(recipes)
    .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt)))
}

/** Prvé kroky receptov (podľa nich sa spozná nezmenený starší import). */
async function firstSteps(db: Db, ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  for (const part of chunk(ids, 90)) {
    const rows = await db
      .select({ recipeId: recipeSteps.recipeId, text: recipeSteps.text, position: recipeSteps.position })
      .from(recipeSteps)
      .where(inArray(recipeSteps.recipeId, part))
    for (const row of rows.sort((a, b) => a.position - b.position)) {
      if (!result.has(row.recipeId)) result.set(row.recipeId, row.text)
    }
  }
  return result
}

/** Koľko receptov má každý balík a koľko z nich domácnosť má (podľa kľúča). */
export async function sampleStatus(db: Db, householdId: string): Promise<SampleGroupStatusDto[]> {
  const rows = await db
    .select({ sampleKey: recipes.sampleKey })
    .from(recipes)
    .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt), isNotNull(recipes.sampleKey)))
  const have = new Set(rows.map((r) => r.sampleKey))
  return SAMPLE_GROUPS.map((set) => {
    const list = samplesOf(set)
    return { set, total: list.length, imported: list.filter((r) => have.has(r.key)).length }
  })
}

/**
 * Pridá chýbajúce recepty balíka po dávkach (volá sa opakovane, kým `remaining` nie je 0). Rovnomenný recept bez
 * fotky, ktorý má ešte pôvodný popis alebo prvý krok (starší import), sa nevytvorí znova, ale doplní: kľúč, fotka,
 * „hodí sa aj ako“ a autor fotky. Iný rovnomenný recept (vlastný) sa nechá tak a balík ho preskočí.
 */
export async function addSampleRecipes(
  db: Db,
  user: UserRow,
  set: SampleSet = 'basic',
  photos?: SamplePhotos,
): Promise<SampleRecipesResult> {
  const live = await liveRecipes(db, user.householdId)
  const byKey = new Set(live.flatMap((r) => (r.sampleKey ? [r.sampleKey] : [])))
  const byTitle = new Map<string, LiveRow[]>()
  for (const row of live) byTitle.set(row.titleNormalized, [...(byTitle.get(row.titleNormalized) ?? []), row])

  const todo = samplesOf(set).filter((r) => !byKey.has(r.key))
  const unkeyed = todo.flatMap((r) => byTitle.get(normalizeText(r.title)) ?? []).filter((r) => !r.sampleKey)
  const steps = await firstSteps(
    db,
    unkeyed.filter((r) => !r.coverImageId).map((r) => r.id),
  )
  const adoptable = (sample: SampleRecipe) =>
    (byTitle.get(normalizeText(sample.title)) ?? []).find(
      (r) =>
        !r.sampleKey &&
        !r.coverImageId &&
        ((sample.description && r.description === sample.description) ||
          steps.get(r.id) === sample.steps?.[0]?.text),
    )
  // Rovnomenný vlastný recept (s fotkou alebo upravený) balík preskočí.
  const pending = todo.filter((r) => adoptable(r) || !byTitle.has(normalizeText(r.title)))
  const batch = pending.slice(0, SAMPLE_BATCH)

  for (const sample of batch) {
    const photo = photos ? await photos.load(sample.key) : null
    const cover = photo && photos ? await storeImage(db, photos.bucket, user, photo.bytes) : null
    const old = adoptable(sample)
    if (old) {
      await db
        .update(recipes)
        .set({
          sampleKey: sample.key,
          ...(cover ? { coverImageId: cover.id } : {}),
          ...(old.alsoCategories.length
            ? {}
            : { alsoCategories: normalizeAlsoCategories(old.category, sample.alsoCategories ?? []) }),
          ...(photo && !old.notes ? { notes: photo.credit } : {}),
        })
        .where(eq(recipes.id, old.id))
      continue
    }
    const { key, group: _group, ...input } = sample
    await saveRecipe(
      db,
      user,
      recipeInputSchema.parse({ ...input, coverImageId: cover?.id ?? null, notes: photo?.credit ?? null }),
      undefined,
      undefined,
      key,
    )
  }
  return { added: batch.length, remaining: pending.length - batch.length }
}

/** Zmaže recepty domácnosti z balíka (podľa kľúča) ako bežné mazanie; vlastné recepty ostanú. */
export async function removeSampleGroup(
  db: Db,
  householdId: string,
  set: SampleSet,
  bucket?: R2Bucket,
): Promise<number> {
  const keys = new Set(samplesOf(set).map((r) => r.key))
  const rows = await db
    .select({ id: recipes.id, sampleKey: recipes.sampleKey })
    .from(recipes)
    .where(and(eq(recipes.householdId, householdId), isNull(recipes.deletedAt), isNotNull(recipes.sampleKey)))
  const ids = rows
    .filter((r) => r.sampleKey && keys.has(r.sampleKey) && groupOf.has(r.sampleKey))
    .map((r) => r.id)
  for (const part of chunk(ids, BULK_MAX)) await bulkDeleteRecipes(db, householdId, part, bucket)
  return ids.length
}
