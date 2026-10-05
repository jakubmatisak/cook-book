import { describe, expect, it } from 'vitest'
import type { RecipeDetailDto } from '@shared/api'
import { recipeInputSchema } from '@shared/schemas/recipe'
import {
  describeIssues,
  emptyRecipeForm,
  formToInput,
  parseQuantity,
  recipeToForm,
} from '@/features/recipes/form'

describe('parseQuantity', () => {
  it('prijme desatinnú čiarku, bodku a zlomok', () => {
    expect(parseQuantity('1,5')).toBe(1.5)
    expect(parseQuantity(' 2.25 ')).toBe(2.25)
    expect(parseQuantity('1/2')).toBe(0.5)
    expect(parseQuantity('1 1/2')).toBe(1.5)
  })

  it('prázdne je null, nezmysel je NaN (schéma ho odmietne)', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
    expect(parseQuantity('trochu')).toBeNaN()
    expect(parseQuantity('1/0')).toBeNaN()
  })
})

describe('formulár receptu', () => {
  it('prázdny formulár má jeden riadok ingrediencie a jeden krok', () => {
    const form = emptyRecipeForm()
    expect(form.ingredients).toHaveLength(1)
    expect(form.steps).toHaveLength(1)
    expect(form.servings).toBe(4)
    expect(form.category).toBe('hlavne')
  })

  it('formToInput vynechá prázdne riadky, prevedie čísla a minúty časovača', () => {
    const form = emptyRecipeForm()
    form.title = '  Guláš '
    form.prepMinutes = '20'
    form.cookMinutes = ''
    form.sourceUrl = '  '
    form.ingredients = [
      { key: 'a', name: 'Cibuľa', quantity: '1,5', unit: 'ks', note: '', groupName: '', isOptional: false },
      { key: 'b', name: '   ', quantity: '3', unit: 'g', note: '', groupName: '', isOptional: false },
      {
        key: 'c',
        name: 'Soľ',
        quantity: '',
        unit: null,
        note: 'podľa chuti',
        groupName: '',
        isOptional: true,
      },
    ]
    form.steps = [
      { key: 'x', text: 'Krok jedna', timerMinutes: '10' },
      { key: 'y', text: '  ', timerMinutes: '' },
    ]
    form.tags = ['Rýchle']

    const input = formToInput(form)
    expect(input).toMatchObject({
      title: 'Guláš',
      prepMinutes: 20,
      cookMinutes: null,
      sourceUrl: null,
      tags: ['Rýchle'],
    })
    expect(input.ingredients).toEqual([
      { name: 'Cibuľa', quantity: 1.5, unit: 'ks', note: null, groupName: null, isOptional: false },
      { name: 'Soľ', quantity: null, unit: null, note: 'podľa chuti', groupName: null, isOptional: true },
    ])
    expect(input.steps).toEqual([{ text: 'Krok jedna', timerSeconds: 600 }])
    expect(recipeInputSchema.safeParse(input).success).toBe(true)
  })

  it('recipeToForm a späť zachová obsah receptu', () => {
    const detail: RecipeDetailDto = {
      id: 'r1',
      title: 'Guláš',
      slug: 'gulas',
      category: 'polievka',
      servings: 6,
      prepMinutes: 15,
      cookMinutes: null,
      difficulty: 3,
      coverImageUrl: '/img/default/x.webp',
      coverImageId: 'x',
      tags: [{ id: 't1', name: 'Klasika', color: null }],
      isFavorite: true,
      updatedAt: 'x',
      createdAt: 'x',
      description: 'Popis',
      sourceUrl: 'https://example.com/gulas',
      sourceText: null,
      ingredients: [
        {
          id: 'i1',
          ingredientId: 'g1',
          name: 'Mäso',
          quantity: 0.75,
          unit: 'kg',
          note: null,
          groupName: 'Základ',
          isOptional: false,
          inPantry: false,
        },
      ],
      steps: [{ id: 's1', position: 1, text: 'Var.', timerSeconds: 90 }],
    }
    const input = formToInput(recipeToForm(detail))
    expect(input).toEqual({
      title: 'Guláš',
      description: 'Popis',
      category: 'polievka',
      servings: 6,
      prepMinutes: 15,
      cookMinutes: null,
      difficulty: 3,
      sourceUrl: 'https://example.com/gulas',
      sourceText: null,
      coverImageId: 'x',
      ingredients: [
        { name: 'Mäso', quantity: 0.75, unit: 'kg', note: null, groupName: 'Základ', isOptional: false },
      ],
      steps: [{ text: 'Var.', timerSeconds: 90 }],
      tags: ['Klasika'],
    })
  })
})

describe('describeIssues', () => {
  it('preloží cestu chyby na ľudský popis', () => {
    const form = emptyRecipeForm()
    form.title = ''
    form.ingredients = [
      { key: 'a', name: 'Múka', quantity: '1', unit: 'kg', note: '', groupName: '', isOptional: false },
      { key: 'b', name: 'Cukor', quantity: 'veľa', unit: 'g', note: '', groupName: '', isOptional: false },
    ]
    const result = recipeInputSchema.safeParse(formToInput(form))
    expect(result.success).toBe(false)
    const messages = describeIssues(result.error!.issues)
    expect(messages).toContain('Názov: Zadaj názov receptu.')
    expect(messages.some((m) => m.startsWith('Ingrediencia 2 – množstvo:'))).toBe(true)
  })
})

describe('vymazané porcie', () => {
  it('prázdne pole porcií neblokuje uloženie a použije predvolené 4', () => {
    const form = emptyRecipeForm()
    form.title = 'Polievka'
    form.servings = null
    const parsed = recipeInputSchema.safeParse(formToInput(form))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.servings).toBe(4)
  })
})
