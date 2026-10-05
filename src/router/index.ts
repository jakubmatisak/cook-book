import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/recepty' },
  {
    path: '/recepty',
    name: 'recipes',
    component: () => import('@/features/recipes/pages/RecipesPage.vue'),
    meta: { title: 'Recepty' },
  },
  {
    path: '/recepty/:id',
    name: 'recipe',
    component: () => import('@/features/recipes/pages/RecipeDetailPage.vue'),
    meta: { title: 'Recept' },
  },
  {
    path: '/plan',
    name: 'meal-plan',
    component: () => import('@/features/meal-plan/pages/MealPlanPage.vue'),
    meta: { title: 'Plán' },
  },
  {
    path: '/nakup',
    name: 'shopping',
    component: () => import('@/features/shopping/pages/ShoppingPage.vue'),
    meta: { title: 'Nákup' },
  },
  {
    path: '/viac',
    name: 'more',
    component: () => import('@/features/settings/pages/MorePage.vue'),
    meta: { title: 'Viac' },
  },
  {
    path: '/rodina',
    name: 'family',
    component: () => import('@/features/family/pages/FamilyPage.vue'),
    meta: { title: 'Rodina' },
  },
  {
    path: '/nastavenia',
    name: 'settings',
    component: () => import('@/features/settings/pages/SettingsPage.vue'),
    meta: { title: 'Nastavenia' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { title: 'Nenájdené' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : undefined
  document.title = title ? `${title} · Kuchárska kniha` : 'Kuchárska kniha'
})
