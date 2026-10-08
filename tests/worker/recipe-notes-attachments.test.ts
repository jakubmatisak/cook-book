import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type {
  ImageDto,
  PublicRecipeDetailDto,
  RecipeDetailDto,
  RecipeShareDto,
  SharedRecipeDto,
} from '@shared/api'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, call, PROD, send } from './helpers'

const app = createApp()

const WEBP_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9, 9])

async function upload(): Promise<ImageDto> {
  const data = new FormData()
  data.append('file', new File([WEBP_BYTES], 'strana', { type: 'image/webp' }))
  data.append('width', '1200')
  data.append('height', '1600')
  return (await send(app, 'POST', api('/images'), data)).json<ImageDto>()
}

const save = async (body: object, id?: string) => {
  const res = await send(app, id ? 'PUT' : 'POST', api(id ? `/recipes/${id}` : '/recipes'), body)
  return { status: res.status, recipe: await res.json<RecipeDetailDto>() }
}

const keys = async () => (await env.BUCKET.list()).objects.map((o) => o.key).sort()
const keyOf = (image: ImageDto) => image.url.replace(/^\/img\//, '')

describe('poznámky receptu', () => {
  it('uloží sa a vráti s receptom, dá sa zmeniť aj vymazať', async () => {
    const notes = 'Množstvo vody je odhad.\n\nPôvodný zápis: Preosiatu múku dáme osušiť…'
    const { recipe } = await save({ title: 'Krémeš', notes })
    expect(recipe.notes).toBe(notes)

    const changed = await save({ title: 'Krémeš', notes: 'Iná poznámka' }, recipe.id)
    expect(changed.recipe.notes).toBe('Iná poznámka')
    expect((await save({ title: 'Krémeš', notes: '  ' }, recipe.id)).recipe.notes).toBeNull()
  })
})

describe('prílohy receptu', () => {
  it('uloží prílohy v zadanom poradí a vráti ich s adresou a rozmermi', async () => {
    const a = await upload()
    const b = await upload()
    const { status, recipe } = await save({ title: 'Krémeš', attachmentIds: [b.id, a.id] })
    expect(status).toBe(201)
    expect(recipe.attachments).toEqual([
      { id: b.id, url: b.url, width: 1200, height: 1600 },
      { id: a.id, url: a.url, width: 1200, height: 1600 },
    ])
  })

  it('odobratá príloha sa zmaže z úložiska, ostatné ostanú', async () => {
    const a = await upload()
    const b = await upload()
    const { recipe } = await save({ title: 'Krémeš', attachmentIds: [a.id, b.id] })

    const { recipe: updated } = await save({ title: 'Krémeš', attachmentIds: [b.id] }, recipe.id)
    expect(updated.attachments?.map((x) => x.id)).toEqual([b.id])
    expect(await keys()).toEqual([keyOf(b)])
  })

  it('zmazanie receptu zmaže aj prílohy; upratanie používané prílohy nechá', async () => {
    const kept = await upload()
    await save({ title: 'Ostane', attachmentIds: [kept.id] })
    await env.DB.prepare("update images set created_at = '2026-01-01T00:00:00.000Z'").run()
    expect(
      (await (await send(app, 'POST', api('/images/cleanup'))).json<{ deleted: number }>()).deleted,
    ).toBe(0)

    const gone = await upload()
    const { recipe } = await save({ title: 'Zmizne', attachmentIds: [gone.id] })
    await send(app, 'DELETE', api(`/recipes/${recipe.id}`))
    expect(await keys()).toEqual([keyOf(kept)])
  })

  it('fotka, ktorá neexistuje, je 400 a recept sa neuloží', async () => {
    const res = await send(app, 'POST', api('/recipes'), { title: 'X', attachmentIds: ['neexistuje'] })
    expect(res.status).toBe(400)
  })
})

describe('uloženie zo staršej verzie aplikácie', () => {
  it('bez polí notes a attachmentIds nechá poznámky aj prílohy tak, ako boli', async () => {
    const photo = await upload()
    const { recipe } = await save({ title: 'Krémeš', notes: 'Prepis', attachmentIds: [photo.id] })
    const { recipe: again } = await save({ title: 'Krémeš (upravený)' }, recipe.id)
    expect(again.notes).toBe('Prepis')
    expect(again.attachments?.map((a) => a.id)).toEqual([photo.id])
    expect(await keys()).toEqual([keyOf(photo)])
  })
})

describe('poznámky a prílohy mimo vlastnej domácnosti', () => {
  it('odkaz na zdieľanie ukáže poznámky, ale nie prílohy', async () => {
    const photo = await upload()
    const { recipe } = await save({ title: 'Krémeš', notes: 'Prepis', attachmentIds: [photo.id] })
    const { token } = await (
      await send(app, 'POST', api(`/recipes/${recipe.id}/share`))
    ).json<RecipeShareDto>()
    const shared = await (await call(app, `${PROD}/api/v1/shared/${token}`)).json<SharedRecipeDto>()
    expect(shared.notes).toBe('Prepis')
    expect(shared).not.toHaveProperty('attachments')
  })

  it('verejný recept iná domácnosť vidí s poznámkami bez príloh; kópia si vezme poznámky', async () => {
    await ensureUser(getDb(env), 'ja@example.com')
    const other = await createHousehold(getDb(env), 'Rodičia')
    await inviteMember(getDb(env), other, 'manzelka@example.com', 'owner')
    const photo = await upload()
    const { recipe } = await save({ title: 'Krémeš', notes: 'Prepis', attachmentIds: [photo.id] })
    await send(app, 'PUT', api(`/recipes/${recipe.id}/visibility`), { visibility: 'public' })

    const as = { as: 'manzelka@example.com' }
    const seen = await (
      await send(app, 'GET', api(`/public/recipes/${recipe.id}`), undefined, as)
    ).json<PublicRecipeDetailDto>()
    expect(seen.notes).toBe('Prepis')
    expect(seen.attachments).toEqual([])

    const copy = await (
      await send(app, 'POST', api(`/public/recipes/${recipe.id}/copy`), undefined, as)
    ).json<RecipeDetailDto>()
    expect(copy.notes).toBe('Prepis')
    expect(copy.attachments).toEqual([])
  })
})
