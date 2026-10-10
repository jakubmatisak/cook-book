import { env } from 'cloudflare:workers'
import { expect } from 'vitest'
import type { RecipeDetailDto } from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import { createApp } from '../../worker/app'
import { getDb } from '../../worker/db/client'
import { createHousehold, ensureUser } from '../../worker/services/household'
import { inviteMember } from '../../worker/services/memberships'
import { api, send } from './helpers'

export const app = createApp()
/** Vlastník domácnosti A (dev používateľ). */
export const A = 'ja@example.com'
/** Svokra: vlastníčka domácnosti B. */
export const B = 'svokra@example.com'
/** Niekto tretí s vlastnou domácnosťou C. */
export const C = 'cudzi@example.com'
export const as = (email: string) => ({ as: email })

export async function setupHouseholds() {
  const db = getDb(env)
  const a = await ensureUser(db, A)
  const bId = await createHousehold(db, 'Svokrovci')
  await inviteMember(db, bId, B, 'owner')
  const cId = await createHousehold(db, 'Cudzí')
  await inviteMember(db, cId, C, 'owner')
  return { aId: a.householdId, bId, cId }
}

export async function createRecipe(
  by: string,
  title: string,
  extra: { category?: RecipeCategory; tags?: string[] } = {},
): Promise<RecipeDetailDto> {
  const res = await send(
    app,
    'POST',
    api('/recipes'),
    {
      title,
      servings: 4,
      category: extra.category ?? 'hlavne',
      ingredients: [{ name: 'Múka', quantity: 300, unit: 'g' }],
      steps: [{ text: 'Uvar.' }],
      tags: extra.tags ?? [],
    },
    as(by),
  )
  expect(res.status).toBe(201)
  return res.json<RecipeDetailDto>()
}

export const share = (by: string, body: unknown) => send(app, 'POST', api('/sharing'), body, as(by))

export async function rows<T>(query: string, ...binds: unknown[]): Promise<T[]> {
  return (
    await env.DB.prepare(query)
      .bind(...binds)
      .all<T>()
  ).results
}
