/**
 * Kompletná dátová schéma pre všetky fázy (spec 2.4).
 * Tabuľky pre neskoršie fázy existujú od začiatku, aby ďalšie fázy pridávali len UI a API.
 */
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { newId } from '../../shared/ids'
import { UNIT_CODES } from '../../shared/units'
import { RECIPE_CATEGORIES, RECIPE_VISIBILITIES } from '../../shared/recipes'
import { HOUSEHOLD_ROLES, MEMBER_KINDS, PLAN_AUDIENCES } from '../../shared/family'

const nowIso = () => new Date().toISOString()

const id = () => text('id').primaryKey().$defaultFn(newId)
const createdAt = () => text('created_at').notNull().$defaultFn(nowIso)
const updatedAt = () => text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso)
const deletedAt = () => text('deleted_at')
const bool = (name: string) => integer(name, { mode: 'boolean' })
const unit = (name: string) => text(name, { enum: UNIT_CODES })

export const PREFERENCE_KINDS = ['dislike', 'allergy', 'diet'] as const
export const SHOPPING_ITEM_SOURCES = ['manual', 'generated', 'staple'] as const

// ─── Ľudia ───────────────────────────────────────────────────────────────────

export const households = sqliteTable('households', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

const householdRef = () =>
  text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' })

export const users = sqliteTable('users', {
  id: id(),
  householdId: householdRef(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  memberId: text('member_id').references((): AnySQLiteColumn => familyMembers.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Členstvo používateľa v domácnosti s rolou; človek môže byť členom viacerých domácností. */
export const householdMembers = sqliteTable(
  'household_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    householdId: householdRef(),
    role: text('role', { enum: HOUSEHOLD_ROLES }).notNull().default('member'),
    lastLoginAt: text('last_login_at'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.householdId] }),
    index('household_members_household_idx').on(t.householdId),
  ],
)

/** Nastavenia jedného používateľa (jazyk, vzhľad, predvolené filtre), nezávislé od domácnosti. */
export const userSettings = sqliteTable(
  'user_settings',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
)

export const familyMembers = sqliteTable(
  'family_members',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    kind: text('kind', { enum: MEMBER_KINDS }).notNull().default('adult'),
    birthDate: text('birth_date'),
    portionFactor: real('portion_factor').notNull().default(1),
    color: text('color'),
    isActive: bool('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('family_members_household_idx').on(t.householdId)],
)

export const memberPreferences = sqliteTable(
  'member_preferences',
  {
    id: id(),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: PREFERENCE_KINDS }).notNull(),
    ingredientId: text('ingredient_id').references((): AnySQLiteColumn => ingredients.id, {
      onDelete: 'set null',
    }),
    tagId: text('tag_id').references((): AnySQLiteColumn => tags.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('member_preferences_ingredient_idx').on(t.ingredientId)],
)

// ─── Katalóg ─────────────────────────────────────────────────────────────────

export const shopCategories = sqliteTable(
  'shop_categories',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('shop_categories_household_name_uq').on(t.householdId, t.name)],
)

export const ingredients = sqliteTable(
  'ingredients',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull(),
    defaultUnit: unit('default_unit'),
    shopCategoryId: text('shop_category_id').references(() => shopCategories.id, { onDelete: 'set null' }),
    aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex('ingredients_household_name_uq').on(t.householdId, t.nameNormalized)],
)

export const images = sqliteTable('images', {
  id: id(),
  householdId: householdRef(),
  r2Key: text('r2_key').notNull().unique(),
  mime: text('mime').notNull(),
  width: integer('width'),
  height: integer('height'),
  bytes: integer('bytes').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

// ─── Recepty ─────────────────────────────────────────────────────────────────

export const recipes = sqliteTable(
  'recipes',
  {
    id: id(),
    householdId: householdRef(),
    title: text('title').notNull(),
    titleNormalized: text('title_normalized').notNull().default(''),
    slug: text('slug').notNull(),
    description: text('description'),
    category: text('category', { enum: RECIPE_CATEGORIES }).notNull().default('hlavne'),
    servings: integer('servings').notNull().default(4),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    difficulty: integer('difficulty').notNull().default(1),
    sourceUrl: text('source_url'),
    sourceText: text('source_text'),
    /** `public` = vidia ho všetci prihlásení z každej domácnosti (nie len členovia domácnosti). */
    visibility: text('visibility', { enum: RECIPE_VISIBILITIES }).notNull().default('private'),
    coverImageId: text('cover_image_id').references(() => images.id, { onDelete: 'set null' }),
    parentRecipeId: text('parent_recipe_id').references((): AnySQLiteColumn => recipes.id, {
      onDelete: 'set null',
    }),
    variantLabel: text('variant_label'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('recipes_household_deleted_idx').on(t.householdId, t.deletedAt),
    uniqueIndex('recipes_household_slug_uq').on(t.householdId, t.slug),
  ],
)

const recipeRef = () =>
  text('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' })

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    id: id(),
    recipeId: recipeRef(),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'restrict' }),
    quantity: real('quantity'),
    unit: unit('unit'),
    note: text('note'),
    groupName: text('group_name'),
    isOptional: bool('is_optional').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('recipe_ingredients_recipe_idx').on(t.recipeId),
    index('recipe_ingredients_ingredient_idx').on(t.ingredientId),
  ],
)

export const recipeSteps = sqliteTable(
  'recipe_steps',
  {
    id: id(),
    recipeId: recipeRef(),
    position: integer('position').notNull(),
    text: text('text').notNull(),
    timerSeconds: integer('timer_seconds'),
    imageId: text('image_id').references(() => images.id, { onDelete: 'set null' }),
  },
  (t) => [uniqueIndex('recipe_steps_recipe_position_uq').on(t.recipeId, t.position)],
)

