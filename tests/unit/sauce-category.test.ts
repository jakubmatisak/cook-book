import { describe, expect, it } from 'vitest'
import { mapCategory } from '@shared/import/schemaOrg'
import { RECIPE_CATEGORIES } from '@shared/recipes'
import { recipeInputSchema } from '@shared/schemas/recipe'
import { CATEGORY_ICONS } from '@/features/home/categoryIcons'
import { i18n, setLocale } from '@/i18n'
import { CATEGORY_SLUGS, categoryFromSlug } from '@/router/urlSlugs'

describe('kategória Prílohové omáčky a Pestá', () => {
  it('je medzi typmi jedla hneď za prílohou a recept s ňou sa dá uložiť', () => {
    expect(RECIPE_CATEGORIES.indexOf('omacka')).toBe(RECIPE_CATEGORIES.indexOf('priloha') + 1)
    expect(recipeInputSchema.parse({ title: 'Kôprová omáčka', category: 'omacka' }).category).toBe('omacka')
  })

  it('má anglickú adresu, ikonu a názov po slovensky aj po anglicky', () => {
    expect(CATEGORY_SLUGS.omacka).toBe('sauce')
    expect(categoryFromSlug('sauce')).toBe('omacka')
    expect(CATEGORY_ICONS.omacka).toBeTruthy()
    setLocale('sk')
    expect(i18n.global.t('common.category.omacka')).toBe('Prílohové omáčky a Pestá')
    setLocale('en')
    expect(i18n.global.t('common.category.omacka')).toBe('Sauces & pestos')
    setLocale('sk')
  })

  it('import z webu rozpozná omáčky a pestá', () => {
    expect(mapCategory('Omáčky')).toBe('omacka')
    expect(mapCategory('Sauce')).toBe('omacka')
    expect(mapCategory('Pesto')).toBe('omacka')
  })
})
