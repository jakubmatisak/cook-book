import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { i18n, t } from '@/i18n'
import { scrollOnNavigate } from './scroll'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/recepty' },
  {
    path: '/recepty',
    name: 'recipes',
    component: () => import('@/features/recipes/pages/RecipesPage.vue'),
    meta: { titleKey: 'common.nav.recipes' },
  },
  {
    path: '/recepty/novy',
    name: 'recipe-new',
    component: () => import('@/features/recipes/pages/RecipeEditPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeNew' },
  },
  {
    path: '/recepty/import',
    name: 'recipe-import',
    component: () => import('@/features/recipes/pages/ImportFromUrlPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeImport' },
  },
  {
    path: '/recepty/:id/varenie',
    name: 'recipe-cooking',
    component: () => import('@/features/recipes/pages/CookingModePage.vue'),
    meta: { titleKey: 'common.pageTitle.cooking', bare: true },
  },
  {
    path: '/recepty/:id/upravit',
    name: 'recipe-edit',
    component: () => import('@/features/recipes/pages/RecipeEditPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeEdit' },
  },
  {
    path: '/recepty/:id',
    name: 'recipe',
    component: () => import('@/features/recipes/pages/RecipeDetailPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipe' },
  },
  {
    path: '/verejne',
    name: 'public-recipes',
    component: () => import('@/features/recipes/pages/PublicRecipesPage.vue'),
    meta: { titleKey: 'common.nav.publicRecipes' },
  },
  {
    path: '/verejne/:id',
    name: 'public-recipe',
    component: () => import('@/features/recipes/pages/PublicRecipePage.vue'),
    meta: { titleKey: 'common.nav.publicRecipes' },
  },
  {
    path: '/plan',
    name: 'meal-plan',
    component: () => import('@/features/meal-plan/pages/MealPlanPage.vue'),
    meta: { titleKey: 'common.nav.plan' },
  },
  {
    path: '/nakup',
    name: 'shopping',
    component: () => import('@/features/shopping/pages/ShoppingPage.vue'),
    meta: { titleKey: 'common.nav.shopping' },
  },
  { path: '/viac', redirect: '/nastavenia' },
  {
    path: '/rodina',
    name: 'family',
    component: () => import('@/features/family/pages/FamilyPage.vue'),
    meta: { titleKey: 'common.nav.family' },
  },
  {
    path: '/ingrediencie',
    name: 'ingredients',
    component: () => import('@/features/ingredients/pages/IngredientsPage.vue'),
    meta: { titleKey: 'common.nav.ingredients' },
  },
  {
    path: '/tagy',
    name: 'tags',
    component: () => import('@/features/tags/pages/TagsPage.vue'),
    meta: { titleKey: 'common.nav.tags' },
  },
  {
    path: '/spajza',
    name: 'pantry',
    component: () => import('@/features/pantry/pages/PantryPage.vue'),
    meta: { titleKey: 'common.nav.pantry' },
  },
  {
    path: '/nastavenia',
    name: 'settings',
    component: () => import('@/features/settings/pages/SettingsPage.vue'),
    meta: { titleKey: 'common.nav.settings' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { titleKey: 'common.pageTitle.notFound' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: scrollOnNavigate,
})

/** Názov karty prehliadača: „<stránka> · <aplikácia>“ v aktuálnom jazyku. */
export function updateDocumentTitle(titleKey: unknown) {
  const app = t('common.app.name')
  document.title = typeof titleKey === 'string' ? `${t(titleKey)} · ${app}` : app
}

router.afterEach((to) => updateDocumentTitle(to.meta.titleKey))
watch(i18n.global.locale, () => updateDocumentTitle(router.currentRoute.value.meta.titleKey))
