import type { HouseholdRole, MemberKind, PlanAudience } from './family'
import type { MemberPreference, PreferenceWarning } from './preferences'
import type { Suggestion } from './suggest'
import type { RecipeFacets } from './recipeFacets'
import type { RecipeCategory, RecipeVisibility } from './recipes'
import type { RecipeInputRaw } from './schemas/recipe'
import type { UnitCode } from './units'
import type { UserSettingsDto } from './userSettings'

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
  /** Rola v aktívnej domácnosti. */
  role: HouseholdRole
  /** Správca aplikácie (e-mail v ALLOWED_EMAILS): smie zakladať ďalšie domácnosti. */
  isAdmin: boolean
}

export interface HouseholdDto {
  id: string
  name: string
}

/** Člen domácnosti (prihlasovací účet, nie osoba z rodiny). `locked`: e-mail je v zozname správcov, v aplikácii sa neodoberie. */
export interface HouseholdMemberDto {
  userId: string
  email: string
  name: string
  role: HouseholdRole
  lastLoginAt: string | null
  locked: boolean
}

/** Domácnosť, v ktorej je používateľ členom, s jeho rolou. */
export interface HouseholdSummaryDto {
  id: string
  name: string
  role: HouseholdRole
}

/** Prihlásený účet pred výberom domácnosti: kým je prihlásený a či si smie založiť domácnosť. */
export interface HouseholdAccountDto {
  email: string
  canCreate: boolean
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
  /** Alergie, averzie a diéty člena (pre upozornenia pri plánovaní). */
  preferences: MemberPreference[]
}

export type { MemberPreference, PreferenceWarning }

/** Návrh „čo uvariť dnes“ s dôvodmi. */
export type SuggestionDto = Suggestion

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
  /** Štartovací zoznam surovín sa už pridal (aplikácia ho pri prvom načítaní pridá sama raz). */
  starterIngredientsAdded?: boolean
  /** Koreniny sa pri hodnotení receptov podľa špajze ignorujú (nepočítajú sa ako chýbajúce). */
  ignoreSpicesInPantry?: boolean
  [key: string]: unknown
}

export interface MeResponse {
  user: UserDto
  household: HouseholdDto
  /** Všetky domácnosti používateľa (pre prepínač). */
  households: HouseholdSummaryDto[]
  /** Nastavenia prihláseného človeka (jazyk, vzhľad, predvolené filtre). */
  userSettings: UserSettingsDto
  members: FamilyMemberDto[]
  slots: MealSlotDto[]
  settings: HouseholdSettings
}

