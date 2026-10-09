import type { ImportRecipeResultDto, RecipeAttachmentDto, RecipeDetailDto } from '@shared/api'
import type { RecipeCategory } from '@shared/recipes'
import type { RecipeInputRaw } from '@shared/schemas/recipe'
import type { UnitCode } from '@shared/units'
import { currentLocale, t, te } from '@/i18n'

/** Stav formulára: čísla sú stringy (tak, ako ich píše používateľ), riadky majú kľúč pre v-for. */
export interface IngredientRow {
  key: string
  name: string
  quantity: string
  unit: UnitCode | null
  note: string
  groupName: string
  isOptional: boolean
}

export interface StepRow {
  key: string
  text: string
  timerMinutes: string
}

export interface RecipeForm {
  title: string
  description: string
  category: RecipeCategory
  /** „Hodí sa aj ako“: ďalšie typy jedla. */
  alsoCategories: RecipeCategory[]
  /** null, keď používateľ pole vymaže – pri uložení sa použije predvolená hodnota. */
  servings: number | null
  prepMinutes: string
  cookMinutes: string
  difficulty: number
  sourceUrl: string
  sourceText: string
  /** Voľné poznámky (napr. pôvodný zápis receptu). */
  notes: string
  /** Fotky originálu (strany zo zošita) v poradí, v akom sa ukážu. */
  attachments: RecipeAttachmentDto[]
  coverImageId: string | null
  coverImageUrl: string | null
  /** Overený recept (uvarili sme a funguje). */
  isVerified: boolean
  ingredients: IngredientRow[]
  steps: StepRow[]
  tags: string[]
}

let keySeq = 0
export const rowKey = () => `row-${++keySeq}`

export const emptyIngredientRow = (): IngredientRow => ({
  key: rowKey(),
  name: '',
  quantity: '',
  unit: null,
  note: '',
  groupName: '',
  isOptional: false,
})

export const emptyStepRow = (): StepRow => ({ key: rowKey(), text: '', timerMinutes: '' })

export function emptyRecipeForm(): RecipeForm {
  return {
    title: '',
    description: '',
    category: 'hlavne',
    alsoCategories: [],
    servings: 4,
    prepMinutes: '',
    cookMinutes: '',
    difficulty: 1,
    sourceUrl: '',
    sourceText: '',
    notes: '',
    attachments: [],
    coverImageId: null,
    coverImageUrl: null,
    isVerified: false,
    ingredients: [emptyIngredientRow()],
    steps: [emptyStepRow()],
    tags: [],
  }
}

/** „1,5“, „2.25“, „1/2“ aj „1 1/2“ → číslo; prázdne → null; nezmysel → NaN. */
export function parseQuantity(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const [, whole, num, den] = mixed.map(Number) as [number, number, number, number]
    return den === 0 ? NaN : whole + num / den
  }
  const fraction = text.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const [, num, den] = fraction.map(Number) as [number, number, number]
    return den === 0 ? NaN : num / den
  }
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN
}

const intOrNull = (value: string) => {
  const text = value.trim()
  if (!text) return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n) : NaN
}

const textOrNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

/** Číslo do políčka formulára: desatinná čiarka podľa jazyka, bez oddeľovania tisícov (aby sa dalo načítať späť). */
const formatNumber = (n: number | null) =>
  n === null
    ? ''
    : new Intl.NumberFormat(currentLocale(), { useGrouping: false, maximumFractionDigits: 10 }).format(n)

export function recipeToForm(detail: RecipeDetailDto): RecipeForm {
  return {
    title: detail.title,
    description: detail.description ?? '',
    category: detail.category,
    alsoCategories: [...(detail.alsoCategories ?? [])],
    servings: detail.servings,
    prepMinutes: detail.prepMinutes === null ? '' : String(detail.prepMinutes),
    cookMinutes: detail.cookMinutes === null ? '' : String(detail.cookMinutes),
    difficulty: detail.difficulty,
    sourceUrl: detail.sourceUrl ?? '',
    sourceText: detail.sourceText ?? '',
    notes: detail.notes ?? '',
    attachments: detail.attachments ?? [],
    coverImageId: detail.coverImageId,
    coverImageUrl: detail.coverImageUrl,
    isVerified: detail.isVerified ?? false,
    ingredients: detail.ingredients.length
      ? detail.ingredients.map((i) => ({
          key: rowKey(),
          name: i.name,
          quantity: formatNumber(i.quantity),
          unit: i.unit,
          note: i.note ?? '',
          groupName: i.groupName ?? '',
          isOptional: i.isOptional,
        }))
      : [emptyIngredientRow()],
    steps: detail.steps.length
      ? detail.steps.map((s) => ({
          key: rowKey(),
          text: s.text,
          timerMinutes: s.timerSeconds === null ? '' : formatNumber(s.timerSeconds / 60),
        }))
      : [emptyStepRow()],
    tags: detail.tags.map((t) => t.name),
  }
}

