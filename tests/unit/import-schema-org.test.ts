import { describe, expect, it } from 'vitest'
import {
  assignIngredientGroups,
  decodeEntities,
  extractRecipe,
  mapCategory,
  parseIngredientLine,
  parseIsoDuration,
  parseYield,
  type ImportSources,
} from '@shared/import/schemaOrg'
import { unitFromText } from '@shared/units'

const sources = (jsonLd: unknown[], extra: Partial<ImportSources> = {}): ImportSources => ({
  jsonLd: jsonLd.map((j) => JSON.stringify(j)),
  meta: {},
  microdata: [],
  sourceUrl: 'https://example.com/recept',
  ...extra,
})

describe('parseIsoDuration', () => {
  it('prevedie ISO 8601 trvanie na minúty', () => {
    expect(parseIsoDuration('PT30M')).toBe(30)
    expect(parseIsoDuration('PT1H15M')).toBe(75)
    expect(parseIsoDuration('PT2H')).toBe(120)
    expect(parseIsoDuration('P0DT1H')).toBe(60)
    expect(parseIsoDuration('P1DT0H0M')).toBe(1440)
    expect(parseIsoDuration('PT45S')).toBe(1)
  })

  it('neplatné alebo nulové trvanie je null', () => {
    expect(parseIsoDuration('PT0M')).toBeNull()
    expect(parseIsoDuration('30 minút')).toBeNull()
    expect(parseIsoDuration(undefined)).toBeNull()
    expect(parseIsoDuration(30)).toBeNull()
  })
})

describe('parseYield', () => {
  it('vezme prvé celé číslo z textu, čísla aj poľa', () => {
    expect(parseYield('4 porcie')).toBe(4)
    expect(parseYield('Serves 6')).toBe(6)
    expect(parseYield(8)).toBe(8)
    expect(parseYield(['12', '12 muffins'])).toBe(12)
    expect(parseYield('makes 2-3 servings')).toBe(2)
  })

  it('chýbajúci alebo nezmyselný údaj je null, príliš veľký sa orezá na 50', () => {
    expect(parseYield(undefined)).toBeNull()
    expect(parseYield('porcia')).toBeNull()
    expect(parseYield(0)).toBeNull()
    expect(parseYield('200 kusov')).toBe(50)
  })
})

describe('decodeEntities', () => {
  it('dekóduje pomenované aj číselné entity', () => {
    expect(decodeEntities('Mäso &amp; zelenina &quot;na&quot; &#39;grile&#39; &#x2013; &nbsp;hotovo')).toBe(
      'Mäso & zelenina "na" \'grile\' –  hotovo',
    )
  })
})

describe('decodeEntities – diakritika a dvojité kódovanie', () => {
  it('dekóduje slovenskú diakritiku zapísanú entitami', () => {
    expect(
      decodeEntities('gr&oacute;fkin kol&aacute;&#269; &scaron;&uacute;&zcaron;&yacute; &ocirc;sm&yacute;'),
    ).toBe('grófkin koláč šúžý ôsmý')
    expect(
      decodeEntities(
        '&Eacute;&Scaron;&Zcaron;&ccaron;&ncaron;&tcaron;&dcaron;&lcaron;&racute;&lacute;&auml;&uuml;&ouml;',
      ),
    ).toBe('ÉŠŽčňťďľŕĺäüö')
  })

  it('dekóduje aj dvojito zakódované entity (&amp;oacute;)', () => {
    expect(decodeEntities('gr&amp;oacute;fkin kol&amp;aacute;&amp;#269;')).toBe('grófkin koláč')
  })

  it('neznáme entity nechá bez zmeny', () => {
    expect(decodeEntities('a &neexistuje; b')).toBe('a &neexistuje; b')
  })
})

describe('mapCategory', () => {
  it('namapuje bežné názvy kategórií', () => {
    expect(mapCategory('Dessert')).toBe('dezert')
    expect(mapCategory('Hlavné jedlo')).toBe('hlavne')
    expect(mapCategory(['Soup', 'Dinner'])).toBe('polievka')
    expect(mapCategory('Raňajky')).toBe('ranajky')
    expect(mapCategory('salad')).toBe('salat')
    expect(mapCategory(undefined)).toBe('hlavne')
    expect(mapCategory('hocičo')).toBe('hlavne')
  })
})

