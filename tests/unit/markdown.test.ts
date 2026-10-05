import { describe, expect, it } from 'vitest'
import {
  markdownFilename,
  recipesToMarkdown,
  recipeToMarkdown,
  type RecipeMarkdownInput,
} from '@shared/markdown'

const gulas: RecipeMarkdownInput = {
  title: 'Hovädzí guláš',
  description: 'Babkin recept.',
  category: 'hlavne',
  servings: 4,
  prepMinutes: 20,
  cookMinutes: 120,
  difficulty: 2,
  sourceUrl: 'https://example.com/g',
  sourceText: null,
  tags: [{ name: 'Klasika' }, { name: 'Na víkend' }],
  ingredients: [
    { name: 'Hovädzie mäso', quantity: 800, unit: 'g', note: null, groupName: null, isOptional: false },
    { name: 'Cibuľa', quantity: 3, unit: 'ks', note: 'veľké', groupName: null, isOptional: false },
    { name: 'Soľ', quantity: null, unit: null, note: null, groupName: null, isOptional: false },
    { name: 'Rasca', quantity: 1, unit: 'ČL', note: null, groupName: 'Korenie', isOptional: true },
    { name: 'Paprika', quantity: 2, unit: 'PL', note: null, groupName: 'Korenie', isOptional: false },
  ],
  steps: [
    { text: 'Nakrájaj cibuľu.', timerSeconds: null },
    { text: 'Opeč mäso.\nPridaj soľ.', timerSeconds: 600 },
  ],
}

const minimal = (title: string): RecipeMarkdownInput => ({
  title,
  description: null,
  category: 'ine',
  servings: 1,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: 1,
  sourceUrl: null,
  sourceText: null,
  tags: [],
  ingredients: [],
  steps: [],
})

describe('recipeToMarkdown', () => {
  it('vytvorí čitateľný dokument so skupinami ingrediencií, časovačmi a zdrojom', () => {
    expect(recipeToMarkdown(gulas)).toBe(
      [
        '# Hovädzí guláš',
        '',
        '*Hlavné jedlo · 4 porcie · príprava 20 min · varenie 2 h · spolu 2 h 20 min · náročnosť Stredné*',
        '',
        'Babkin recept.',
        '',
        '**Tagy:** #Klasika #Na víkend',
        '',
        '## Ingrediencie',
        '',
        '- 800 g Hovädzie mäso',
        '- 3 ks Cibuľa (veľké)',
        '- Soľ',
        '',
        '### Korenie',
        '',
        '- 1 ČL Rasca (voliteľné)',
        '- 2 PL Paprika',
        '',
        '## Postup',
        '',
        '1. Nakrájaj cibuľu.',
        '2. Opeč mäso.',
        '   Pridaj soľ. *(časovač 10 min)*',
        '',
        'Zdroj: https://example.com/g',
        '',
      ].join('\n'),
    )
  })

  it('prázdne časti vynechá, zostane názov a základné údaje', () => {
    expect(recipeToMarkdown(minimal('Voda'))).toBe(
      ['# Voda', '', '*Iné · 1 porcia · náročnosť Jednoduché*', ''].join('\n'),
    )
  })

  it('zdroj s názvom je odkaz, zdroj bez adresy len text', () => {
    expect(
      recipeToMarkdown({ ...minimal('A'), sourceUrl: 'https://x.sk/a', sourceText: 'Varecha' }),
    ).toContain('Zdroj: [Varecha](https://x.sk/a)')
    expect(recipeToMarkdown({ ...minimal('A'), sourceText: 'Babka' })).toContain('Zdroj: Babka')
  })

  it('spolu sa ukáže len keď je známa príprava aj varenie', () => {
    const onlyCook = recipeToMarkdown({ ...minimal('A'), cookMinutes: 30 })
    expect(onlyCook).toContain('varenie 30 min')
    expect(onlyCook).not.toContain('spolu')
    expect(onlyCook).not.toContain('príprava')
  })

  it('prepočíta množstvá a porcie podľa zvoleného počtu porcií', () => {
    const scaled = recipeToMarkdown(gulas, { servings: 8 })
    expect(scaled).toContain('8 porcií')
    expect(scaled).toContain('- 1,6 kg Hovädzie mäso')
    expect(scaled).toContain('- 6 ks Cibuľa (veľké)')
    expect(scaled).toContain('- 2 PL Paprika'.replace('2 PL', '4 PL'))
    // pôvodné porcie nič nemenia
    expect(recipeToMarkdown(gulas, { servings: 4 })).toBe(recipeToMarkdown(gulas))
  })

  it('časovač pod minútu sa zaokrúhli nahor na minútu', () => {
    const r = { ...minimal('A'), steps: [{ text: 'Krok', timerSeconds: 30 }] }
    expect(recipeToMarkdown(r)).toContain('1. Krok *(časovač 1 min)*')
  })
})

describe('recipesToMarkdown', () => {
  it('spojí recepty oddeľovačom a prázdny zoznam je prázdny text', () => {
    const text = recipesToMarkdown([minimal('Prvý'), minimal('Druhý')])
    expect(text).toContain('# Prvý')
    expect(text).toContain('\n---\n\n# Druhý')
    expect(recipesToMarkdown([])).toBe('')
  })
})

describe('markdownFilename', () => {
  it('názov súboru z názvu receptu bez diakritiky', () => {
    expect(markdownFilename('Hovädzí guláš')).toBe('hovadzi-gulas.md')
    expect(markdownFilename('???')).toBe('recept.md')
  })
})
