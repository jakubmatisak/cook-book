<script setup lang="ts">
import { mdiBookOpenPageVariantOutline, mdiHeart, mdiMagnify, mdiPlus } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS, type RecipeCategory } from '@shared/recipes'
import { useTags } from '@/api/catalog'
import { useRecipes, type RecipeFilters } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
import PageFab from '@/components/PageFab.vue'
import RecipeCard from '../components/RecipeCard.vue'

const route = useRoute()
const router = useRouter()

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

/** Filtre žijú v URL, aby prežili návrat z detailu a dali sa zdieľať. */
const filters = computed<RecipeFilters>(() => ({
  q: str(route.query.q),
  category: RECIPE_CATEGORIES.includes(route.query.kategoria as RecipeCategory)
    ? (route.query.kategoria as RecipeCategory)
    : undefined,
  tag: str(route.query.tag),
  favorite: route.query.oblubene === '1',
}))

function setQuery(patch: Record<string, string | undefined>) {
  const query = { ...route.query, ...patch }
  for (const key of Object.keys(query)) if (!query[key]) delete query[key]
  void router.replace({ query })
}

const search = ref(filters.value.q ?? '')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => setQuery({ q: value?.trim() || undefined }), 250)
})

const { data: recipes, isPending, error } = useRecipes(filters)
const { data: tags } = useTags()

const hasFilters = computed(() => {
  const f = filters.value
  return Boolean(f.q || f.category || f.tag || f.favorite)
})

function clearFilters() {
  search.value = ''
  void router.replace({ query: {} })
}
</script>

<template>
  <div class="tw:flex tw:flex-col tw:gap-4 tw:pb-20">
    <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <h1 class="text-h5">Recepty</h1>
      <span v-if="recipes" class="text-body-2 text-medium-emphasis">{{ recipes.length }}</span>
    </div>

    <v-text-field
      v-model="search"
      :prepend-inner-icon="mdiMagnify"
      label="Hľadať podľa názvu alebo ingrediencie"
      clearable
      hide-details
      autocomplete="off"
    />

    <div class="tw:-mx-1 tw:flex tw:gap-2 tw:overflow-x-auto tw:px-1 tw:pb-1">
      <v-chip
        class="tw:shrink-0"
        :prepend-icon="mdiHeart"
        :color="filters.favorite ? 'primary' : undefined"
        :variant="filters.favorite ? 'flat' : 'outlined'"
        @click="setQuery({ oblubene: filters.favorite ? undefined : '1' })"
      >
        Obľúbené
      </v-chip>
      <v-chip
        class="tw:shrink-0"
        v-for="category in RECIPE_CATEGORIES"
        :key="category"
        :color="filters.category === category ? 'primary' : undefined"
        :variant="filters.category === category ? 'flat' : 'outlined'"
        @click="setQuery({ kategoria: filters.category === category ? undefined : category })"
      >
        {{ RECIPE_CATEGORY_LABELS[category] }}
      </v-chip>
    </div>

    <div v-if="tags?.length" class="tw:-mx-1 tw:flex tw:gap-2 tw:overflow-x-auto tw:px-1 tw:pb-1">
      <v-chip
        class="tw:shrink-0"
        v-for="tag in tags"
        :key="tag.id"
        size="small"
        :color="filters.tag === tag.id ? 'secondary' : undefined"
        :variant="filters.tag === tag.id ? 'flat' : 'tonal'"
        @click="setQuery({ tag: filters.tag === tag.id ? undefined : tag.id })"
      >
        #{{ tag.name }}
      </v-chip>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" :text="error.message" />

    <div v-else-if="isPending" class="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3">
      <v-skeleton-loader v-for="n in 6" :key="n" type="image, article" />
    </div>

    <template v-else-if="recipes && recipes.length === 0">
      <EmptyState
        v-if="hasFilters"
        :icon="mdiMagnify"
        title="Nič sa nenašlo"
        text="Skús iné slovo alebo zruš filtre."
      >
        <v-btn variant="tonal" color="primary" @click="clearFilters">Zrušiť filtre</v-btn>
      </EmptyState>
      <EmptyState
        v-else
        :icon="mdiBookOpenPageVariantOutline"
        title="Zatiaľ žiadne recepty"
        text="Pridaj prvý obľúbený recept vašej rodiny."
      >
        <v-btn color="primary" :prepend-icon="mdiPlus" to="/recepty/novy">Pridať recept</v-btn>
      </EmptyState>
    </template>

    <div v-else class="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" />
    </div>

    <PageFab :icon="mdiPlus" label="Nový recept" to="/recepty/novy" />
  </div>
</template>