describe('unitFromText', () => {
  it('rozpozná kódy aj skloňované tvary bez ohľadu na diakritiku', () => {
    expect(unitFromText('g')).toBe('g')
    expect(unitFromText('Šálky')).toBe('šálka')
    expect(unitFromText('lyzice')).toBe('PL')
    expect(unitFromText('hocico')).toBeNull()
  })
})

describe('parseIngredientLine', () => {
  const parse = (line: string) => {
    const { name, quantity, unit, note } = parseIngredientLine(line)
    return { name, quantity, unit, note }
  }

  it('slovenské riadky s jednotkou', () => {
    expect(parse('200 g masla')).toEqual({ name: 'masla', quantity: 200, unit: 'g', note: null })
    expect(parse('2 šálky múky')).toEqual({ name: 'múky', quantity: 2, unit: 'šálka', note: null })
    expect(parse('1,5 kg zemiakov')).toEqual({ name: 'zemiakov', quantity: 1.5, unit: 'kg', note: null })
    expect(parse('3 vajcia')).toEqual({ name: 'vajcia', quantity: 3, unit: null, note: null })
  })

  it('zlomky, zmiešané čísla a unicode zlomky', () => {
    expect(parse('½ šálky múky')).toEqual({ name: 'múky', quantity: 0.5, unit: 'šálka', note: null })
    expect(parse('1 1/2 šálky cukru')).toEqual({ name: 'cukru', quantity: 1.5, unit: 'šálka', note: null })
    expect(parse('1½ ČL soli')).toEqual({ name: 'soli', quantity: 1.5, unit: 'ČL', note: null })
    expect(parse('3/4 l mlieka')).toEqual({ name: 'mlieka', quantity: 0.75, unit: 'l', note: null })
  })

  it('rozsah berie od spodnej hranice a pôvodný zápis necháva v poznámke', () => {
    expect(parse('2-3 lyžice oleja')).toEqual({ name: 'oleja', quantity: 2, unit: 'PL', note: '2–3' })
    expect(parse('2 – 3 cibule')).toEqual({ name: 'cibule', quantity: 2, unit: null, note: '2–3' })
  })

  it('slovenský zápis „názov, množstvo jednotka“ (množstvo za čiarkou)', () => {
    expect(parse('cukor práškový, 200 g')).toEqual({
      name: 'cukor práškový',
      quantity: 200,
      unit: 'g',
      note: null,
    })
    expect(parse('keksy BeBe kakaové, 1 bal')).toEqual({
      name: 'keksy BeBe kakaové',
      quantity: 1,
      unit: 'balenie',
      note: null,
    })
    expect(parse('keksy BeBe mliečne, 1  bal')).toMatchObject({ quantity: 1, unit: 'balenie' })
    expect(parse('žĺtky, 4 ks')).toEqual({ name: 'žĺtky', quantity: 4, unit: 'ks', note: null })
    expect(parse('banány, 500 g')).toEqual({ name: 'banány', quantity: 500, unit: 'g', note: null })
  })

  it('množstvo za čiarkou: rozsah, neznáma jednotka a zvyšok idú do poznámky', () => {
    expect(parse('cukor vanilkový, 1-2 ks')).toEqual({
      name: 'cukor vanilkový',
      quantity: 1,
      unit: 'ks',
      note: '1–2',
    })
    expect(parse('Jablká, 1 700ml pohár strúhané')).toEqual({
      name: 'Jablká',
      quantity: 1,
      unit: null,
      note: '700ml pohár strúhané',
    })
    expect(parse('múka, 2 PL hladká')).toEqual({ name: 'múka', quantity: 2, unit: 'PL', note: 'hladká' })
  })

  it('text za čiarkou bez množstva na začiatku ostáva poznámkou', () => {
    expect(parse('bielky, sneh zo 4 ks')).toEqual({
      name: 'bielky',
      quantity: null,
      unit: null,
      note: 'sneh zo 4 ks',
    })
    expect(parse('mrkva, nastrúhaná')).toEqual({
      name: 'mrkva',
      quantity: null,
      unit: null,
      note: 'nastrúhaná',
    })
  })

  it('zátvorky a text za čiarkou idú do poznámky', () => {
    expect(parse('2 (200 g) cibule, nakrájané')).toEqual({
      name: 'cibule',
      quantity: 2,
      unit: null,
      note: '200 g, nakrájané',
    })
    expect(parse('250 ml mlieka, vlažného')).toEqual({
      name: 'mlieka',
      quantity: 250,
      unit: 'ml',
      note: 'vlažného',
    })
    expect(parse('1,5 dl vody')).toEqual({ name: 'vody', quantity: 150, unit: 'ml', note: null })
  })

  it('anglické jednotky a prepočty', () => {
    expect(parse('1 cup milk')).toEqual({ name: 'milk', quantity: 1, unit: 'šálka', note: null })
    expect(parse('2 tbsp. olive oil')).toEqual({ name: 'olive oil', quantity: 2, unit: 'PL', note: null })
    expect(parse('1 teaspoon salt')).toEqual({ name: 'salt', quantity: 1, unit: 'ČL', note: null })
    expect(parse('8 oz pasta')).toEqual({ name: 'pasta', quantity: 227, unit: 'g', note: null })
    expect(parse('1 lb beef')).toEqual({ name: 'beef', quantity: 454, unit: 'g', note: null })
    expect(parse('2 dl mlieka')).toEqual({ name: 'mlieka', quantity: 200, unit: 'ml', note: null })
    expect(parse('5 dkg syra')).toEqual({ name: 'syra', quantity: 50, unit: 'g', note: null })
  })

  it('riadok bez množstva je celý názov, jednotka bez názvu tiež', () => {
    expect(parse('soľ podľa chuti')).toEqual({
      name: 'soľ podľa chuti',
      quantity: null,
      unit: null,
      note: null,
    })
    expect(parse('100 g')).toEqual({ name: '100 g', quantity: null, unit: null, note: null })
    expect(parse('  Čerstvá bazalka  ')).toEqual({
      name: 'Čerstvá bazalka',
      quantity: null,
      unit: null,
      note: null,
    })
  })

  it('dekóduje entity a zlúči medzery', () => {
    expect(parse('2&nbsp;lyžice   masla &amp; oleja')).toEqual({
      name: 'masla & oleja',
      quantity: 2,
      unit: 'PL',
      note: null,
    })
  })
})

