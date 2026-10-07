import { formatMinutes, plural, totalMinutes } from './format'
import { DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS, type RecipeCategory } from './recipes'
import { formatScaled } from './scaling'
import { slugify } from './text'
import type { UnitCode } from './units'

/** Údaje receptu, ktoré export potrebuje; `RecipeDetailDto` ich spĺňa. */
export interface RecipeMarkdownInput {
  title: string
  description: string | null
  category: RecipeCategory
  servings: number
  prepMinutes: number | null
  cookMinutes: number | null
  difficulty: number
  sourceUrl: string | null
  sourceText: string | null
  tags: { name: string }[]
  ingredients: {
    name: string
    quantity: number | null
    unit: UnitCode | null
    note: string | null
    groupName: string | null
    isOptional: boolean
  }[]
  steps: { text: string; timerSeconds: number | null }[]
}

export interface MarkdownOptions {
  /** Prepočítať množstvá na tento počet porcií. */
  servings?: number
}

const timerLabel = (seconds: number) => `*(časovač ${formatMinutes(Math.max(1, Math.ceil(seconds / 60)))})*`

/**
 * Recept ako Markdown: názov, údaje, popis, tagy, ingrediencie po skupinách, očíslovaný postup
 * a zdroj. Hodí sa na kopírovanie, zdieľanie aj archiváciu v textovom súbore.
 */
export function recipeToMarkdown(recipe: RecipeMarkdownInput, options: MarkdownOptions = {}): string {
  const servings = options.servings ?? recipe.servings
  const factor = recipe.servings > 0 ? servings / recipe.servings : 1

  const meta = [RECIPE_CATEGORY_LABELS[recipe.category], plural(servings, 'porcia', 'porcie', 'porcií')]
  if (recipe.prepMinutes !== null) meta.push(`príprava ${formatMinutes(recipe.prepMinutes)}`)
  if (recipe.cookMinutes !== null) meta.push(`varenie ${formatMinutes(recipe.cookMinutes)}`)
  if (recipe.prepMinutes !== null && recipe.cookMinutes !== null) {
    meta.push(`spolu ${formatMinutes(totalMinutes(recipe.prepMinutes, recipe.cookMinutes)!)}`)
  }
  meta.push(`náročnosť ${DIFFICULTY_LABELS[recipe.difficulty as 1 | 2 | 3] ?? recipe.difficulty}`)

  const lines: string[] = [`# ${recipe.title}`, '', `*${meta.join(' · ')}*`, '']
  if (recipe.description?.trim()) lines.push(recipe.description.trim(), '')
  if (recipe.tags.length) lines.push(`**Tagy:** ${recipe.tags.map((t) => `#${t.name}`).join(' ')}`, '')

  if (recipe.ingredients.length) {
    lines.push('## Ingrediencie', '')
    const groups = new Map<string, RecipeMarkdownInput['ingredients']>()
    for (const item of recipe.ingredients) {
      const key = item.groupName?.trim() ?? ''
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    for (const [name, items] of groups) {
      if (name) lines.push(`### ${name}`, '')
      for (const item of items) {
        const amount = formatScaled(item.quantity, factor, item.unit)
        const extras = [item.note, item.isOptional ? 'voliteľné' : null].filter(Boolean).join(', ')
        lines.push(`- ${amount ? `${amount} ` : ''}${item.name}${extras ? ` (${extras})` : ''}`)
      }
      lines.push('')
    }
  }

  if (recipe.steps.length) {
    lines.push('## Postup', '')
    recipe.steps.forEach((step, index) => {
      const prefix = `${index + 1}. `
      const parts = step.text.trim().split(/\r?\n/)
      const indent = ' '.repeat(prefix.length)
      const last = parts.length - 1
      parts.forEach((part, i) => {
        const timer = i === last && step.timerSeconds ? ` ${timerLabel(step.timerSeconds)}` : ''
        lines.push(`${i === 0 ? prefix : indent}${part}${timer}`)
      })
    })
    lines.push('')
  }

  if (recipe.sourceUrl) {
    lines.push(
      `Zdroj: ${recipe.sourceText ? `[${recipe.sourceText}](${recipe.sourceUrl})` : recipe.sourceUrl}`,
      '',
    )
  } else if (recipe.sourceText) {
    lines.push(`Zdroj: ${recipe.sourceText}`, '')
  }
  return lines.join('\n')
}

/** Viac receptov v jednom súbore, oddelené vodorovnou čiarou. */
export function recipesToMarkdown(recipes: readonly RecipeMarkdownInput[]): string {
  return recipes.map((r) => recipeToMarkdown(r)).join('\n---\n\n')
}

/** Názov súboru z názvu receptu: `hovadzi-gulas.md`. */
export const markdownFilename = (title: string): string => `${slugify(title)}.md`

/** Značka UTF-8 na začiatku stiahnutého súboru: bez nej Android a Windows čítajú diakritiku v inom kódovaní. */
export const UTF8_BOM = '\uFEFF'
