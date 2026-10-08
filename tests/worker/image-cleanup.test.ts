import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ImageDto, RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, count, send } from './helpers'

const app = createApp()

const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])

async function upload(): Promise<ImageDto> {
  const data = new FormData()
  data.append('file', new File([WEBP_BYTES], 'fotka', { type: 'image/webp' }))
  const res = await send(app, 'POST', api('/images'), data)
  expect(res.status).toBe(201)
  return res.json<ImageDto>()
}

const createRecipe = async (title: string, coverImageId: string | null) =>
  (await send(app, 'POST', api('/recipes'), { title, coverImageId })).json<RecipeDetailDto>()

const keys = async () => (await env.BUCKET.list()).objects.map((o) => o.key)
const keyOf = (image: ImageDto) => image.url.replace(/^\/img\//, '')

describe('mazanie nepoužívaných fotiek', () => {
  it('po výmene titulnej fotky sa stará zmaže z databázy aj z úložiska', async () => {
    const old = await upload()
    const recipe = await createRecipe('Guláš', old.id)
    const fresh = await upload()

    const res = await send(app, 'PUT', api(`/recipes/${recipe.id}`), {
      title: 'Guláš',
      coverImageId: fresh.id,
    })
    expect(res.status).toBe(200)

    expect(await keys()).toEqual([keyOf(fresh)])
    expect(await count('images')).toBe(1)
  })

  it('zmazanie receptu zmaže aj jeho fotku, rovnako hromadné zmazanie', async () => {
    const a = await createRecipe('A', (await upload()).id)
    const b = await createRecipe('B', (await upload()).id)
    const c = await createRecipe('C', (await upload()).id)

    expect((await send(app, 'DELETE', api(`/recipes/${a.id}`))).status).toBe(204)
    expect(await count('images')).toBe(2)

    expect((await send(app, 'POST', api('/recipes/bulk/delete'), { ids: [b.id, c.id] })).status).toBe(200)
    expect(await count('images')).toBe(0)
    expect(await keys()).toEqual([])
  })

  it('fotku, ktorú používa iný recept, nechá', async () => {
    const shared = await upload()
    const a = await createRecipe('A', shared.id)
    await createRecipe('B', shared.id)

    await send(app, 'DELETE', api(`/recipes/${a.id}`))
    expect(await keys()).toEqual([keyOf(shared)])
  })

  it('jednorazové čistenie zmaže staré nepoužívané fotky, čerstvo nahraté a použité nechá', async () => {
    const orphan = await upload()
    const fresh = await upload()
    const used = await upload()
    await createRecipe('S fotkou', used.id)
    await env.DB.prepare("update images set created_at = '2026-01-01T00:00:00.000Z' where id in (?, ?)")
      .bind(orphan.id, used.id)
      .run()

    const res = await send(app, 'POST', api('/images/cleanup'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 1 })
    expect((await keys()).sort()).toEqual([keyOf(fresh), keyOf(used)].sort())
  })
})
