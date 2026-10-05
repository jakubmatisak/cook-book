import type { MemberKind, PlanAudience } from './family'
import type { RecipeFacets } from './recipeFacets'
import type { RecipeCategory } from './recipes'
import type { UnitCode } from './units'

/**
 * DTO typy API zdieľané medzi frontendom (src/) a Workerom (worker/).
 * Frontend nikdy neimportuje z worker/ – len odtiaľto.
 */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export interface UserDto {
  id: string
  email: string
  name: string
  memberId: string | null
}

export interface HouseholdDto {
  id: string
  name: string
}

export type { MemberKind }

export interface FamilyMemberDto {
  id: string
  name: string
  kind: MemberKind
  birthDate: string | null
  portionFactor: number
  color: string | null
  isActive: boolean
  sortOrder: number
}

export interface MealSlotDto {
  id: string
  name: string
  sortOrder: number
  isEnabled: boolean
  defaultTime: string | null
}

export interface HouseholdSettings {
  /** 0 = nedeľa, 1 = pondelok */
  weekStartsOn: number
  /** Predvolený koeficient porcie pre nového člena typu dieťa. */
  childPortionFactor: number
  [key: string]: unknown
}

export interface MeResponse {
  user: UserDto
  household: HouseholdDto
  members: FamilyMemberDto[]
  slots: MealSlotDto[]
  settings: HouseholdSettings
}

/** Všetky tabuľky v exporte, v poradí podľa závislostí (rodičia pred deťmi). */
export const EXPORT_TABLES = [
  'households',
  'users',
  'familyMembers',
  'shopCategories',
  'ingredients',
  'tags',
  'memberPreferences',
  'images',
  'recipes',
  'recipeIngredients',
  'recipeSteps',
  'recipeTags',
  'recipeFavorites',
  'recipeRatings',
  'recipeNotes',
  'mealSlots',
  'mealPlanEntries',
  'mealPlanEntryMembers',
  'cookLog',
  'weekTemplates',
  'weekTemplateEntries',
  'shoppingLists',
  'shoppingItems',
  'shoppingItemSources',
  'stapleItems',
  'pantryItems',
  'settings',
] as const

export type ExportTableName = (typeof EXPORT_TABLES)[number]

export interface ExportFile {
  format: 'kucharska-kniha-export'
  version: 1
  exportedAt: string
  householdId: string
  tables: Record<ExportTableName, unknown[]>
}

// ─── Recepty (fáza 1) ────────────────────────────────────────────────────────

export type { RecipeCategory }

export interface TagDto {
  id: string
  name: string
  color: string | null
  /** Počet receptov s týmto tagom (len v zozname tagov). */
  recipeCount?: number
}

export interface ImageDto {
  id: string
  url: string
}

export interface RecipeSummaryDto {
  id: string
  title: string
  slug: string
  category: RecipeCategory
  servings: number
  prepMinutes: number | null
  cookMinutes: number | null
  difficulty: number
  coverImageUrl: string | null
  tags: TagDto[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  /** Dátum posledného varenia (z jedálnička), alebo null, keď ešte nebolo uvarené. */
  lastCookedAt: string | null
  /** Pri filtri „čo mám doma“: povinné ingrediencie, ktoré chýbajú. */
  missing?: string[]
}

export interface RecipeIngredientDto {
  id: string
  ingredientId: string
  name: string
  quantity: number | null
  unit: UnitCode | null
  note: string | null
  groupName: string | null
  isOptional: boolean
  /** Ingrediencia je označená ako doma (špajza). */
  inPantry: boolean
}

export interface RecipeStepDto {
  id: string
  position: number
  text: string
  timerSeconds: number | null
}

export interface RecipeDetailDto extends RecipeSummaryDto {
  description: string | null
  sourceUrl: string | null
  sourceText: string | null
  coverImageId: string | null
  ingredients: RecipeIngredientDto[]
  steps: RecipeStepDto[]
}

export interface RecipeListDto {
  items: RecipeSummaryDto[]
  /** Počty pri možnostiach filtra (podľa ostatných aktívnych filtrov). */
  facets: RecipeFacets
}

export interface IngredientDto {
  id: string
  name: string
  defaultUnit: UnitCode | null
  shopCategoryId: string | null
  usageCount: number
}

export interface ShopCategoryDto {
  id: string
  name: string
  sortOrder: number
}

// ─── Jedálniček (fáza 2) ─────────────────────────────────────────────────────

export interface PlanEntryRecipeDto {
  id: string
  title: string
  coverImageUrl: string | null
  servings: number
  /** Recept bol po naplánovaní zmazaný. */
  deleted: boolean
}

export interface PlanEntryDto {
  id: string
  date: string
  slotId: string
  recipeId: string | null
  recipe: PlanEntryRecipeDto | null
  freeText: string | null
  servingsOverride: number | null
  note: string | null
  sortOrder: number
  audience: PlanAudience
}

export interface PlanCopyResult {
  copied: number
}

// ─── Nákup (fáza 3) ──────────────────────────────────────────────────────────

export interface ShoppingListDto {
  id: string
  name: string
  isDefault: boolean
}

export interface ShoppingItemSourceDto {
  date: string
  recipeTitle: string
  coverImageUrl: string | null
}

export interface ShoppingItemDto {
  id: string
  listId: string
  ingredientId: string | null
  name: string
  quantity: number | null
  unit: UnitCode | null
  shopCategoryId: string | null
  isChecked: boolean
  checkedAt: string | null
  source: 'manual' | 'generated' | 'staple'
  sources: ShoppingItemSourceDto[]
  updatedAt: string
}

export interface GenerateResult {
  added: number
  kept: number
  removed: number
}

// ─── Špajza ──────────────────────────────────────────────────────────────────

export interface PantryDto {
  ingredientIds: string[]
}
