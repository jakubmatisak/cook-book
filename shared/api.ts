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

export type MemberKind = 'adult' | 'child'

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
