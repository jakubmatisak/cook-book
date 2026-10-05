<script setup lang="ts">
import {
  mdiBookOpenPageVariantOutline,
  mdiCheck,
  mdiFilterVariant,
  mdiFridgeOutline,
  mdiHeart,
  mdiMagnify,
  mdiPlus,
  mdiSortAscending,
  mdiSortDescending,
  mdiTable,
  mdiViewGridOutline,
  mdiWeb,
} from '@mdi/js'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  defaultSortDir,
  SORT_KEYS,
  SORT_LABELS,
  TIME_BUCKET_LABELS,
  type SortKey,
} from '@shared/recipeFacets'
import { DIFFICULTY_LABELS, RECIPE_CATEGORY_LABELS, type RecipeCategory } from '@shared/recipes'
import type { TimeBucket } from '@shared/recipeFacets'
import { useTags } from '@/api/catalog'
import { useRecipes } from '@/api/recipes'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'
import ImportRecipeDialog from '../components/ImportRecipeDialog.vue'
import RecipeCard from '../components/RecipeCard.vue'
import RecipeFilterPanel from '../components/RecipeFilterPanel.vue'
import RecipeTable from '../components/RecipeTable.vue'
import {
  activeFilterCount,
  listToParam,
  parseListQuery,
  parseRecipeView,
  stateToTableSort,
  tableSortToState,
  toggleValue,
  type FilterDimension,
  type RecipeView,
  type TableSort,
} from '../listQuery'

const route = useRoute()
const router = useRouter()

/** Filtre a zoradenie žijú v URL, aby prežili návrat z detailu a dali sa zdieľať. */
const state = computed(() => parseListQuery(route.query))

function setQuery(patch: Record<string, string | undefined>) {
  const query = { ...route.query, ...patch }
  for (const key of Object.keys(query)) if (!query[key]) delete query[key]
  void router.replace({ query })
}

const search = ref(state.value.q ?? '')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => setQuery({ q: value?.trim() || undefined }), 250)
})
watch(
  () => state.value.q,
  (q) => {
    if ((q ?? '') !== (search.value ?? '').trim()) search.value = q ?? ''
  },
)
onBeforeUnmount(() => clearTimeout(timer))

const { data: list, isPending, error } = useRecipes(state)
const { data: tags } = useTags()
const recipes = computed(() => list.value?.items)

// ─── Pohľad: mriežka alebo tabuľka (pamätá sa v prehliadači) ──────────────────
const VIEW_KEY = 'kniha:recipes-view'
const readView = (): RecipeView => {
  try {
    return parseRecipeView(localStorage.getItem(VIEW_KEY))
  } catch {
    return 'grid'
  }
}
const view = ref<RecipeView>(readView())
watch(view, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // súkromné okno a pod.
  }
})

// ─── Filtre ───────────────────────────────────────────────────────────────────
const filtersOpen = ref(false)
const importOpen = ref(false)
const filterCount = computed(() => activeFilterCount(state.value))

function toggleFilter(dimension: FilterDimension, value: string | number) {
  const s = state.value
  if (dimension === 'category') {
    setQuery({ kategoria: listToParam(toggleValue(s.category, value as RecipeCategory)) })
  } else if (dimension === 'tag') {
    setQuery({ tag: listToParam(toggleValue(s.tag, value as string)) })
  } else if (dimension === 'difficulty') {
    setQuery({ narocnost: listToParam(toggleValue(s.difficulty, value as number)) })
  } else {
    setQuery({ cas: listToParam(toggleValue(s.time, value as TimeBucket)) })
  }
}

const favorite = computed({
  get: () => state.value.favorite,
  set: (value: boolean) => setQuery({ oblubene: value ? '1' : undefined }),
})
const pantryMode = computed({
  get: () => state.value.pantry,
  set: (value: boolean) => setQuery({ doma: value ? '1' : undefined }),
})

function clearFilters() {
  setQuery({
    kategoria: undefined,
    tag: undefined,
    narocnost: undefined,
    cas: undefined,
    oblubene: undefined,
  })
}

