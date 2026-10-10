import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto } from '@shared/api'
import { api, send } from './helpers'
import { rowsRead } from './rowsRead'
import { A, app, as, B, createRecipe, setupHouseholds, share } from './sharingHelpers'

/** Pridá domácnosti `count` nesúvisiacich receptov priamo do databázy (rýchlo, bez API). */
async function addFiller(householdId: string, count: number, prefix: string) {
  const stmts = Array.from({ length: count }, (_, i) =>
    env.DB.prepare(
      `insert into recipes (id, household_id, title, slug, category, created_at, updated_at)
       values (?, ?, ?, ?, 'hlavne', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).bind(`${prefix}-${i}`, householdId, `${prefix} ${i}`, `${prefix}-${i}`),
  )
  await env.DB.batch(stmts)
}

async function acceptAll() {
  const offers = await (
    await send(app, 'GET', api('/sharing/incoming'), undefined, as(B))
  ).json<{ id: string }[]>()
  for (const o of offers) await send(app, 'POST', api(`/sharing/${o.id}/accept`), undefined, as(B))
}

/**
 * Bežné stránky zdieľania (Prehľad s upozorneniami, menu s odznakom, stránka Zdieľanie, detail) nesmú čítať
 * všetky recepty domácností – počet prečítaných riadkov nemá rásť s veľkosťou kuchárky.
 */
describe('prečítané riadky D1 pri zdieľaní', () => {
  it('nerastú s počtom receptov, ktoré so zdieľaním nesúvisia', async () => {
    const { aId, bId } = await setupHouseholds()
    const r1 = await createRecipe(A, 'Bábovka')
    const r2 = await createRecipe(A, 'Guláš', { tags: ['Vianoce'] })
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r1.id] })
    await share(A, { emails: [B], kind: 'tag', tagId: r2.tags[0]!.id })
    await acceptAll()
    // Kópia zdieľaného receptu u príjemcu (upozornenie na zmenu originálu).
    await send(app, 'POST', api(`/public/recipes/${r1.id}/copy`), undefined, as(B))
    // Ďalšia čakajúca ponuka.
    const r3 = await createRecipe(A, 'Rezeň')
    await share(A, { emails: [B], kind: 'recipes', recipeIds: [r3.id] })
    const copy = (
      await (await send(app, 'GET', api('/recipes'), undefined, as(B))).json<{ items: RecipeDetailDto[] }>()
    ).items[0]!

    const paths: [string, string][] = [
      ['/sharing/notices', B],
      ['/sharing/incoming', B],
      ['/sharing/outgoing', A],
      ['/recipes?shared=only', B],
      [`/public/recipes/${r1.id}`, B],
      [`/recipes/${copy.id}`, B],
      [`/recipes/${r1.id}`, A],
      ['/contacts', A],
    ]
    const measure = async () => {
      const result: Record<string, number> = {}
      for (const [path, by] of paths) {
        const { rows, status } = await rowsRead(app, path, by)
        expect(status, path).toBe(200)
        result[path] = rows
      }
      return result
    }

    await addFiller(aId, 10, 'a-small')
    await addFiller(bId, 10, 'b-small')
    const small = await measure()
    await addFiller(aId, 300, 'a-big')
    await addFiller(bId, 300, 'b-big')
    const big = await measure()

    for (const [path] of paths) {
      expect.soft(big[path]! - small[path]!, `${path}: ${small[path]} → ${big[path]} riadkov`).toBeLessThan(5)
    }
  })
})
