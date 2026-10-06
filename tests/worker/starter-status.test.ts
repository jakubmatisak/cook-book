import { describe, expect, it } from 'vitest'
import type { IngredientDto, StarterStatusDto } from '@shared/api'
import { STARTER_INGREDIENTS } from '@shared/data/starterIngredients'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()
const status = async () => {
  const res = await send(app, 'GET', api('/ingredients/starter'))
  expect(res.status).toBe(200)
  return res.json<StarterStatusDto>()
}
const total = STARTER_INGREDIENTS.length

describe('GET /ingredients/starter (koľko základných surovín chýba)', () => {
  it('v prázdnej domácnosti chýbajú všetky', async () => {
    expect(await status()).toEqual({ total, missing: total })
  })

  it('po pridaní základných surovín nechýba žiadna', async () => {
    await send(app, 'POST', api('/ingredients/starter'))
    expect(await status()).toEqual({ total, missing: 0 })
  })

  it('suroviny s rovnakým názvom (aj bez diakritiky) sa nerátajú ako chýbajúce', async () => {
    await send(app, 'POST', api('/ingredients'), { name: 'zemiaky' })
    await send(app, 'POST', api('/ingredients'), { name: 'Cibula' })
    expect(await status()).toEqual({ total, missing: total - 2 })
  })

  it('zmazaná základná surovina sa nepovažuje za chýbajúcu (pridanie by ju aj tak preskočilo)', async () => {
    await send(app, 'POST', api('/ingredients/starter'))
    const zemiaky = (await (await send(app, 'GET', api('/ingredients'))).json<IngredientDto[]>()).find(
      (i) => i.name === 'Zemiaky',
    )!
    expect((await send(app, 'DELETE', api(`/ingredients/${zemiaky.id}`))).status).toBe(204)
    expect(await status()).toEqual({ total, missing: 0 })
    const again = await (await send(app, 'POST', api('/ingredients/starter'))).json<{ added: number }>()
    expect(again.added).toBe(0)
  })
})