function clearAll() {
  search.value = ''
  void router.replace({ query: {} })
}

/** Zvolené filtre ako odstrániteľné čipy nad zoznamom, aby bolo vidno, čo je zapnuté. */
const activeChips = computed(() => {
  const s = state.value
  const tagName = (id: string) => tags.value?.find((t) => t.id === id)?.name ?? id
  const chips: {
    key: string
    label: string
    dimension: FilterDimension | 'favorite'
    value: string | number
  }[] = []
  for (const c of s.category)
    chips.push({ key: `c${c}`, label: RECIPE_CATEGORY_LABELS[c], dimension: 'category', value: c })
  for (const t of s.time)
    chips.push({ key: `t${t}`, label: TIME_BUCKET_LABELS[t], dimension: 'time', value: t })
  for (const d of s.difficulty) {
    chips.push({ key: `d${d}`, label: DIFFICULTY_LABELS[d as 1 | 2 | 3], dimension: 'difficulty', value: d })
  }
  for (const t of s.tag) chips.push({ key: `g${t}`, label: `#${tagName(t)}`, dimension: 'tag', value: t })
  return chips
})

// ─── Zoradenie ────────────────────────────────────────────────────────────────
const sortItems = SORT_KEYS.map((key) => ({ title: SORT_LABELS[key], value: key }))
/** „Čo viem uvariť“ bez vlastného zoradenia radí podľa toho, čo chýba – vtedy nie je zvolený nič. */
const sortKey = computed<SortKey | null>(() => state.value.sort ?? (state.value.pantry ? null : 'name'))
const sortDir = computed(() => state.value.dir ?? defaultSortDir(sortKey.value ?? 'name'))

function setSort(key: SortKey | null) {
  setQuery({ zoradit: key ?? undefined, smer: undefined })
}
function flipSortDir() {
  setQuery({ zoradit: sortKey.value ?? 'name', smer: sortDir.value === 'asc' ? 'desc' : 'asc' })
}

const tableSort = computed<TableSort[]>({
  get: () => stateToTableSort(state.value.sort, state.value.dir),
  set: (value) => {
    const next = tableSortToState(value)
    if (next) setQuery({ zoradit: next.sort, smer: next.dir })
  },
})

const onboarding = [
  { to: '/recepty/novy', title: 'Pridaj recepty', text: 'Napíš vlastné alebo ich neskôr importuj z webu.' },
  { to: '/rodina', title: 'Pridaj rodinu', text: 'Dospelých a deti s veľkosťou porcie.' },
  { to: '/plan', title: 'Naplánuj týždeň', text: 'Recepty do raňajok, obedov a večerí.' },
  { to: '/nakup', title: 'Vygeneruj nákup', text: 'Zoznam z jedálnička podľa porcií rodiny.' },
]

const hasFilters = computed(() => Boolean(state.value.q || state.value.pantry || filterCount.value))
</script>

