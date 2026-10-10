import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { ApiErrorBody, CreateSharesResult } from '@shared/api'
import { getDb } from '../../worker/db/client'
import { inviteMember } from '../../worker/services/memberships'
import { count } from './helpers'
import { A, B, createRecipe, rows, setupHouseholds, share } from './sharingHelpers'

describe('odoslanie ponuky zdieľania', () => {
  it('ponuka dvoch receptov na dva e-maily vytvorí dve čakajúce ponuky a uloží kontakty', async () => {
    const { aId } = await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    const r2 = await createRecipe(A, 'Guláš')
    const res = await share(A, {
      emails: [B, 'mama@example.com'],
      kind: 'recipes',
      recipeIds: [r1.id, r2.id],
      message: 'Tie z Vianoc',
    })
    expect(res.status).toBe(201)
    expect(await res.json<CreateSharesResult>()).toEqual({ sent: 2 })

    const shares = await rows<{
      to_email: string
      status: string
      message: string
      from_household_id: string
    }>('select to_email, status, message, from_household_id from recipe_shares order by to_email')
    expect(shares).toEqual([
      { to_email: 'mama@example.com', status: 'pending', message: 'Tie z Vianoc', from_household_id: aId },
      { to_email: B, status: 'pending', message: 'Tie z Vianoc', from_household_id: aId },
    ])
    expect(await count('recipe_share_items')).toBe(4)
    expect(await count('contacts')).toBe(2)
  })

  it('ďalšie recepty pre toho istého človeka sa pridajú k čakajúcej ponuke', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    const r2 = await createRecipe(A, 'Guláš')
    const r3 = await createRecipe(A, 'Rezeň')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id, r2.id] })
    expect((await share(A, { emails: [B], kind: 'recipes', recipeIds: [r2.id, r3.id] })).status).toBe(201)
    expect(await count('recipe_shares')).toBe(1)
    expect(await count('recipe_share_items')).toBe(3)
    expect(await count('contacts')).toBe(1)
  })

  it('cudzí recept alebo tag sa zdieľať nedá', async () => {
    await setupHouseholds()
    const foreign = await createRecipe(B, 'Svokrin koláč', { tags: ['Vianoce'] })
    expect((await share(A, { emails: [B], kind: 'recipes', recipeIds: [foreign.id] })).status).toBe(404)
    expect((await share(A, { emails: [B], kind: 'tag', tagId: foreign.tags[0]!.id })).status).toBe(404)
    expect(await count('recipe_shares')).toBe(0)
  })

  it('člen vlastnej domácnosti alebo vlastný e-mail sa zadať nedá', async () => {
    const { aId } = await setupHouseholds()
    await inviteMember(getDb(env), aId, 'manzel@example.com', 'member')
    const r1 = await createRecipe(A, 'Bábovka')
    for (const email of ['manzel@example.com', A]) {
      const res = await share(A, { emails: [email], kind: 'recipes', recipeIds: [r1.id] })
      expect(res.status).toBe(400)
      expect((await res.json<ApiErrorBody>()).error.code).toBe('own_household')
    }
  })

  it('odpoveď je rovnaká pre e-mail s účtom aj bez neho', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    const known = await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id] })
    const unknown = await share(A, { emails: ['nikto@example.com'], kind: 'recipes', recipeIds: [r1.id] })
    expect(known.status).toBe(unknown.status)
    expect(await known.json()).toEqual(await unknown.json())
  })

  it('150 receptov naraz neprekročí limity databázy', async () => {
    const { aId } = await setupHouseholds()
    const ids = Array.from({ length: 150 }, (_, i) => `bulk-${i}`)
    await env.DB.batch(
      ids.map((id, i) =>
        env.DB.prepare(
          `insert into recipes (id, household_id, title, slug, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
        ).bind(id, aId, `Recept ${i}`, `recept-${i}`, '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z'),
      ),
    )
    const res = await share(A, { emails: [B], kind: 'recipes', recipeIds: ids })
    expect(res.status).toBe(201)
    expect(await count('recipe_share_items')).toBe(150)
  })

  it('kategória a tag sa uložia ako ponuka celého celku, bez duplicít', async () => {
    await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka', { category: 'dezert', tags: ['Vianoce'] })
    expect((await share(A, { emails: [B], kind: 'category', category: 'dezert' })).status).toBe(201)
    expect((await share(A, { emails: [B], kind: 'tag', tagId: r1.tags[0]!.id })).status).toBe(201)
    expect((await share(A, { emails: [B], kind: 'tag', tagId: r1.tags[0]!.id })).status).toBe(201)
    const shares = await rows<{ kind: string; category: string | null; tag_id: string | null }>(
      'select kind, category, tag_id from recipe_shares order by kind',
    )
    expect(shares).toEqual([
      { kind: 'category', category: 'dezert', tag_id: null },
      { kind: 'tag', category: null, tag_id: r1.tags[0]!.id },
    ])
  })
})
