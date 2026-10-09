import { describe, expect, it } from 'vitest'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS } from '@shared/recipes'
import { defaultCategories } from '@/features/meal-plan/compose'
import { CATEGORY_ICONS } from '@/features/home/categoryIcons'
import { CATEGORY_SLUGS } from '@/router/urlSlugs'
import sk from '@/locales/sk/common'
import en from '@/locales/en/common'

describe('typ jedla Večera', () => {
  it('je medzi typmi jedla za Desiatou, s textami, ikonou a adresou', () => {
    expect(RECIPE_CATEGORIES.indexOf('vecera')).toBe(RECIPE_CATEGORIES.indexOf('desiata') + 1)
    expect(RECIPE_CATEGORY_LABELS.vecera).toBe('Večera')
    expect(sk.category.vecera).toBe('Večera')
    expect(en.category.vecera).toBe('Dinner')
    expect(CATEGORY_ICONS.vecera).toBeTruthy()
    expect(CATEGORY_SLUGS.vecera).toBe('dinner')
  })

  it('jedlo dňa Večera v sprievodcovi ponúka hlavné jedlá aj večere', () => {
    expect(defaultCategories('Večera')).toEqual(['hlavne', 'vecera'])
    expect(defaultCategories('Obed')).toEqual(['hlavne'])
  })
})