<template>
  <PageHeader
    title="Recepty"
    :subtitle="recipes ? plural(recipes.length, 'recept', 'recepty', 'receptov') : undefined"
  >
    <v-btn variant="tonal" :prepend-icon="mdiWeb" data-test="import-button" @click="importOpen = true">
      Importovať z webu
    </v-btn>
    <v-btn color="primary" :prepend-icon="mdiPlus" to="/recepty/novy">Nový recept</v-btn>
  </PageHeader>

  <v-alert v-if="pantryMode" type="info" density="compact" class="mb-3" :icon="mdiFridgeOutline">
    Recepty zoradené podľa toho, čo máš v
    <router-link to="/spajza" class="text-primary font-weight-bold">špajzi</router-link>. Pri každom vidíš, čo
    ti ešte chýba.
  </v-alert>

  <v-text-field
    v-model="search"
    :prepend-inner-icon="mdiMagnify"
    label="Hľadať podľa názvu alebo ingrediencie"
    clearable
    hide-details
    autocomplete="off"
    class="mb-3"
  />

  <div class="d-flex flex-wrap align-center ga-2 mb-3">
    <v-btn
      :prepend-icon="mdiFilterVariant"
      :color="filterCount ? 'primary' : undefined"
      variant="tonal"
      data-test="filters-button"
      @click="filtersOpen = true"
    >
      Filtre<template v-if="filterCount">&nbsp;({{ filterCount }})</template>
    </v-btn>
    <v-chip
      :prepend-icon="favorite ? mdiCheck : mdiHeart"
      :color="favorite ? 'primary' : undefined"
      :variant="favorite ? 'flat' : 'outlined'"
      @click="favorite = !favorite"
    >
      Obľúbené
    </v-chip>
    <v-chip
      :prepend-icon="pantryMode ? mdiCheck : mdiFridgeOutline"
      :color="pantryMode ? 'primary' : undefined"
      :variant="pantryMode ? 'flat' : 'outlined'"
      @click="pantryMode = !pantryMode"
    >
      Čo viem uvariť
    </v-chip>

    <v-spacer />

    <v-select
      :model-value="sortKey"
      :items="sortItems"
      label="Zoradiť"
      hide-details
      density="compact"
      style="max-width: 14rem"
      data-test="sort-select"
      @update:model-value="setSort"
    />
    <v-btn
      :icon="sortDir === 'asc' ? mdiSortAscending : mdiSortDescending"
      variant="tonal"
      :aria-label="
        sortDir === 'asc'
          ? 'Zoradené vzostupne, zmeniť na zostupne'
          : 'Zoradené zostupne, zmeniť na vzostupne'
      "
      @click="flipSortDir"
    />
    <v-btn-toggle
      v-model="view"
      mandatory
      density="comfortable"
      selected-class="bg-primary"
      data-test="view-toggle"
    >
      <v-btn :icon="mdiViewGridOutline" value="grid" aria-label="Zobraziť ako mriežku" />
      <v-btn :icon="mdiTable" value="table" aria-label="Zobraziť ako tabuľku" />
    </v-btn-toggle>
  </div>

  <div v-if="activeChips.length" class="d-flex flex-wrap align-center ga-2 mb-3" data-test="active-filters">
    <v-chip
      v-for="chip in activeChips"
      :key="chip.key"
      closable
      size="small"
      color="primary"
      variant="tonal"
      @click:close="toggleFilter(chip.dimension as FilterDimension, chip.value)"
    >
      {{ chip.label }}
    </v-chip>
    <v-btn size="small" variant="text" @click="clearFilters">Zrušiť filtre</v-btn>
  </div>

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
      <v-btn variant="tonal" color="primary" @click="clearAll">Zrušiť filtre</v-btn>
    </EmptyState>
    <EmptyState
      v-else
      :icon="mdiBookOpenPageVariantOutline"
      title="Vitaj v kuchárskej knihe"
      text="Začni receptami, potom pridaj rodinu a naplánuj týždeň. Nákupný zoznam sa vygeneruje sám."
    >
      <v-list lines="two" class="text-start mb-4" max-width="26rem">
        <v-list-item
          v-for="(step, i) in onboarding"
          :key="step.to"
          :to="step.to"
          :title="`${i + 1}. ${step.title}`"
          :subtitle="step.text"
        />
      </v-list>
      <v-btn color="primary" :prepend-icon="mdiPlus" to="/recepty/novy">Pridať prvý recept</v-btn>
    </EmptyState>
  </template>

  <RecipeTable v-else-if="recipes && view === 'table'" v-model:sort-by="tableSort" :items="recipes" />

  <v-row v-else-if="recipes">
    <v-col v-for="recipe in recipes" :key="recipe.id" cols="12" sm="6" lg="4">
      <RecipeCard :recipe="recipe" />
    </v-col>
  </v-row>

  <ImportRecipeDialog v-model="importOpen" />

  <RecipeFilterPanel
    v-if="list"
    v-model="filtersOpen"
    :state="state"
    :facets="list.facets"
    :tags="tags ?? []"
    :result-count="recipes?.length ?? 0"
    @toggle="toggleFilter"
    @clear="clearFilters"
  />
</template>
