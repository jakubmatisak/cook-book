<script setup lang="ts">
import { mdiEarth, mdiMagnify } from '@mdi/js'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@shared/recipes'
import { usePublicRecipes } from '@/api/publicRecipes'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { errorText } from '@/i18n/errors'
import PublicRecipeCard from '../components/PublicRecipeCard.vue'

const { t } = useI18n()

// Hľadanie sa po krátkej pauze v písaní prenesie do dotazu; typy jedla sú čipy nad zoznamom.
const search = ref('')
const query = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (query.value = (value ?? '').trim()), 250)
})
onBeforeUnmount(() => clearTimeout(timer))

const categories = ref<RecipeCategory[]>([])
const filters = computed(() => ({ q: query.value || undefined, category: categories.value }))
const { data: recipes, isPending, error } = usePublicRecipes(filters)

const hasFilters = computed(() => Boolean(query.value) || categories.value.length > 0)
const categoryItems = RECIPE_CATEGORIES.map((value) => value)
</script>

<template>
  <PageHeader :title="t('publicRecipes.title')" :subtitle="t('publicRecipes.subtitle')" />

  <v-text-field
    v-model="search"
    :prepend-inner-icon="mdiMagnify"
    :label="t('publicRecipes.search')"
    clearable
    hide-details
    autocomplete="off"
    class="mb-3"
    data-test="public-search"
  />
  <v-chip-group
    v-model="categories"
    multiple
    filter
    color="primary"
    class="mb-3"
    :aria-label="t('publicRecipes.categories')"
    data-test="public-categories"
  >
    <v-chip v-for="c in categoryItems" :key="c" :value="c" variant="outlined" filter>
      {{ t(`common.category.${c}`) }}
    </v-chip>
  </v-chip-group>

  <v-alert v-if="error" type="error" :text="errorText(error)" />
  <v-skeleton-loader v-else-if="isPending" type="card@3" />
  <EmptyState
    v-else-if="!recipes?.length"
    :icon="hasFilters ? mdiMagnify : mdiEarth"
    :title="hasFilters ? t('publicRecipes.emptyFiltered.title') : t('publicRecipes.empty.title')"
    :text="hasFilters ? t('publicRecipes.emptyFiltered.text') : t('publicRecipes.empty.text')"
  />
  <v-row v-else>
    <v-col v-for="recipe in recipes" :key="recipe.id" cols="12" sm="6" lg="4">
      <PublicRecipeCard :recipe="recipe" />
    </v-col>
  </v-row>
</template>
