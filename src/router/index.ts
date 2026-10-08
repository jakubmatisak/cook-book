import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { i18n, t } from '@/i18n'
import { legacyRedirect } from './legacy'
import { navigationPending, trackNavigation } from './navigationPending'
import { scrollOnNavigate } from './scroll'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/features/home/pages/HomePage.vue'),
    meta: { titleKey: 'common.nav.home' },
  },
  {
    path: '/recipes',
    name: 'recipes',
    component: () => import('@/features/recipes/pages/RecipesPage.vue'),
    meta: { titleKey: 'common.nav.recipes' },
  },
  {
    path: '/recipes/new',
    name: 'recipe-new',
    component: () => import('@/features/recipes/pages/RecipeEditPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeNew' },
  },
  {
    path: '/recipes/import',
    name: 'recipe-import',
    component: () => import('@/features/recipes/pages/ImportFromUrlPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeImport' },
  },
  {
    path: '/recipes/:id/cook',
    name: 'recipe-cooking',
    component: () => import('@/features/recipes/pages/CookingModePage.vue'),
    meta: { titleKey: 'common.pageTitle.cooking', bare: true },
  },
  {
    path: '/recipes/:id/edit',
    name: 'recipe-edit',
    component: () => import('@/features/recipes/pages/RecipeEditPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipeEdit' },
  },
  {
    path: '/recipes/:id',
    name: 'recipe',
    component: () => import('@/features/recipes/pages/RecipeDetailPage.vue'),
    meta: { titleKey: 'common.pageTitle.recipe' },
  },
  // Verejné recepty sú súčasťou zoznamu receptov (filter „Recepty od iných“).
  { path: '/public', redirect: { path: '/recipes', query: { public: 'only' } } },
  // Recept otvorený odkazom na zdieľanie – bez prihlásenia a bez menu aplikácie (App.vue).
  {
    path: '/s/:token',
    name: 'shared-recipe',
    component: () => import('@/features/recipes/pages/SharedRecipePage.vue'),
    meta: { public: true },
  },
  {
    path: '/public/:id',
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
    path: '/shopping',
    name: 'shopping',
    component: () => import('@/features/shopping/pages/ShoppingPage.vue'),
    meta: { titleKey: 'common.nav.shopping' },
  },
  {
    path: '/people',
    name: 'family',
    component: () => import('@/features/family/pages/FamilyPage.vue'),
    meta: { titleKey: 'common.nav.family' },
  },
  {
    path: '/ingredients',
    name: 'ingredients',
    component: () => import('@/features/ingredients/pages/IngredientsPage.vue'),
    meta: { titleKey: 'common.nav.ingredients' },
  },
  {
    path: '/tags',
    name: 'tags',
    component: () => import('@/features/tags/pages/TagsPage.vue'),
    meta: { titleKey: 'common.nav.tags' },
  },
  {
    path: '/pantry',
    name: 'pantry',
    component: () => import('@/features/pantry/pages/PantryPage.vue'),
    meta: { titleKey: 'common.nav.pantry' },
  },
  {
    path: '/settings',
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

trackNavigation(router, navigationPending)

/** Názov karty prehliadača: „<stránka> · <aplikácia>“ v aktuálnom jazyku. */
export function updateDocumentTitle(titleKey: unknown) {
  const app = t('common.app.name')
  document.title = typeof titleKey === 'string' ? `${t(titleKey)} · ${app}` : app
}

// Staré slovenské adresy (záložky, nainštalovaná aplikácia, staršie rozšírenie) vedú na anglické.
router.beforeEach((to) => {
  const target = legacyRedirect(to.path, to.query)
  return target
    ? { path: target.path, query: target.query as typeof to.query, hash: to.hash, replace: true }
    : true
})

router.afterEach((to) => updateDocumentTitle(to.meta.titleKey))
watch(i18n.global.locale, () => updateDocumentTitle(router.currentRoute.value.meta.titleKey))
