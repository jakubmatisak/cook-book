import { describe, expect, it } from 'vitest'
import {
  cleanRecipeTitle,
  extractRecipe,
  parseIngredientLine,
  parseJsonLenient,
  type ImportSources,
  type IngredientMark,
} from '@shared/import/schemaOrg'
import { unitFromText } from '@shared/units'

const sources = (jsonLd: unknown[], extra: Partial<ImportSources> = {}): ImportSources => ({
  jsonLd: jsonLd.map((j) => (typeof j === 'string' ? j : JSON.stringify(j))),
  meta: {},
  microdata: [],
  sourceUrl: 'https://example.com/recept',
  ...extra,
})
const group = (text: string): IngredientMark => ({ kind: 'group', text })
const row = (text?: string): IngredientMark => (text === undefined ? { kind: 'row' } : { kind: 'row', text })

describe('parseJsonLenient (pokazený JSON-LD)', () => {
  it('platný JSON vráti bez zmeny', () => {
    expect(parseJsonLenient('{"a": "b\\nc"}')).toEqual({ a: 'b\nc' })
  })

  it('surové nové riadky a tabulátory v reťazci opraví na \\n', () => {
    const raw = '{"@type": "Recipe", "recipeIngredient": "\n\t800 g mäsa\n\t400 g cibule\n"}'
    expect(parseJsonLenient(raw)).toEqual({
      '@type': 'Recipe',
      recipeIngredient: '\n\t800 g mäsa\n\t400 g cibule\n',
    })
  })

  it('nezachrániteľný text je null', () => {
    expect(parseJsonLenient('{"a": ')).toBeNull()
    expect(parseJsonLenient('')).toBeNull()
  })
})

describe('kuchynalidla.sk – JSON-LD s ingredienciami v jednom reťazci', () => {
  it('pokazený JSON-LD s ingredienciami po riadkoch sa načíta a rozdelí na ingrediencie', () => {
    const raw = `{"@context": "https://schema.org", "@type": "Recipe", "name": "Hovädzí guláš",
      "recipeIngredient": "
\t800 g hov&auml;dzieho zadn&eacute;ho
\t400 g cibule
\tsoľ s&nbsp;j&oacute;dom Belbake
", "recipeYield": "6 porcií"}`
    const result = extractRecipe(sources([raw]))
    expect(result?.recipe.title).toBe('Hovädzí guláš')
    expect(result?.recipe.ingredients?.map((i) => [i.quantity, i.unit, i.name])).toEqual([
      [800, 'g', 'hovädzieho zadného'],
      [400, 'g', 'cibule'],
      [null, null, 'soľ s jódom Belbake'],
    ])
  })

  it('zlepený reťazec ingrediencií sa nahradí riadkami z HTML a skupinami (Mäso, Knedľa…)', () => {
    const ld = {
      '@type': 'Recipe',
      name: 'Pliecko',
      recipeIngredient: 'Suroviny<br><br>Mäso2 cibule1 kg pliecka<br>Knedľa100 ml vody250 ml mlieka',
    }
    const marks = [
      group('Suroviny'),
      group('Mäso'),
      row('2 cibule'),
      row('1 kg pliecka'),
      row(''),
      group('Knedľa'),
      row('100 ml vody'),
      row('250 ml plnotučného mlieka Pilos'),
    ]
    const result = extractRecipe(sources([ld], { ingredientMarks: marks }))
    expect(result?.recipe.ingredients?.map((i) => [i.groupName ?? null, i.quantity, i.unit, i.name])).toEqual(
      [
        ['Mäso', 2, null, 'cibule'],
        ['Mäso', 1, 'kg', 'pliecka'],
        ['Knedľa', 100, 'ml', 'vody'],
        ['Knedľa', 250, 'ml', 'plnotučného mlieka Pilos'],
      ],
    )
  })

  it('riadky z HTML sa používajú len keď sedia s JSON-LD alebo JSON-LD ingrediencie nedáva zmysel', () => {
    const ld = { '@type': 'Recipe', name: 'X', recipeIngredient: ['1 kg múky', '2 vajcia'] }
    const result = extractRecipe(
      sources([ld], { ingredientMarks: [group('Cesto'), row('1 kg múky'), row('2 vajcia')] }),
    )
    expect(result?.recipe.ingredients?.map((i) => [i.groupName, i.name])).toEqual([
      ['Cesto', 'múky'],
      ['Cesto', 'vajcia'],
    ])
  })
})

