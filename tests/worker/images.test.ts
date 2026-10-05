import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, ImageDto, RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, call, LOCAL, PROD, send } from './helpers'

const app = createApp()

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])

function form(bytes: Uint8Array, type: string, extra: Record<string, string> = {}) {
  const data = new FormData()
  data.append('file', new File([bytes], 'fotka', { type }))
  for (const [k, v] of Object.entries(extra)) data.append(k, v)
  return data
}

async function upload(bytes = WEBP_BYTES, type = 'image/webp') {
  const res = await send(app, 'POST', api('/images'), form(bytes, type, { width: '1600', height: '1200' }))
  expect(res.status).toBe(201)
  return res.json<ImageDto>()
}

describe('fotky', () => {
  it('nahrá WebP a vráti ho späť s dlhou cache', async () => {
    const image = await upload()
    expect(image.url).toMatch(/^\/img\/default\/[0-9A-Z]{26}\.webp$/)
    const res = await call(app, `${LOCAL}${image.url}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(WEBP_BYTES)
  })

  it('typ určí podľa obsahu súboru, nie podľa deklarovaného typu', async () => {
    const image = await upload(PNG_BYTES, 'image/webp')
    expect(image.url).toMatch(/\.png$/)
  })

  it('odmietne súbor, ktorý nie je obrázok, a nič neuloží', async () => {
    const res = await send(app, 'POST', api('/images'), form(new TextEncoder().encode('<svg/>'), 'image/png'))
    expect(res.status).toBe(400)
    expect((await res.json<ApiErrorBody>()).error.code).toBe('invalid_image')
    expect((await env.BUCKET.list()).objects).toHaveLength(0)
  })

  it('odmietne príliš veľký súbor', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    big.set(WEBP_BYTES)
    const res = await send(app, 'POST', api('/images'), form(big, 'image/webp'))
    expect(res.status).toBe(413)
  })

  it('bez súboru je 400', async () => {
    const res = await send(app, 'POST', api('/images'), new FormData())
    expect(res.status).toBe(400)
  })

  it('fotka inej domácnosti je 404 a bez prihlásenia 401', async () => {
    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into images (id, household_id, r2_key, mime, bytes, created_at) values ('img-iny', 'iny', 'iny/img-iny.webp', 'image/webp', 14, 'x')",
      ),
    ])
    await env.BUCKET.put('iny/img-iny.webp', WEBP_BYTES)
    await call(app, api('/me'))
    expect((await call(app, `${LOCAL}/img/iny/img-iny.webp`)).status).toBe(404)
    expect((await call(app, `${LOCAL}/img/default/neexistuje.webp`)).status).toBe(404)
    expect((await call(app, `${PROD}/img/iny/img-iny.webp`)).status).toBe(401)
  })

  it('recept s vlastnou fotkou má jej URL, s cudzou fotkou je 400', async () => {
    const image = await upload()
    const res = await send(app, 'POST', api('/recipes'), { title: 'S fotkou', coverImageId: image.id })
    expect(res.status).toBe(201)
    expect((await res.json<RecipeDetailDto>()).coverImageUrl).toBe(image.url)

    await env.DB.batch([
      env.DB.prepare(
        "insert into households (id, name, created_at, updated_at) values ('iny', 'Iná', 'x', 'x')",
      ),
      env.DB.prepare(
        "insert into images (id, household_id, r2_key, mime, bytes, created_at) values ('img-iny', 'iny', 'iny/img-iny.webp', 'image/webp', 14, 'x')",
      ),
    ])
    const bad = await send(app, 'POST', api('/recipes'), { title: 'Cudzia fotka', coverImageId: 'img-iny' })
    expect(bad.status).toBe(400)
  })
})
