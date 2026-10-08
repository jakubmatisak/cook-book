import { and, eq, isNull } from 'drizzle-orm'
import type { RecipeShareDto, SharedRecipeDto } from '../../shared/api'
import type { Db } from '../db/client'
import { images, recipes } from '../db/schema'
import { HttpError } from '../errors'
import { getRecipeDetail } from './recipes'

const notFound = () => new HttpError(404, 'not_found', 'Recept neexistuje.')

/** Neuhádnuteľný kód odkazu: 16 náhodných bajtov ako base64url (22 znakov). */
function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const shareDto = (token: string): RecipeShareDto => ({ token, url: `/s/${token}` })

const liveRecipe = (householdId: string, id: string) =>
  and(eq(recipes.id, id), eq(recipes.householdId, householdId), isNull(recipes.deletedAt))

/** Zapne zdieľanie receptu odkazom; ak už zdieľaný je, vráti existujúci odkaz. */
export async function shareRecipe(db: Db, householdId: string, id: string): Promise<RecipeShareDto> {
  const row = await db
    .select({ shareToken: recipes.shareToken })
    .from(recipes)
    .where(liveRecipe(householdId, id))
    .get()
  if (!row) throw notFound()
  if (row.shareToken) return shareDto(row.shareToken)
  const token = newShareToken()
  await db.update(recipes).set({ shareToken: token }).where(liveRecipe(householdId, id))
  return shareDto(token)
}

/** Zastaví zdieľanie: starý odkaz prestane fungovať, nové zdieľanie vytvorí nový. */
export async function unshareRecipe(db: Db, householdId: string, id: string): Promise<void> {
  const updated = await db
    .update(recipes)
    .set({ shareToken: null })
    .where(liveRecipe(householdId, id))
    .returning({ id: recipes.id })
  if (updated.length === 0) throw notFound()
}

async function findShared(db: Db, token: string) {
  const row = await db
    .select({ id: recipes.id, householdId: recipes.householdId, r2Key: images.r2Key })
    .from(recipes)
    .leftJoin(images, eq(images.id, recipes.coverImageId))
    .where(and(eq(recipes.shareToken, token), isNull(recipes.deletedAt)))
    .get()
  if (!row) throw notFound()
  return row
}

/** Recept podľa kódu odkazu (bez prihlásenia) – len to, čo patrí do receptu, nič o domácnosti. */
export async function getSharedRecipe(db: Db, token: string): Promise<SharedRecipeDto> {
  const found = await findShared(db, token)
  const d = await getRecipeDetail(db, found.householdId, '', found.id)
  return {
    id: d.id,
    title: d.title,
    category: d.category,
    servings: d.servings,
    prepMinutes: d.prepMinutes,
    cookMinutes: d.cookMinutes,
    difficulty: d.difficulty,
    coverImageUrl: found.r2Key ? `/api/v1/shared/${token}/cover` : null,
    description: d.description,
    sourceUrl: d.sourceUrl,
    sourceText: d.sourceText,
    ingredients: d.ingredients.map((i) => ({ ...i, inPantry: false })),
    steps: d.steps,
  }
}

/** Titulná fotka zdieľaného receptu z R2. */
export async function getSharedCover(
  db: Db,
  bucket: R2Bucket,
  token: string,
): Promise<{ body: ReadableStream; mime: string }> {
  const found = await findShared(db, token)
  if (!found.r2Key) throw notFound()
  const row = await db.select({ mime: images.mime }).from(images).where(eq(images.r2Key, found.r2Key)).get()
  const object = await bucket.get(found.r2Key)
  if (!row || !object) throw notFound()
  return { body: object.body, mime: row.mime }
}
