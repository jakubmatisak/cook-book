import { describe, expect, it } from 'vitest'
import type { ImportRecipeResultDto } from '@shared/api'
import { createApp } from '../../worker/app'
import { api, send } from './helpers'

const page = (body: string, head = '') =>
  `<!doctype html><html><head><title>x</title>${head}</head><body>${body}</body></html>`
const ldScript = (json: string) => `<script type="application/ld+json">${json}</script>`
const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })

function importFrom(url: string, body: string) {
  const fn: typeof fetch = async (input) => {
    const href = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      .href
    return href === url ? html(body).clone() : new Response('nenájdené', { status: 404 })
  }
  return send(createApp({ fetchFn: fn }), 'POST', api('/recipes/import'), { url }).then((res) =>
    res.json<ImportRecipeResultDto>(),
  )
}

const shape = (body: ImportRecipeResultDto) =>
  body.recipe.ingredients?.map((i) => [i.groupName ?? null, i.quantity, i.unit, i.name])

describe('import z ďalších slovenských webov', () => {
  it('recepty.aktuality.sk / dobruchut: skupiny z .ingredients-title a opravené množstvo 0 z HTML', async () => {
    const ld = {
      '@type': 'Recipe',
      name: 'Jablkové žerbó rezy: Fantastické!',
      recipeYield: '30 porcií',
      keywords: '9SRXqBzIWSB_VO4XyyiY, MTi1AXDw9mNpYIhH0_dK',
      recipeIngredient: ['0 kocky čerstvé droždie', '150 ml mlieko', '700 g jablká', '1 KL olej'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Cesto: zohrejeme mlieko.' }],
    }
    const item = (count: string, name: string) =>
      `<li class="ingredient-item"><div class="count"> ${count} </div><div class="name">${name}</div></li>`
    const body = page(
      `<div class="recipe-ingredients-wrapper"><h2>Ingrediencie</h2>
        <div class="ingredients-title tc">Cesto:</div><ul class="ingredients-list">${item('0.5 kocky', 'čerstvé droždie')}${item('150 ml', 'mlieko')}</ul>
        <div class="ingredients-title tc">Plnka:</div><ul class="ingredients-list">${item('700 g', 'jablká')}${item('1 KL', 'olej')}</ul></div>`,
      ldScript(JSON.stringify(ld)),
    )
    const result = await importFrom('https://recepty.example.sk/recept/1/', body)
    expect(result.recipe.title).toBe('Jablkové žerbó rezy')
    expect(result.recipe.category).toBe('dezert')
    expect(result.recipe.tags).toEqual(['Z internetu'])
    expect(shape(result)).toEqual([
      ['Cesto', 0.5, 'ks', 'čerstvé droždie'],
      ['Cesto', 150, 'ml', 'mlieko'],
      ['Plnka', 700, 'g', 'jablká'],
      ['Plnka', 1, 'ČL', 'olej'],
    ])
  })

  it('dobruchut.aktuality.sk (starší vzhľad): skupiny z h3 v .substances-list, riadky .item', async () => {
    const ld = {
      '@type': 'Recipe',
      name: 'Grófkin koláč či barónkine rezy',
      recipeIngredient: [
        '450 g polohrubej múky',
        ' trochu citrónovej kôry',
        '7 ks jabĺk',
        ' čokoládová poleva',
      ],
    }
    const item = (amount: string, title: string) =>
      `<div class="item"><div class="wrap"><div class="amount">
        ${amount}  </div><div class="title">${title}</div><div class="tiny-clear"></div></div></div>`
    const body = page(
      `<div class="substances-list side-section"><h2 class="title-red">ingrediencie</h2>
        <h3 class="title-red-small">Cesto</h3>${item('450\n g', 'polohrubej múky')}${item('trochu', 'citrónovej kôry')}
        <h3 class="title-red-small">Plnka</h3>${item('7\n ks', 'jabĺk')}${item('', 'čokoládová poleva')}</div>`,
      ldScript(JSON.stringify(ld)),
    )
    const result = await importFrom('https://dobruchut.example.sk/recept/74623/grofkin-kolac/', body)
    expect(shape(result)?.map(([group, , , name]) => [group, name])).toEqual([
      ['Cesto', 'polohrubej múky'],
      ['Cesto', 'trochu citrónovej kôry'],
      ['Plnka', 'jabĺk'],
      ['Plnka', 'čokoládová poleva'],
    ])
  })

  it('najrecept.topky.sk: skupiny z h3 v .key-value (riadky sú dvojice .key a .value)', async () => {
    const ld = {
      '@type': 'Recipe',
      name: 'Slivkový koláč',
      recipeCategory: ['Koláče', 'Dezerty'],
      recipeIngredient: ['620 g hladká múka', '160 g cukor', '1 kg polotučný tvaroh', '2 ks vajce'],
    }
    const body = page(
      `<div class="ingredients"><div class="title">Suroviny</div><div class="key-value">
        <h3>Kysnuté cesto:</h3><div class="key">620 g</div><div class="value">hladká múka</div><div class="key">160 g</div><div class="value">cukor</div>
        <h3>Tvarohová plnka:</h3><div class="key">1 kg</div><div class="value">polotučný tvaroh</div><div class="key">2 ks</div><div class="value">vajce</div></div></div>`,
      ldScript(JSON.stringify(ld)),
    )
    const result = await importFrom('https://najrecept.example.sk/recept/r1', body)
    expect(shape(result)).toEqual([
      ['Kysnuté cesto', 620, 'g', 'hladká múka'],
      ['Kysnuté cesto', 160, 'g', 'cukor'],
      ['Tvarohová plnka', 1, 'kg', 'polotučný tvaroh'],
      ['Tvarohová plnka', 2, 'ks', 'vajce'],
    ])
  })

  it('kuchynalidla.sk: pokazený JSON-LD a ingrediencie so skupinami z HTML (.ing)', async () => {
    // Surové nové riadky v reťazci robia z JSON-LD neplatný JSON; ingrediencie sú zlepené do jedného reťazca.
    const brokenLd = `{"@type": "Recipe", "name": "Pliecko s knedľou", "recipeYield": "5 porcií",
      "recipeIngredient": "Suroviny<br><br>Mäso2 cibule1 kg pliecka<br>Knedľa100 ml vody",
      "recipeInstructions": "Cibuľu osmažíme.
Pridáme mäso."}`
    const body = page(
      `<div class="ing"><h2 dir="ltr">Suroviny<br><br></h2><h2 dir="ltr">Mäso</h2><ul><li dir="ltr">2 cibule</li><li dir="ltr">1 kg bravčového pliecka</li></ul><p dir="ltr"><br></p>
        <h2 dir="ltr">Knedľa</h2><ul><li dir="ltr">100 ml vody</li><li dir="ltr">20 g čerstvého droždia</li></ul><p dir="ltr"><br></p>
        <h2 dir="ltr">Ešte budeme potrebovať</h2><p dir="ltr">20 g múky Belbake na pomúčenie dosky</p> <button>Poslať</button></div>`,
      ldScript(brokenLd),
    )
    const result = await importFrom('https://kuchynalidla.example.sk/recepty/pliecko', body)
    expect(result.recipe.title).toBe('Pliecko s knedľou')
    expect(result.recipe.servings).toBe(5)
    expect(shape(result)).toEqual([
      ['Mäso', 2, null, 'cibule'],
      ['Mäso', 1, 'kg', 'bravčového pliecka'],
      ['Knedľa', 100, 'ml', 'vody'],
      ['Knedľa', 20, 'g', 'čerstvého droždia'],
      ['Ešte budeme potrebovať', 20, 'g', 'múky Belbake na pomúčenie dosky'],
    ])
    expect(result.recipe.steps?.map((s) => s.text)).toEqual(['Cibuľu osmažíme.', 'Pridáme mäso.'])
  })

  it('kuchynalidla.sk: jednoduchý recept s ingredienciami po riadkoch v pokazenom JSON-LD (bez skupín)', async () => {
    const brokenLd = `{"@type": "Recipe", "name": "Hovädzí guláš",
      "recipeIngredient": "
\t800 g hov&auml;dzieho zadn&eacute;ho
\t400 g cibule
"}`
    const body = page(
      `<div class="ing"><ul><li>800 g hov&auml;dzieho zadn&eacute;ho</li><li>400 g cibule</li></ul></div>`,
      ldScript(brokenLd),
    )
    const result = await importFrom('https://kuchynalidla.example.sk/recepty/gulas', body)
    expect(shape(result)).toEqual([
      [null, 800, 'g', 'hovädzieho zadného'],
      [null, 400, 'g', 'cibule'],
    ])
  })
})