export const tags = sqliteTable(
  'tags',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('tags_household_name_uq').on(t.householdId, t.name)],
)

export const recipeTags = sqliteTable(
  'recipe_tags',
  {
    recipeId: recipeRef(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] }), index('recipe_tags_tag_idx').on(t.tagId)],
)

export const recipeFavorites = sqliteTable(
  'recipe_favorites',
  {
    recipeId: recipeRef(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.userId] })],
)

export const recipeRatings = sqliteTable(
  'recipe_ratings',
  {
    recipeId: recipeRef(),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    note: text('note'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.memberId] })],
)

export const recipeNotes = sqliteTable('recipe_notes', {
  id: id(),
  recipeId: recipeRef(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  createdAt: createdAt(),
})

export const cookLog = sqliteTable(
  'cook_log',
  {
    id: id(),
    recipeId: recipeRef(),
    cookedOn: text('cooked_on').notNull(),
    planEntryId: text('plan_entry_id').references((): AnySQLiteColumn => mealPlanEntries.id, {
      onDelete: 'set null',
    }),
    servings: real('servings'),
    createdAt: createdAt(),
  },
  (t) => [index('cook_log_recipe_idx').on(t.recipeId, t.cookedOn)],
)

// ─── Jedálniček ──────────────────────────────────────────────────────────────

export const mealSlots = sqliteTable(
  'meal_slots',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isEnabled: bool('is_enabled').notNull().default(true),
    defaultTime: text('default_time'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('meal_slots_household_name_uq').on(t.householdId, t.name)],
)

export const mealPlanEntries = sqliteTable(
  'meal_plan_entries',
  {
    id: id(),
    householdId: householdRef(),
    date: text('date').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => mealSlots.id, { onDelete: 'restrict' }),
    recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    freeText: text('free_text'),
    servingsOverride: real('servings_override'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
    audience: text('audience', { enum: PLAN_AUDIENCES }).notNull().default('all'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('meal_plan_entries_household_date_idx').on(t.householdId, t.date)],
)

export const mealPlanEntryMembers = sqliteTable(
  'meal_plan_entry_members',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => mealPlanEntries.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.memberId] })],
)

/** Pobyt návštevy: jedlá v dňoch od – do (vrátane) s ňou počítajú automaticky. */
export const guestStays = sqliteTable(
  'guest_stays',
  {
    id: id(),
    householdId: householdRef(),
    memberId: text('member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('guest_stays_household_range_idx').on(t.householdId, t.fromDate, t.toDate)],
)

export const weekTemplates = sqliteTable('week_templates', {
  id: id(),
  householdId: householdRef(),
  name: text('name').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const weekTemplateEntries = sqliteTable(
  'week_template_entries',
  {
    id: id(),
    templateId: text('template_id')
      .notNull()
      .references(() => weekTemplates.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => mealSlots.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    freeText: text('free_text'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('week_template_entries_template_idx').on(t.templateId)],
)

// ─── Nákup ───────────────────────────────────────────────────────────────────

export const shoppingLists = sqliteTable(
  'shopping_lists',
  {
    id: id(),
    householdId: householdRef(),
    name: text('name').notNull(),
    isDefault: bool('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('shopping_lists_household_name_uq').on(t.householdId, t.name)],
)

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: id(),
    listId: text('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id').references(() => ingredients.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    quantity: real('quantity'),
    unit: unit('unit'),
    shopCategoryId: text('shop_category_id').references(() => shopCategories.id, { onDelete: 'set null' }),
    isChecked: bool('is_checked').notNull().default(false),
    checkedAt: text('checked_at'),
    checkedBy: text('checked_by').references(() => users.id, { onDelete: 'set null' }),
    source: text('source', { enum: SHOPPING_ITEM_SOURCES }).notNull().default('manual'),
    generatedRangeFrom: text('generated_range_from'),
    generatedRangeTo: text('generated_range_to'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shopping_items_list_idx').on(t.listId, t.isChecked, t.sortOrder),
    index('shopping_items_list_updated_idx').on(t.listId, t.updatedAt),
    index('shopping_items_ingredient_idx').on(t.ingredientId),
  ],
)

export const shoppingItemSources = sqliteTable(
  'shopping_item_sources',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => shoppingItems.id, { onDelete: 'cascade' }),
    planEntryId: text('plan_entry_id')
      .notNull()
      .references(() => mealPlanEntries.id, { onDelete: 'cascade' }),
    recipeIngredientId: text('recipe_ingredient_id')
      .notNull()
      .references(() => recipeIngredients.id, { onDelete: 'cascade' }),
    quantityContrib: real('quantity_contrib'),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.planEntryId, t.recipeIngredientId] }),
    index('shopping_item_sources_recipe_ingredient_idx').on(t.recipeIngredientId),
  ],
)

export const stapleItems = sqliteTable(
  'staple_items',
  {
    id: id(),
    householdId: householdRef(),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    quantity: real('quantity'),
    unit: unit('unit'),
    everyNWeeks: integer('every_n_weeks').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('staple_items_ingredient_idx').on(t.ingredientId)],
)

export const pantryItems = sqliteTable(
  'pantry_items',
  {
    id: id(),
    householdId: householdRef(),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id, { onDelete: 'cascade' }),
    quantity: real('quantity'),
    unit: unit('unit'),
    location: text('location'),
    expiresOn: text('expires_on'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('pantry_items_household_ingredient_idx').on(t.householdId, t.ingredientId)],
)

// ─── Ostatné ─────────────────────────────────────────────────────────────────

export const settings = sqliteTable(
  'settings',
  {
    householdId: householdRef(),
    key: text('key').notNull(),
    value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.key] })],
)