export function formToInput(form: RecipeForm): RecipeInputRaw {
  return {
    title: form.title.trim(),
    description: textOrNull(form.description),
    category: form.category,
    alsoCategories: form.alsoCategories.filter((c) => c !== form.category),
    servings: form.servings ?? undefined,
    prepMinutes: intOrNull(form.prepMinutes),
    cookMinutes: intOrNull(form.cookMinutes),
    difficulty: form.difficulty,
    sourceUrl: textOrNull(form.sourceUrl),
    sourceText: textOrNull(form.sourceText),
    // Koncept uložený staršou verziou poznámky ani prílohy nemá – vtedy sa na serveri nemenia.
    notes: form.notes === undefined ? undefined : textOrNull(form.notes),
    attachmentIds: form.attachments?.map((a) => a.id),
    coverImageId: form.coverImageId,
    // Koncept zo staršej verzie príznak nemá – vtedy sa nemení.
    isVerified: form.isVerified,
    ingredients: form.ingredients
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        quantity: parseQuantity(row.quantity),
        unit: row.unit,
        note: textOrNull(row.note),
        groupName: textOrNull(row.groupName),
        isOptional: row.isOptional,
      })),
    steps: form.steps
      .filter((row) => row.text.trim())
      .map((row) => {
        const minutes = parseQuantity(row.timerMinutes)
        return {
          text: row.text.trim(),
          timerSeconds: minutes === null ? null : Math.round(minutes * 60),
        }
      }),
    tags: form.tags.map((t) => t.trim()).filter(Boolean),
  }
}

/** Preložený názov poľa (`recipes.fields.*` / `recipes.subFields.*`); neznáme pole sa ukáže pod svojím názvom. */
const label = (group: 'fields' | 'subFields', field: string): string =>
  te(`recipes.${group}.${field}`) ? t(`recipes.${group}.${field}`) : field

/**
 * Chyby zod schémy ako vety pre používateľa, napr. „Ingrediencia 2 – množstvo: …“. Názvy polí sa prekladajú,
 * samotné hlášky schémy ostávajú také, aké prišli (po slovensky zo `shared/`).
 */
export function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((issue) => {
    const [field, index, sub] = issue.path
    if ((field === 'ingredients' || field === 'steps') && typeof index === 'number') {
      const what = t(field === 'ingredients' ? 'recipes.issue.ingredient' : 'recipes.issue.step')
      const n = index + 1
      if (typeof sub === 'string') {
        return t('recipes.issue.itemField', { what, n, sub: label('subFields', sub), message: issue.message })
      }
      return t('recipes.issue.item', { what, n, message: issue.message })
    }
    const name = typeof field === 'string' ? label('fields', field) : t('recipes.issue.recipe')
    return t('recipes.issue.field', { label: name, message: issue.message })
  })
}

/** Text z hodnoty, ktorej typ schéma neurčuje (vstup môže byť čokoľvek); iné ako text je prázdny reťazec. */
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Importovaný recept (zo stránky na webe) ako formulár na kontrolu a uloženie. */
export function importToForm(result: ImportRecipeResultDto): RecipeForm {
  const r = result.recipe
  const ingredients = (r.ingredients ?? []).map((i) => ({
    key: rowKey(),
    name: i.name,
    quantity: formatNumber(i.quantity ?? null),
    unit: i.unit ?? null,
    note: textOf(i.note),
    groupName: textOf(i.groupName),
    isOptional: i.isOptional ?? false,
  }))
  const steps = (r.steps ?? []).map((s) => ({
    key: rowKey(),
    text: s.text,
    timerMinutes:
      typeof s.timerSeconds === 'number' && s.timerSeconds > 0 ? formatNumber(s.timerSeconds / 60) : '',
  }))
  return {
    title: r.title,
    description: textOf(r.description),
    category: r.category ?? 'hlavne',
    alsoCategories: [],
    servings: r.servings ?? 4,
    prepMinutes: typeof r.prepMinutes === 'number' ? String(r.prepMinutes) : '',
    cookMinutes: typeof r.cookMinutes === 'number' ? String(r.cookMinutes) : '',
    difficulty: r.difficulty ?? 1,
    sourceUrl: textOf(r.sourceUrl),
    sourceText: textOf(r.sourceText),
    notes: '',
    attachments: [],
    coverImageId: textOf(r.coverImageId) || null,
    coverImageUrl: result.coverImageUrl,
    isVerified: false,
    ingredients: ingredients.length ? ingredients : [emptyIngredientRow()],
    steps: steps.length ? steps : [emptyStepRow()],
    tags: r.tags ?? [],
  }
}
