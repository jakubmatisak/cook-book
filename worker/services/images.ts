import type { ImageDto } from '../../shared/api'
import { newId } from '../../shared/ids'
import type { Db } from '../db/client'
import { images } from '../db/schema'
import type { UserRow } from '../env'
import { HttpError } from '../errors'
import { imageUrl } from './recipes'

type ImageKind = { mime: 'image/webp' | 'image/jpeg' | 'image/png'; ext: string }

/** Typ obrázka podľa obsahu (magic bytes), deklarovanému typu klienta neveríme. */
export function detectImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number) => bytes[i]
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47)
    return { mime: 'image/png', ext: 'png' }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return { mime: 'image/webp', ext: 'webp' }
  return null
}

/** Uloží fotku do R2 a zapíše ju do databázy; pri chybe databázy objekt z R2 zmaže. */
export async function storeImage(
  db: Db,
  bucket: R2Bucket,
  user: Pick<UserRow, 'id' | 'householdId'>,
  bytes: Uint8Array,
  size: { width: number | null; height: number | null } = { width: null, height: null },
): Promise<ImageDto> {
  const kind = detectImage(bytes)
  if (!kind) throw new HttpError(400, 'invalid_image', 'Súbor nie je fotka vo formáte WebP, JPEG ani PNG.')

  const id = newId()
  const r2Key = `${user.householdId}/${id}.${kind.ext}`
  await bucket.put(r2Key, bytes, { httpMetadata: { contentType: kind.mime } })
  try {
    await db.insert(images).values({
      id,
      householdId: user.householdId,
      r2Key,
      mime: kind.mime,
      bytes: bytes.byteLength,
      width: size.width,
      height: size.height,
      createdBy: user.id,
    })
  } catch (error) {
    await bucket.delete(r2Key)
    throw error
  }
  return { id, url: imageUrl(r2Key) }
}