const fullRecipe = {
  '@type': 'Recipe',
  name: 'Babkin guláš &amp; knedle',
  description: 'Poctivý <b>guláš</b>.',
  image: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  recipeYield: '6 porcií',
  prepTime: 'PT20M',
  cookTime: 'PT2H',
  recipeCategory: 'Hlavné jedlo',
  keywords: 'klasika, na víkend, Klasika',
  recipeIngredient: ['800 g hovädzieho mäsa', '3 cibule, nakrájané', 'soľ'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Nakrájaj cibuľu.' },
    { '@type': 'HowToStep', name: 'Opeč mäso.' },
  ],
}

describe('extractRecipe – JSON-LD', () => {
  it('namapuje kompletný recept', () => {
    const result = extractRecipe(sources([fullRecipe]))!
    expect(result.imageUrl).toBe('https://example.com/a.jpg')
    expect(result.warnings).toEqual([])
    expect(result.recipe).toMatchObject({
      title: 'Babkin guláš & knedle',
      description: 'Poctivý guláš.',
      category: 'hlavne',
      servings: 6,
      prepMinutes: 20,
      cookMinutes: 120,
      sourceUrl: 'https://example.com/recept',
      tags: ['klasika', 'na víkend'],
      steps: [{ text: 'Nakrájaj cibuľu.' }, { text: 'Opeč mäso.' }],
    })
    expect(result.recipe.ingredients).toEqual([
      { name: 'hovädzieho mäsa', quantity: 800, unit: 'g', note: null, isOptional: false },
      { name: 'cibule', quantity: 3, unit: null, note: 'nakrájané', isOptional: false },
      { name: 'soľ', quantity: null, unit: null, note: null, isOptional: false },
    ])
  })

  it('nájde recept v poli aj v @graph a pri viacerých @type', () => {
    const inArray = extractRecipe(sources([[{ '@type': 'WebSite' }, fullRecipe]]))
    expect(inArray?.recipe.title).toBe('Babkin guláš & knedle')
    const inGraph = extractRecipe(
      sources([{ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person' }, fullRecipe] }]),
    )
    expect(inGraph?.recipe.title).toBe('Babkin guláš & knedle')
    const multi = extractRecipe(sources([{ ...fullRecipe, '@type': ['Recipe', 'NewsArticle'] }]))
    expect(multi?.recipe.title).toBe('Babkin guláš & knedle')
  })

  it('preskočí poškodený JSON a vezme ďalší blok', () => {
    const result = extractRecipe({
      ...sources([fullRecipe]),
      jsonLd: ['{ nie je json', JSON.stringify(fullRecipe)],
    })
    expect(result?.recipe.title).toBe('Babkin guláš & knedle')
  })

  it('postup ako text, ako zoznam textov aj v sekciách HowToSection', () => {
    const text = extractRecipe(
      sources([{ ...fullRecipe, recipeInstructions: 'Nakrájaj cibuľu.\n\nOpeč mäso.\r\nUduš.' }]),
    )!
    expect(text.recipe.steps?.map((s) => s.text)).toEqual(['Nakrájaj cibuľu.', 'Opeč mäso.', 'Uduš.'])

    const list = extractRecipe(sources([{ ...fullRecipe, recipeInstructions: ['Prvý.', 'Druhý.'] }]))!
    expect(list.recipe.steps?.map((s) => s.text)).toEqual(['Prvý.', 'Druhý.'])

    const sections = extractRecipe(
      sources([
        {
          ...fullRecipe,
          recipeInstructions: [
            {
              '@type': 'HowToSection',
              name: 'Cesto',
              itemListElement: [
                { '@type': 'HowToStep', text: 'Zmiešaj.' },
                { '@type': 'HowToStep', text: 'Odlož.' },
              ],
            },
            {
              '@type': 'HowToSection',
              name: 'Plnka',
              itemListElement: [{ '@type': 'HowToStep', text: 'Namiešaj plnku.' }],
            },
          ],
        },
      ]),
    )!
    expect(sections.recipe.steps?.map((s) => s.text)).toEqual(['Zmiešaj.', 'Odlož.', 'Namiešaj plnku.'])
  })

  it('obrázok ako text, objekt aj pole objektov', () => {
    expect(extractRecipe(sources([{ ...fullRecipe, image: 'https://example.com/x.png' }]))?.imageUrl).toBe(
      'https://example.com/x.png',
    )
    expect(
      extractRecipe(
        sources([{ ...fullRecipe, image: { '@type': 'ImageObject', url: 'https://example.com/o.png' } }]),
      )?.imageUrl,
    ).toBe('https://example.com/o.png')
    expect(
      extractRecipe(sources([{ ...fullRecipe, image: [{ url: 'https://example.com/p.png' }] }]))?.imageUrl,
    ).toBe('https://example.com/p.png')
    expect(extractRecipe(sources([{ ...fullRecipe, image: undefined }]))?.imageUrl).toBeNull()
  })

  it('upozorní na chýbajúce porcie, ingrediencie a postup', () => {
    const result = extractRecipe(
      sources([{ '@type': 'Recipe', name: 'Voda', recipeIngredient: ['1 l vody'] }]),
    )!
    expect(result.recipe.servings).toBe(4)
    expect(result.warnings).toEqual([
      'Počet porcií sa nenašiel, nastavili sme 4.',
      'Postup sa nenašiel, doplň ho ručne.',
    ])
    const empty = extractRecipe(sources([{ '@type': 'Recipe', name: 'Nič', recipeYield: 2 }]))!
    expect(empty.warnings).toContain('Ingrediencie sa nenašli, doplň ich ručne.')
  })

  it('bez receptu vráti null', () => {
    expect(extractRecipe(sources([{ '@type': 'Article', headline: 'Blog' }]))).toBeNull()
    expect(extractRecipe(sources([]))).toBeNull()
    expect(extractRecipe(sources([{ '@type': 'Recipe' }]))).toBeNull()
  })

  it('doplní chýbajúci názov, popis a fotku z og meta', () => {
    const result = extractRecipe(
      sources([{ '@type': 'Recipe', recipeIngredient: ['1 l vody'], recipeInstructions: 'Uvar.' }], {
        meta: {
          'og:title': 'Čistá voda',
          'og:description': 'Super.',
          'og:image': 'https://example.com/og.jpg',
        },
      }),
    )!
    expect(result.recipe).toMatchObject({ title: 'Čistá voda', description: 'Super.' })
    expect(result.imageUrl).toBe('https://example.com/og.jpg')
  })
})

describe('extractRecipe – microdata', () => {
  it('zloží recept z itemprop, keď chýba JSON-LD', () => {
    const result = extractRecipe({
      jsonLd: [],
      meta: {},
      sourceUrl: null,
      microdata: [
        { prop: 'name', value: 'Palacinky' },
        { prop: 'recipeYield', value: '4 porcie' },
        { prop: 'prepTime', value: 'PT10M' },
        { prop: 'cookTime', value: 'PT15M' },
        { prop: 'recipeIngredient', value: '250 ml mlieka' },
        { prop: 'ingredients', value: '2 vajcia' },
        { prop: 'recipeInstructions', value: 'Zmiešaj.' },
        { prop: 'image', value: 'https://example.com/pal.jpg' },
      ],
    })!
    expect(result.recipe).toMatchObject({
      title: 'Palacinky',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 15,
      steps: [{ text: 'Zmiešaj.' }],
    })
    expect(result.recipe.ingredients?.map((i) => i.name)).toEqual(['mlieka', 'vajcia'])
    expect(result.imageUrl).toBe('https://example.com/pal.jpg')
    expect(result.recipe.sourceUrl).toBeNull()
  })

  it('samotný og:title bez ingrediencií a postupu nestačí', () => {
    expect(
      extractRecipe({ jsonLd: [], microdata: [], sourceUrl: null, meta: { 'og:title': 'Blog' } }),
    ).toBeNull()
  })
})

describe('extractRecipe – tagy', () => {
  it('z dlhého zoznamu kľúčových slov vezme len prvých osem', () => {
    const keywords = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(', ')
    const result = extractRecipe(sources([{ ...fullRecipe, keywords }]))!
    expect(result.recipe.tags).toEqual(Array.from({ length: 8 }, (_, i) => `tag${i}`))
  })
})

describe('varecha.pravda.sk – Grófkin jablkový koláč', () => {
  const longStep =
    'Heru, žĺtka a práškový cukor vymiešame elektrickým šľahačom. Pridáme múku spolu s kypriacim práškom. ' +
    'Prenesieme na dosku a vypracujeme cesto. Z neho si tak 1/4-1/3 oddelíme a dáme do mrazničky. ' +
    'Ostatné cesto dáme na cca 1 hodinu do chladničky. Potom rozohrejeme rúru, vyberieme cesto z chladničky a ' +
    'vyvaľkáme ho na veľkosť plechu 25x35cm. Na cesto navrstvíme strúhané jablká, ktoré sme osladili cukrom. ' +
    'Jablkovú plnku zarovnáme. Potom z bielkov ušľaháme sneh, ktorý dáme na jablkovú plnku. Pridala som aj hrozienka. ' +
    'Z mrazničky vyberieme odložený kus cesta a na veľkých okách strúhadla ho nastrúhame na vrch koláča. ' +
    'Takto upravený koláč dáme piecť do rúry predhriatej na 180 stupňov asi na 30 minút.'

  const recipe = {
    '@type': 'Recipe',
    name: 'Grófkin jablkový koláč ',
    recipeYield: '15 porcií',
    prepTime: 'PT70M',
    cookTime: 'PT30M',
    totalTime: 'PT100M',
    keywords: [
      'Banskobystrický kraj',
      'Bezmäsité jedlá',
      'Chody',
      'Dezerty',
      'Lacné jedlá',
      '* Recepty z Pravdy',
      'Slovenská kuchyňa',
      'Spôsob prípravy',
    ],
    recipeIngredient: [
      'Hera, 150 g',
      'cukor práškový, 120 g',
      'prášok do pečiva, 1/2 balíčka',
      'múka hladká, 450 g',
      'žĺtky, 4 ks',
      'jablká , 1 700ml pohár strúhané',
      'cukor škoricový , 2 balíčky',
      'cukor kryštál, 2 PL',
      'hrozienka, 2 hrste',
      'bielky, sneh zo 4  ks',
    ],
    recipeInstructions: [{ '@type': 'HowToStep', text: longStep }],
  }

  it('množstvá za čiarkou sa čítajú ako množstvá, balíček je balenie', () => {
    const parsed = extractRecipe(sources([recipe]))!.recipe.ingredients!.map((i) => [
      i.name,
      i.quantity,
      i.unit,
      i.note,
    ])
    expect(parsed).toEqual([
      ['Hera', 150, 'g', null],
      ['cukor práškový', 120, 'g', null],
      ['prášok do pečiva', 0.5, 'balenie', null],
      ['múka hladká', 450, 'g', null],
      ['žĺtky', 4, 'ks', null],
      ['jablká', 1, null, '700ml pohár strúhané'],
      ['cukor škoricový', 2, 'balenie', null],
      ['cukor kryštál', 2, 'PL', null],
      ['hrozienka', 2, null, 'hrste'],
      ['bielky', null, null, 'sneh zo 4 ks'],
    ])
  })

  it('typ jedla sa určí z kľúčových slov (Dezerty), keď web recipeCategory neuvádza', () => {
    expect(extractRecipe(sources([recipe]))!.recipe.category).toBe('dezert')
  })

  it('tagy bez šumu: bez hviezdičkových, všeobecných slov a slova, ktoré už je typom jedla', () => {
    expect(extractRecipe(sources([recipe]))!.recipe.tags).toEqual([
      'Banskobystrický kraj',
      'Bezmäsité jedlá',
      'Lacné jedlá',
      'Slovenská kuchyňa',
    ])
  })

  it('jeden dlhý odsek postupu sa rozdelí na prehľadné kroky bez straty textu', () => {
    const steps = extractRecipe(sources([recipe]))!.recipe.steps!.map((s) => s.text)
    expect(steps.length).toBeGreaterThanOrEqual(3)
    expect(Math.max(...steps.map((t) => t.length))).toBeLessThanOrEqual(340)
    expect(steps.join(' ')).toBe(longStep)
  })

  it('krátky postup a postup už rozdelený webom sa nemení', () => {
    const short = extractRecipe(sources([{ ...recipe, recipeInstructions: ['Zmiešaj. Upeč.'] }]))!
    expect(short.recipe.steps).toEqual([{ text: 'Zmiešaj. Upeč.' }])
    const many = extractRecipe(sources([{ ...recipe, recipeInstructions: [longStep, 'Podávaj.'] }]))!
    expect(many.recipe.steps).toHaveLength(2)
  })

  it('porcie a časy sa prevezmú', () => {
    const r = extractRecipe(sources([recipe]))!.recipe
    expect(r.servings).toBe(15)
    expect(r.prepMinutes).toBe(70)
    expect(r.cookMinutes).toBe(30)
  })
})

describe('skupiny ingrediencií (Korpus, Náplň, Poleva…)', () => {
  const g = (text: string) => ({ kind: 'group' as const, text })
  const row = { kind: 'row' as const }

  it('každý riadok dostane skupinu, ktorá mu predchádza; dvojbodka sa odstráni', () => {
    const marks = [g('Korpus:'), row, row, g(' Náplň : '), row, row, g('Zdobenie:'), row]
    expect(assignIngredientGroups(5, marks)).toEqual(['Korpus', 'Korpus', 'Náplň', 'Náplň', 'Zdobenie'])
  })

  it('riadky pred prvou skupinou sú bez skupiny', () => {
    expect(assignIngredientGroups(3, [row, g('Poleva:'), row, row])).toEqual([null, 'Poleva', 'Poleva'])
  })

  it('počet riadkov musí sedieť s počtom ingrediencií, inak sa skupiny nepoužijú', () => {
    expect(assignIngredientGroups(4, [g('A:'), row, row, row])).toBeNull()
    expect(assignIngredientGroups(2, [])).toBeNull()
    expect(assignIngredientGroups(2, [row, row])).toBeNull() // žiadna skupina nie je čo priradiť
  })

  it('prázdne a príliš dlhé názvy skupín sa ošetria', () => {
    expect(assignIngredientGroups(2, [g('  :  '), row, g('x'.repeat(200)), row])).toEqual([
      null,
      'x'.repeat(80),
    ])
  })

  it('extractRecipe priradí skupiny k ingredienciám podľa poradia', () => {
    const marks = [
      { kind: 'group' as const, text: 'Korpus:' },
      { kind: 'row' as const },
      { kind: 'row' as const },
      { kind: 'group' as const, text: 'Náplň:' },
      { kind: 'row' as const },
    ]
    const result = extractRecipe(
      sources(
        [
          {
            '@type': 'Recipe',
            name: 'Cheesecake',
            recipeIngredient: ['sušienky, 200 g', 'maslo, 90 g', 'syr, 600 g'],
          },
        ],
        { ingredientMarks: marks },
      ),
    )
    expect(result?.recipe.ingredients?.map((i) => [i.name, i.groupName])).toEqual([
      ['sušienky', 'Korpus'],
      ['maslo', 'Korpus'],
      ['syr', 'Náplň'],
    ])
  })

  it('bez značiek alebo pri nesúlade počtu ostanú ingrediencie bez skupín', () => {
    const ld = [{ '@type': 'Recipe', name: 'X', recipeIngredient: ['a', 'b'] }]
    expect(extractRecipe(sources(ld))?.recipe.ingredients?.every((i) => !i.groupName)).toBe(true)
    const bad = [{ kind: 'group' as const, text: 'A:' }, { kind: 'row' as const }]
    expect(
      extractRecipe(sources(ld, { ingredientMarks: bad }))?.recipe.ingredients?.every((i) => !i.groupName),
    ).toBe(true)
  })
})