/** Všetky tabuľky v exporte, v poradí podľa závislostí (rodičia pred deťmi). */
export const EXPORT_TABLES = [
  'households',
  'users',
  'householdMembers',
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
  'guestStays',
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
  /** „Hodí sa aj ako“: ďalšie typy jedla okrem hlavného (chýba pri starších dátach = žiadne). */
  alsoCategories?: RecipeCategory[]
  servings: number
  prepMinutes: number | null
  cookMinutes: number | null
  difficulty: number
  coverImageUrl: string | null
  tags: TagDto[]
  isFavorite: boolean
  /** Overený recept domácnosti (uvarili sme a funguje); cudzie recepty ho nemajú. */
  isVerified?: boolean
  /** Súkromný (len domácnosť) alebo verejný (vidia ho všetci prihlásení). */
  visibility: RecipeVisibility
  createdAt: string
  updatedAt: string
  /** Dátum posledného varenia (z jedálnička), alebo null, keď ešte nebolo uvarené. */
  lastCookedAt: string | null
  /** Pri filtri „čo mám doma“: povinné ingrediencie, ktoré chýbajú. */
  missing?: string[]
  /** Len pri cudzom verejnom recepte (zoznam so zapnutými verejnými): názov domácnosti, ktorá ho zverejnila. */
  householdName?: string
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

/** Príloha receptu: fotka (`id` je ID fotky) s adresou a rozmermi pre galériu. */
export interface RecipeAttachmentDto {
  id: string
  url: string
  width: number | null
  height: number | null
}

export interface RecipeDetailDto extends RecipeSummaryDto {
  description: string | null
  sourceUrl: string | null
  sourceText: string | null
  coverImageId: string | null
  /** Voľné poznámky k receptu (odhady, pôvodný zápis). */
  notes?: string | null
  /** Prílohy (fotky) v poradí galérie. */
  attachments?: RecipeAttachmentDto[]
  /** Kód odkazu na zdieľanie (`/s/<kód>`); null = recept sa nezdieľa. Len pre vlastnú domácnosť. */
  shareToken?: string | null
  ingredients: RecipeIngredientDto[]
  steps: RecipeStepDto[]
}

/** Odkaz na zdieľanie receptu: kód a cesta stránky, ktorú otvorí ktokoľvek aj bez prihlásenia. */
export interface RecipeShareDto {
  token: string
  url: string
}

/** Recept otvorený cez odkaz na zdieľanie – bez údajov domácnosti (tagy, obľúbené, špajza). */
export type SharedRecipeDto = Pick<
  RecipeDetailDto,
  | 'id'
  | 'title'
  | 'category'
  | 'servings'
  | 'prepMinutes'
  | 'cookMinutes'
  | 'difficulty'
  | 'coverImageUrl'
  | 'description'
  | 'sourceUrl'
  | 'sourceText'
  | 'notes'
  | 'ingredients'
  | 'steps'
>

/** Verejný recept v zozname Verejných receptov: autor je názov domácnosti, `ownedByMe` = patrí mojej domácnosti. */
export interface PublicRecipeSummaryDto extends RecipeSummaryDto {
  householdName: string
  ownedByMe: boolean
}

export interface PublicRecipeDetailDto extends RecipeDetailDto {
  householdName: string
  ownedByMe: boolean
}

/** Hromadná úprava či mazanie: na koľkých položkách domácnosti sa zmena uplatnila. */
export interface BulkAffectedDto {
  affected: number
}

/** Hromadné mazanie ingrediencií: koľko sa zmazalo a ktoré (použité v receptoch) sa preskočili. */
export interface IngredientBulkDeleteResult {
  deleted: number
  skipped: string[]
}

/** Pridávanie ukážkových receptov po dávkach: koľko sa práve pridalo a koľko ešte ostáva. */
export interface SampleRecipesResult {
  added: number
  remaining: number
}

/** Výsledok importu z webu: predvyplnený recept na kontrolu, fotka je už uložená v domácnosti. */
export interface ImportRecipeResultDto {
  recipe: RecipeInputRaw
  coverImageUrl: string | null
  /** Čo sa nepodarilo vyčítať (porcie, postup, fotka) – zobrazí sa pred uložením. */
  warnings: string[]
}

export interface RecipeListDto {
  items: RecipeSummaryDto[]
  /** Počty pri možnostiach filtra (podľa ostatných aktívnych filtrov). */
  facets: RecipeFacets
}

/** Koľko základných surovín domácnosti ešte chýba (ktoré nemá ani zmazané); pridanie ich pridá práve toľko. */
export interface StarterStatusDto {
  total: number
  missing: number
}

/** Výsledok pridania štartovacieho zoznamu: len naozaj pridané suroviny, aby klient nemusel sťahovať celý zoznam. */
export interface StarterIngredientsResult {
  added: number
  total: number
  items: IngredientDto[]
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
  /** Typ jedla receptu (polievka, dezert…); slúži na filter v jedálničku. */
  category: RecipeCategory
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
  /** Návštevy (osoby typu guest) vybrané ručne pri tomto jedle. */
  guestIds: string[]
  /** Všetky návštevy, ktoré sú pri tomto jedle: ručne vybrané aj tie, ktorých pobyt pokrýva deň jedla. */
  presentGuestIds: string[]
  /** Čo v tomto jedle nesedí rodine (alergia, averzia, diéta); recept sa neskrýva. */
  warnings: PreferenceWarning[]
  /** Zvyšky: položka, kde sa toto jedlo varí (nevarí sa znova, do nákupu nejde). */
  leftoverOfEntryId?: string | null
}

/** Pobyt návštevy: od – do (vrátane); jedlá v týchto dňoch s ňou počítajú automaticky. */
export interface GuestStayDto {
  id: string
  memberId: string
  fromDate: string
  toDate: string
}

export interface WeekTemplateDto {
  id: string
  name: string
  entryCount: number
}

export interface TemplateApplyResult {
  applied: number
  /** Jedlá, ktoré sa neprenesli, lebo ich recept medzitým zmizol. */
  skipped: number
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
  /** Koľko stálych položiek sa pridalo (patria medzi `added`). */
  staples: number
  /** Názvy položiek, ktoré špajza pokryla celé (do nákupu nešli), a tých, ktorým znížila množstvo. */
  covered: string[]
  reduced: string[]
}

// ─── Špajza ──────────────────────────────────────────────────────────────────

export interface PantryItemDto {
  id: string
  ingredientId: string
  name: string
  /** Bez množstva: ingrediencia je doma, ale nemeraná. */
  quantity: number | null
  unit: UnitCode | null
  /** `YYYY-MM-DD` alebo null. */
  expiresOn: string | null
  location: string | null
}

export interface PantryDto {
  ingredientIds: string[]
  items: PantryItemDto[]
}

export interface StapleDto {
  id: string
  ingredientId: string
  name: string
  quantity: number | null
  unit: UnitCode | null
  /** Rytmus: každý N-tý týždeň (1 = každý týždeň). */
  everyNWeeks: number
}
