import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { ImageDto } from '../../shared/api'
import { newId } from '../../shared/ids'
import { MAX_IMAGE_BYTES } from '../../shared/recipes'
import { images } from '../db/schema'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { imageUrl } from '../services/recipes'

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

const dimension = (value: unknown) => {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null
}

/** POST /api/v1/images – multipart pole `file` (+ voliteľne `width`, `height`). */
export const imageUploadRoutes = new Hono<AppEnv>().post('/', async (c) => {
  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > MAX_IMAGE_BYTES + 64 * 1024)
    throw new HttpError(413, 'too_large', 'Fotka je príliš veľká (max 5 MB).')

  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    throw new HttpError(400, 'invalid_form', 'Očakávaný formulár s fotkou.')
  }
  const file = form.get('file')
  if (!(file instanceof File)) throw new HttpError(400, 'missing_file', 'Chýba súbor s fotkou.')
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'too_large', 'Fotka je príliš veľká (max 5 MB).')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = detectImage(bytes)
  if (!kind) throw new HttpError(400, 'invalid_image', 'Súbor nie je fotka vo formáte WebP, JPEG ani PNG.')

  const user = c.get('user')
  const id = newId()
  const r2Key = `${user.householdId}/${id}.${kind.ext}`
  await c.env.BUCKET.put(r2Key, bytes, { httpMetadata: { contentType: kind.mime } })
  try {
    await c
      .get('db')
      .insert(images)
      .values({
        id,
        householdId: user.householdId,
        r2Key,
        mime: kind.mime,
        bytes: bytes.byteLength,
        width: dimension(form.get('width')),
        height: dimension(form.get('height')),
        createdBy: user.id,
      })
  } catch (error) {
    await c.env.BUCKET.delete(r2Key)
    throw error
  }
  const body: ImageDto = { id, url: imageUrl(r2Key) }
  return c.json(body, 201)
})

/** GET /img/:householdId/:file – fotka z R2, len pre vlastnú domácnosť. */
export const imageServeRoutes = new Hono<AppEnv>().get('/:householdId/:file', async (c) => {
  const user = c.get('user')
  const { householdId, file } = c.req.param()
  if (householdId !== user.householdId) throw new HttpError(404, 'not_found', 'Fotka neexistuje.')

  const r2Key = `${householdId}/${file}`
  const row = await c
    .get('db')
    .select({ mime: images.mime })
    .from(images)
    .where(and(eq(images.r2Key, r2Key), eq(images.householdId, householdId)))
    .get()
  const object = row ? await c.env.BUCKET.get(r2Key) : null
  if (!row || !object) throw new HttpError(404, 'not_found', 'Fotka neexistuje.')

  return new Response(object.body, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      ETag: object.httpEtag,
    },
  })
})
