import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { images } from '../db/schema'
import { chunk } from '../http'

/** Fotku nepoužíva žiadny živý recept – ani ako titulnú, ani pri kroku (zmazané recepty sa neobnovujú). */
const unused = sql`not exists (select 1 from recipes r where r.cover_image_id = ${images.id} and r.deleted_at is null)
  and not exists (
    select 1 from recipe_steps s join recipes r on r.id = s.recipe_id
    where s.image_id = ${images.id} and r.deleted_at is null
  )`

async function removeImages(
  db: Db,
  bucket: R2Bucket,
  rows: { id: string; r2Key: string }[],
): Promise<number> {
  if (rows.length === 0) return 0
  // R2 zmaže naraz najviac 1000 kľúčov, D1 dovolí najviac 100 viazaných parametrov.
  for (const part of chunk(rows, 90)) {
    await bucket.delete(part.map((r) => r.r2Key))
    await db.delete(images).where(
      inArray(
        images.id,
        part.map((r) => r.id),
      ),
    )
  }
  return rows.length
}

/** Zmaže z databázy aj z R2 tie z uvedených fotiek, ktoré už nepoužíva žiadny recept domácnosti. */
export async function releaseImages(
  db: Db,
  bucket: R2Bucket,
  householdId: string,
  ids: readonly (string | null | undefined)[],
): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))]
  if (wanted.length === 0) return
  const rows: { id: string; r2Key: string }[] = []
  for (const part of chunk(wanted, 90)) {
    rows.push(
      ...(await db
        .select({ id: images.id, r2Key: images.r2Key })
        .from(images)
        .where(and(eq(images.householdId, householdId), inArray(images.id, part), unused))),
    )
  }
  await removeImages(db, bucket, rows)
}

/**
 * Jednorazové upratanie: zmaže nepoužívané fotky domácnosti nahraté pred `before`. Čerstvé fotky ostanú – môžu patriť
 * receptu, ktorý sa práve upravuje a ešte nebol uložený.
 */
export async function deleteOrphanImages(
  db: Db,
  bucket: R2Bucket,
  householdId: string,
  before: string,
): Promise<number> {
  const rows = await db
    .select({ id: images.id, r2Key: images.r2Key })
    .from(images)
    .where(and(eq(images.householdId, householdId), lt(images.createdAt, before), unused))
  return removeImages(db, bucket, rows)
}
