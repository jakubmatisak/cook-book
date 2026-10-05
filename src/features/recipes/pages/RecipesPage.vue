<script setup lang="ts">
import { mdiBookOpenPageVariantOutline, mdiHeart, mdiMagnify, mdiPlus } from '@mdi/js'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS, type RecipeCategory } from '@shared/recipes'
import { useTags } from '@/api/catalog'
import { useRecipes, type RecipeFilters } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'
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
watch(
  () => filters.value.q,
  (q) => {
    if ((q ?? '') !== (search.value ?? '').trim()) search.value = q ?? ''
  },
)
onBeforeUnmount(() => clearTimeout(timer))

const { data: recipes, isPending, error } = useRecipes(filters)
const { data: tags } = useTags()

const category = computed({
  get: () => filters.value.category ?? null,
  set: (value: RecipeCategory | null | undefined) => setQuery({ kategoria: value ?? undefined }),
})
const tag = computed({
  get: () => filters.value.tag ?? null,
  set: (value: string | null | undefined) => setQuery({ tag: value ?? undefined }),
})
const favorite = computed({
  get: () => filters.value.favorite,
  set: (value: boolean) => setQuery({ oblubene: value ? '1' : undefined }),
})

const hasFilters = computed(() =>
  Boolean(filters.value.q || filters.value.category || filters.value.tag || filters.value.favorite),
)

function clearFilters() {
  search.value = ''
  void router.replace({ query: {} })
}
</script>

<template>
  <PageHeader
    title="Recepty"
    :subtitle="recipes ? plural(recipes.length, 'recept', 'recepty', 'receptov') : undefined"
  >
    <v-btn color="primary" :prepend-icon="mdiPlus" to="/recepty/novy">Nový recept</v-btn>
  </PageHeader>

  <v-text-field
    v-model="search"
    :prepend-inner-icon="mdiMagnify"
    label="Hľadať podľa názvu alebo ingrediencie"
    clearable
    hide-details
    autocomplete="off"
    class="mb-3"
  />

  <div class="d-flex flex-wrap align-center ga-1 mb-1">
    <v-chip
      :prepend-icon="mdiHeart"
      :color="favorite ? 'primary' : undefined"
      :variant="favorite ? 'flat' : 'outlined'"
      class="me-1"
      @click="favorite = !favorite"
    >
      Obľúbené
    </v-chip>
    <v-chip-group v-model="category" column selected-class="text-primary">
      <v-chip v-for="c in RECIPE_CATEGORIES" :key="c" :value="c" filter variant="outlined">
        {{ RECIPE_CATEGORY_LABELS[c] }}
      </v-chip>
    </v-chip-group>
  </div>

  <v-chip-group v-if="tags?.length" v-model="tag" column selected-class="text-secondary" class="mb-3">
    <v-chip v-for="t in tags" :key="t.id" :value="t.id" filter size="small" variant="tonal" color="secondary">
      #{{ t.name }}
    </v-chip>
  </v-chip-group>

  <v-alert v-if="error" type="error" :text="error.message" />

  <v-row v-else-if="isPending">
    <v-col v-for="n in 6" :key="n" cols="12" sm="6" lg="4">
      <v-skeleton-loader type="image, article" />
    </v-col>
  </v-row>

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

  <v-row v-else>
    <v-col v-for="recipe in recipes" :key="recipe.id" cols="12" sm="6" lg="4">
      <RecipeCard :recipe="recipe" />
    </v-col>
  </v-row>
</template>