describe('aktuality.sk / dobruchut.sk – množstvo 0 a jednotky', () => {
  it('„0 kocky droždia“ v JSON-LD sa opraví podľa riadku z HTML („0.5 kocky“)', () => {
    const ld = {
      '@type': 'Recipe',
      name: 'Rezy',
      recipeIngredient: ['0 kocky čerstvé droždie', '150 ml mlieko'],
    }
    const marks = [group('Cesto:'), row('0.5 kocky čerstvé droždie'), row('150 ml mlieko')]
    const result = extractRecipe(sources([ld], { ingredientMarks: marks }))
    expect(result?.recipe.ingredients?.[0]).toMatchObject({
      quantity: 0.5,
      unit: 'ks',
      name: 'čerstvé droždie',
      groupName: 'Cesto',
    })
  })

  it('nulové množstvo bez HTML sa berie ako neznáme, nie ako súčasť názvu', () => {
    expect(parseIngredientLine('0 kocky čerstvé droždie')).toMatchObject({
      name: 'čerstvé droždie',
      quantity: null,
      unit: null,
    })
    expect(parseIngredientLine('0 g soľ')).toMatchObject({ name: 'soľ', quantity: null })
  })

  it('KL je kávová lyžička (čajová) a kocka je kus', () => {
    expect(unitFromText('KL')).toBe('ČL')
    expect(unitFromText('kocky')).toBe('ks')
    expect(parseIngredientLine('1 KL kryštálový cukor')).toMatchObject({
      quantity: 1,
      unit: 'ČL',
      name: 'kryštálový cukor',
    })
  })

  it('počet porcií 0 je neznámy', () => {
    const result = extractRecipe(
      sources([{ '@type': 'Recipe', name: 'X', recipeYield: '0 porcií', recipeIngredient: ['1 vajce'] }]),
    )
    expect(result?.recipe.servings).toBe(4)
    expect(result?.warnings).toContain('Počet porcií sa nenašiel, nastavili sme 4.')
  })
})

describe('typ jedla bez recipeCategory', () => {
  const type = (name: string, extra: Record<string, unknown> = {}, crumbs?: string[]) =>
    extractRecipe(
      sources([
        { '@type': 'Recipe', name, recipeIngredient: ['1 vajce'], ...extra },
        ...(crumbs
          ? [
              {
                '@type': 'BreadcrumbList',
                itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c })),
              },
            ]
          : []),
      ]),
    )?.recipe.category

  it('z názvu: koláče, rezy, torty a zákusky sú dezerty', () => {
    expect(type('Jablkové žerbó rezy: Fantastické!')).toBe('dezert')
    expect(type('Tradičný jablkový koláč so snehovou perinkou')).toBe('dezert')
    expect(type('Čokoládová torta')).toBe('dezert')
    expect(type('Nepečený nugátový cheesecake')).toBe('dezert')
  })

  it('z názvu: polievka a šalát', () => {
    expect(type('Zeleninová polievka s cestovinou')).toBe('polievka')
    expect(type('Cestovinový šalát')).toBe('salat')
  })

  it('rezeň nie je rez a bežné jedlo ostáva hlavné', () => {
    expect(type('Bravčový rezeň')).toBe('hlavne')
    expect(type('Hovädzí guláš')).toBe('hlavne')
  })

  it('z omrviniek (BreadcrumbList), ak nič iné nepovie', () => {
    expect(type('Nugátová pochúťka', {}, ['Domov', 'Recepty', 'Dezerty', 'Nugátová pochúťka'])).toBe('dezert')
  })

  it('recipeCategory má prednosť pred názvom', () => {
    expect(type('Jablkový koláč', { recipeCategory: 'Hlavné jedlá ' })).toBe('hlavne')
    expect(type('Cestovinový šalát', { recipeCategory: ['Koláče', 'Dezerty'] })).toBe('dezert')
  })
})

describe('tagy z kľúčových slov', () => {
  it('náhodné identifikátory (9SRXqBzIWSB_VO4XyyiY) sa zahodia, skutočné slová ostanú', () => {
    const ld = {
      '@type': 'Recipe',
      name: 'X',
      recipeIngredient: ['1 vajce'],
      keywords: '9SRXqBzIWSB_VO4XyyiY, MTi1AXDw9mNpYIhH0_dK, rýchle, bezlepkové',
    }
    expect(extractRecipe(sources([ld]))?.recipe.tags).toEqual(['rýchle', 'bezlepkové'])
  })
})

