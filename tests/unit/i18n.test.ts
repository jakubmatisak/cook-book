import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/api/http'
import { DEFAULT_SHOP_CATEGORY_KEYS, DEFAULT_SLOT_KEYS, shopCategoryName, slotName } from '@/i18n/defaults'
import { errorText } from '@/i18n/errors'
import { validationText, VALIDATION_KEYS } from '@/i18n/validation'
import { z } from '@shared/schemas/zod'
import { formatDate, formatDayLabel, formatMinutes, formatNumber, formatWeekRange, tc } from '@/i18n/format'
import { currentLocale, messages, parseLocale, setLocale, t, te } from '@/i18n'
import { skPluralRule } from '@/i18n/plural'

afterEach(() => {
  setLocale('sk')
  localStorage.clear()
})

/** Všetky kľúče objektu ako `a.b.c`. */
const flatten = (obj: unknown, prefix = ''): string[] =>
  typeof obj === 'object' && obj !== null
    ? Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix]

describe('preklady', () => {
  it('slovenčina a angličtina majú presne rovnaké kľúče', () => {
    const sk = new Set(flatten(messages.sk).filter((k) => !k.startsWith('$vuetify')))
    const en = new Set(flatten(messages.en).filter((k) => !k.startsWith('$vuetify')))
    expect([...sk].filter((k) => !en.has(k))).toEqual([])
    expect([...en].filter((k) => !sk.has(k))).toEqual([])
    expect(sk.size).toBeGreaterThan(50)
  })

  it('žiadny preklad nie je prázdny a rovnaké zástupné znaky ({n}, {name}) sú v oboch jazykoch', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()
    const walk = (a: unknown, b: unknown, path: string) => {
      if (typeof a === 'string' && typeof b === 'string') {
        expect(a.trim(), path).not.toBe('')
        expect(b.trim(), path).not.toBe('')
        expect([...new Set(placeholders(b))], path).toEqual([...new Set(placeholders(a))])
        return
      }
      if (typeof a === 'object' && a && typeof b === 'object' && b) {
        for (const key of Object.keys(a)) {
          if (key !== '$vuetify')
            walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`)
        }
      }
    }
    walk(messages.sk, messages.en, '')
  })

  it('parseLocale berie len podporované jazyky', () => {
    expect(parseLocale('en')).toBe('en')
    expect(parseLocale('de')).toBe('sk')
    expect(parseLocale(null)).toBe('sk')
  })

  it('setLocale prepne preklady, nastaví lang a zapamätá si jazyk', () => {
    expect(t('common.nav.recipes')).toBe('Recepty')
    setLocale('en')
    expect(currentLocale()).toBe('en')
    expect(t('common.nav.recipes')).toBe('Recipes')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('kniha:locale')).toBe('en')
  })
})

describe('množné číslo', () => {
  it('slovenské tvary: 1 | 2–4 | 0 a 5+ | desatinné', () => {
    expect(
      [0, 1, 2, 4, 5, 11, 1.5].map(skPluralRule.bind(null) as never as (n: number) => number),
    ).toBeDefined()
    expect(skPluralRule(1, 3)).toBe(0)
    expect(skPluralRule(3, 3)).toBe(1)
    expect(skPluralRule(0, 3)).toBe(2)
    expect(skPluralRule(5, 3)).toBe(2)
    expect(skPluralRule(1.5, 3)).toBe(1)
    expect(skPluralRule(1, 2)).toBe(0)
    expect(skPluralRule(2, 2)).toBe(1)
  })

  it('tc zloží číslo a správny tvar', () => {
    expect([1, 2, 5, 0, 1.5].map((n) => tc('common.plural.portions', n))).toEqual([
      '1 porcia',
      '2 porcie',
      '5 porcií',
      '0 porcií',
      '1,5 porcie',
    ])
    setLocale('en')
    expect([1, 2, 0, 1.5].map((n) => tc('common.plural.portions', n))).toEqual([
      '1 serving',
      '2 servings',
      '0 servings',
      '1.5 servings',
    ])
  })
})

describe('formátovanie podľa jazyka', () => {
  it('čísla, minúty a dátumy po slovensky (rovnako ako doteraz)', () => {
    expect(formatNumber(1.5)).toBe('1,5')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatDate('2026-10-05')).toBe('5. 10. 2026')
    expect(formatDayLabel('2026-10-05')).toEqual({ short: 'PO', long: 'Pondelok', date: '5. 10.' })
    expect(formatDayLabel('2026-10-08').short).toBe('ŠT')
    expect(formatWeekRange('2026-10-05').replace(/\s/g, ' ')).toBe('5. – 11. 10. 2026')
  })

  it('v angličtine sa mení formát aj názvy dní', () => {
    setLocale('en')
    expect(formatNumber(1.5)).toBe('1.5')
    expect(formatDayLabel('2026-10-05').long).toBe('Monday')
    expect(formatDate('2026-10-05')).toBe('10/5/2026')
    expect(formatWeekRange('2026-10-05')).toMatch(/Oct 5.*11, 2026/)
  })
})

describe('errorText', () => {
  it('v slovenčine ukáže hlášku servera, v angličtine preklad podľa kódu', () => {
    const error = new ApiError(409, 'last_owner', 'Domácnosť musí mať aspoň jedného vlastníka.')
    expect(errorText(error)).toBe('Domácnosť musí mať aspoň jedného vlastníka.')
    setLocale('en')
    expect(errorText(error)).toBe('A household needs at least one owner.')
  })

  it('neznámy kód ukáže hlášku servera, ne-ApiError všeobecný text', () => {
    setLocale('en')
    expect(errorText(new ApiError(400, 'nieco_ine', 'Vlastná hláška'))).toBe('Vlastná hláška')
    expect(errorText('?')).toBe('Something went wrong. Try again.')
    expect(errorText(new Error('Chyba'))).toBe('Chyba')
  })
})

describe('hlášky overenia', () => {
  it('známe hlášky zo shared/schemas sa v angličtine preložia, v slovenčine ostanú', () => {
    expect(validationText('Zadaj názov receptu.')).toBe('Zadaj názov receptu.')
    setLocale('en')
    expect(validationText('Zadaj názov receptu.')).toBe('Enter a recipe name.')
    expect(validationText('Neznáma hláška')).toBe('Neznáma hláška')
  })

  it('každý kľúč v tabuľke hlášok má preklad v oboch jazykoch', () => {
    for (const key of VALIDATION_KEYS) {
      expect(te('common.validation.' + key, 'sk'), key).toBe(true)
      expect(te('common.validation.' + key, 'en'), key).toBe(true)
    }
  })

  it('vstavané hlášky zod idú v jazyku aplikácie', () => {
    const message = () => z.string().safeParse(1).error!.issues[0]!.message
    const sk = message()
    setLocale('en')
    expect(message()).not.toBe(sk)
    expect(message()).toMatch(/Invalid input/i)
  })
})

describe('predvolené názvy domácnosti', () => {
  it('v slovenčine ostávajú, v angličtine sa preložia, premenované ostanú ako zadané', () => {
    expect(slotName('Obed')).toBe('Obed')
    expect(shopCategoryName('Mäso a ryby')).toBe('Mäso a ryby')
    setLocale('en')
    expect(slotName('Obed')).toBe('Lunch')
    expect(shopCategoryName('Mäso a ryby')).toBe('Meat and fish')
    expect(slotName('Brunch')).toBe('Brunch')
    expect(shopCategoryName('Sladkosti')).toBe('Sladkosti')
  })

  it('každý predvolený názov má preklad v oboch jazykoch', () => {
    for (const key of DEFAULT_SLOT_KEYS) {
      expect(te('common.defaults.slot.' + key, 'sk'), key).toBe(true)
      expect(te('common.defaults.slot.' + key, 'en'), key).toBe(true)
    }
    for (const key of DEFAULT_SHOP_CATEGORY_KEYS) {
      expect(te('common.defaults.shopCategory.' + key, 'sk'), key).toBe(true)
      expect(te('common.defaults.shopCategory.' + key, 'en'), key).toBe(true)
    }
  })
})
