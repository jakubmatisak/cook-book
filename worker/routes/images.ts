import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { MAX_IMAGE_BYTES } from '../../shared/recipes'
import { images } from '../db/schema'
import type { AppEnv } from '../env'
import { HttpError } from '../errors'
import { storeImage } from '../services/images'

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
  const body = await storeImage(c.get('db'), c.env.BUCKET, c.get('user'), bytes, {
    width: dimension(form.get('width')),
    height: dimension(form.get('height')),
  })
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
