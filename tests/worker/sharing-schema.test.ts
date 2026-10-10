import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const columns = async (table: string) =>
  (await env.DB.prepare(`pragma table_info(${table})`).all<{ name: string }>()).results.map((c) => c.name)

describe('dáta zdieľania', () => {
  it('existujú tabuľky kontaktov, ponúk a ich receptov', async () => {
    expect(await columns('contacts')).toEqual(expect.arrayContaining(['id', 'household_id', 'email', 'name']))
    expect(await columns('recipe_shares')).toEqual(
      expect.arrayContaining([
        'id',
        'from_household_id',
        'from_user_id',
        'to_email',
        'to_household_id',
        'kind',
        'category',
        'tag_id',
        'message',
        'status',
        'responded_at',
        'seen_at',
      ]),
    )
    expect(await columns('recipe_share_items')).toEqual(['share_id', 'recipe_id'])
  })

  it('recept si pamätá, od koho je kópia a kedy sa naposledy zhodoval s originálom', async () => {
    expect(await columns('recipes')).toEqual(
      expect.arrayContaining(['copied_from_name', 'copied_source_updated_at']),
    )
  })
})