describe('názov receptu a čísla krokov', () => {
  it('reklamný dovetok za dvojbodkou sa odreže', () => {
    expect(cleanRecipeTitle('Jablkové žerbó rezy: Fantastické! ')).toBe('Jablkové žerbó rezy')
    expect(
      cleanRecipeTitle(
        'Tradičný jablkový koláč so snehovou perinkou: Neskutočne nadýchaný a šťavnatý zákusok',
      ),
    ).toBe('Tradičný jablkový koláč so snehovou perinkou')
  })

  it('bežný názov a krátka hlavička ostanú', () => {
    expect(cleanRecipeTitle('Hovädzí guláš')).toBe('Hovädzí guláš')
    expect(cleanRecipeTitle('Bravčový guláš (videorecept)')).toBe('Bravčový guláš (videorecept)')
    expect(cleanRecipeTitle('Recept: Guláš')).toBe('Recept: Guláš')
  })

  it('extractRecipe používa vyčistený názov', () => {
    const ld = { '@type': 'Recipe', name: 'Jablkové žerbó rezy: Fantastické!', recipeIngredient: ['1 vajce'] }
    expect(extractRecipe(sources([ld]))?.recipe.title).toBe('Jablkové žerbó rezy')
  })

  it('číslovanie krokov („1:“, „2.“) sa odstráni, text začínajúci číslom ostane', () => {
    const ld = {
      '@type': 'Recipe',
      name: 'X',
      recipeIngredient: ['1 vajce'],
      recipeInstructions: [' 1: Žĺtky vyšľaháme.', '2. Pridáme maslo.', '3 vajcia vmiešame.'],
    }
    expect(extractRecipe(sources([ld]))?.recipe.steps?.map((s) => s.text)).toEqual([
      'Žĺtky vyšľaháme.',
      'Pridáme maslo.',
      '3 vajcia vmiešame.',
    ])
  })

  it('popis s HTML a entitami sa vyčistí', () => {
    const ld = {
      '@type': 'Recipe',
      name: 'X',
      recipeIngredient: ['1 vajce'],
      description: '<p dir="ltr">Spojenie jemn&eacute;ho cesta.<span id="docs-internal-guid-1"></span></p>',
    }
    expect(extractRecipe(sources([ld]))?.recipe.description).toBe('Spojenie jemného cesta.')
  })
})

describe('kuchynalidla.sk – „Potrebujeme“ a „Postup“ v postupe', () => {
  const steps = (instructions: unknown) =>
    extractRecipe(
      sources([
        {
          '@type': 'Recipe',
          name: 'Segedínsky guláš',
          recipeIngredient: ['1 vajce'],
          recipeInstructions: instructions,
        },
      ]),
    )?.recipe.steps?.map((s) => s.text)

  it('zoznam pomôcok pod „Potrebujeme“ je jeden krok a nadpis „Postup“ nie je krok', () => {
    expect(
      steps(
        'Potrebujeme<br>plátno<br>niť<br>metličku na šľahanie<br>sitko<br>Postup<br>V hrnci osmažíme cibuľu. Pridáme mäso.',
      ),
    ).toEqual([
      'Potrebujeme: plátno, niť, metličku na šľahanie, sitko',
      'V hrnci osmažíme cibuľu. Pridáme mäso.',
    ])
  })

  it('zlepený nadpis („Potrebujemehrniec“) a veľké „POSTUP“ sa rozpoznajú', () => {
    expect(
      steps('Potrebujemehrniec, špagát, odmerku<br>POSTUPMäsoDo hrnca pridáme masť a restujeme.'),
    ).toEqual(['Potrebujeme: hrniec, špagát, odmerku', 'Mäso: Do hrnca pridáme masť a restujeme.'])
  })

  it('bez nadpisu „Postup“ sa k pomôckam pripoja len krátke riadky bez bodky', () => {
    expect(steps(['Potrebujeme', 'hrniec', 'sitko', 'Cibuľu nakrájame nadrobno a orestujeme.'])).toEqual([
      'Potrebujeme: hrniec, sitko',
      'Cibuľu nakrájame nadrobno a orestujeme.',
    ])
  })

  it('osamotený nadpis „Postup“ sa zahodí a bežné kroky ostanú', () => {
    expect(steps(['Postup', 'Zmiešame múku.', 'Upečieme.'])).toEqual(['Zmiešame múku.', 'Upečieme.'])
  })

  it('veta začínajúca slovom Potrebujeme nie je nadpis', () => {
    expect(steps(['Potrebujeme veľkú misu na cesto.', 'Zmiešame múku.'])).toEqual([
      'Potrebujeme veľkú misu na cesto.',
      'Zmiešame múku.',
    ])
  })
})
