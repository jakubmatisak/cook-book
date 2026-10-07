import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const app = createApp()

// D1 dovolí vzor LIKE najviac 50 bajtov – dlhé názvy receptov a hľadania nesmú server zhodiť.
const LONG = 'Šťavnaté malinové rezy so sviežou krémovou plnkou a čokoládovou polevou'

const create = (title: string) =>
  send(app, 'POST', api('/recipes'), {
    title,
    servings: 12,
    ingredients: [{ name: 'Maliny', quantity: 350, unit: 'g', isOptional: false }],
  })

describe('dlhé názvy', () => {
  it('recept s dlhým názvom sa uloží, druhý s rovnakým názvom dostane adresu -2', async () => {
    const first = await create(LONG)
    expect(first.status).toBe(201)
    const second = await create(LONG)
    expect(second.status).toBe(201)
    const [a, b] = [await first.json<RecipeDetailDto>(), await second.json<RecipeDetailDto>()]
    expect(b.slug).toBe(`${a.slug}-2`)
    const third = await create(LONG)
    expect((await third.json<RecipeDetailDto>()).slug).toBe(`${a.slug}-3`)
  })

  it('hľadanie dlhým textom vo verejných receptoch nespadne', async () => {
    const res = await send(app, 'GET', api(`/public/recipes?q=${encodeURIComponent(LONG)}`))
    expect(res.status).toBe(200)
  })
})
