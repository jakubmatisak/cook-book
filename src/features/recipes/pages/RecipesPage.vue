<script setup lang="ts">
import {
  mdiBookOpenPageVariantOutline,
  mdiCheck,
  mdiCheckboxMarkedOutline,
  mdiFilterVariant,
  mdiFridgeOutline,
  mdiHeart,
  mdiMagnify,
  mdiPlus,
  mdiSortAscending,
  mdiSortDescending,
  mdiViewGridOutline,
  mdiViewHeadline,
  mdiWeb,
} from '@mdi/js'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { defaultSortDir, SORT_KEYS, type SortKey } from '@shared/recipeFacets'
import type { RecipeCategory } from '@shared/recipes'
import type { TimeBucket } from '@shared/recipeFacets'
import { useTags } from '@/api/catalog'
import { useMe } from '@/api/me'
import { useRecipes } from '@/api/recipes'
import { useKidsEnabled } from '@/composables/useKidsEnabled'
import { useControlHeight } from '@/composables/useDensity'
import { useSaveUserSettings } from '@/api/userSettings'
import EmptyState from '@/components/EmptyState.vue'
import ActionButton from '@/components/ActionButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import ListLayout from '@/components/ListLayout.vue'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import { useBulkDeleteRecipes } from '@/api/bulk'
import BulkBar from '@/components/BulkBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useSelection } from '@/composables/useSelection'
import ImportRecipeDialog from '../components/ImportRecipeDialog.vue'
import RecipeBulkEditDialog from '../components/RecipeBulkEditDialog.vue'
import RecipeCard from '../components/RecipeCard.vue'
import RecipeFilterPanel from '../components/RecipeFilterPanel.vue'
import RecipeQuickFilters from '../components/RecipeQuickFilters.vue'
import RecipeTable from '../components/RecipeTable.vue'
import {
  activeFilterCount,
  categoriesToParam,
  listToParam,
  timesToParam,
  parseListQuery,
  queryToRestore,
  savableListQuery,
  parseRecipeView,
  stateToTableSort,
  tableSortToState,
  toggleValue,
  type FilterDimension,
  type KidsMode,
  type PublicMode,
  type RecipeView,
  type TableSort,
} from '../listQuery'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()
// Tlačidlá v riadku s poľami majú výšku poľa podľa hustoty rozhrania.
const controlHeight = useControlHeight()

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

const kidsEnabled = useKidsEnabled()
// Pri vypnutých detských jedlách (nastavenia) sa prepínač ani parameter `detske` neuplatnia.
const listFilters = computed(() =>
  kidsEnabled.value ? state.value : { ...state.value, kids: 'hide' as const },
)
const { data: list, isPending, error } = useRecipes(listFilters)
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

// ─── Pamätanie na používateľa: pohľad a predvolené filtre ─────────────────────
// Po načítaní nastavení sa vrátia uložené filtre (len keď adresa nenesie žiadny) a pohľad; zmeny sa ukladajú.
const { data: me } = useMe()
const saveSettings = useSaveUserSettings()
const settingsRestored = ref(false)
watch(
  () => me.value?.userSettings,
  (settings) => {
    if (!settings || settingsRestored.value) return
    settingsRestored.value = true
    const restore = queryToRestore(route.query, settings.recipeQuery)
    if (restore) void router.replace({ query: { ...route.query, ...restore } })
    if (settings.recipeView) view.value = settings.recipeView
  },
  { immediate: true },
)

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => JSON.stringify(savableListQuery(route.query)),
  (serialized) => {
    if (!settingsRestored.value) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const wanted = savableListQuery(route.query)
      const stored = me.value?.userSettings.recipeQuery
      if (JSON.stringify(wanted) !== JSON.stringify(stored ?? null))
        saveSettings.mutate({ recipeQuery: wanted })
    }, 800)
    void serialized
  },
)
onBeforeUnmount(() => clearTimeout(saveTimer))

watch(view, (value) => {
  if (settingsRestored.value && value !== (me.value?.userSettings.recipeView ?? 'grid')) {
    saveSettings.mutate({ recipeView: value })
  }
})

// ─── Filtre ───────────────────────────────────────────────────────────────────
const filtersOpen = ref(false)
const importOpen = ref(false)
/** „Čo viem uvariť“: všetky recepty / len tie, čo viem uvariť / aj tie, kde chýba jedna surovina. */
const setMissing = (value: string | number) =>
  setQuery({ missing: value === 'all' ? undefined : String(value) })
const canCook = computed(() => list.value?.facets.missing[0] ?? 0)
const missingOne = computed(() => canCook.value + (list.value?.facets.missing[1] ?? 0))
const filterCount = computed(() => activeFilterCount(state.value))
/** Detské a cudzie recepty sú v paneli Filtre, preto sa rátajú do čísla na tlačidle. */
const panelFilterCount = computed(
  () => filterCount.value + (state.value.kids !== 'hide' ? 1 : 0) + (state.value.public !== 'hide' ? 1 : 0),
)
/** Na mobile je v paneli aj „Čo viem uvariť“. */
const mobileFilterCount = computed(() => panelFilterCount.value + (state.value.pantry ? 1 : 0))

function toggleFilter(dimension: FilterDimension, value: string | number) {
  const s = state.value
  if (dimension === 'category') {
    setQuery({ category: categoriesToParam(toggleValue(s.category, value as RecipeCategory)) })
  } else if (dimension === 'tag') {
    setQuery({ tag: listToParam(toggleValue(s.tag, value as string)) })
  } else if (dimension === 'difficulty') {
    setQuery({ difficulty: listToParam(toggleValue(s.difficulty, value as number)) })
  } else {
    setQuery({ time: timesToParam(toggleValue(s.time, value as TimeBucket)) })
  }
}

const favorite = computed({
  get: () => state.value.favorite,
  set: (value: boolean) => setQuery({ favorites: value ? '1' : undefined }),
})
const KIDS_PARAMS = { hide: undefined, include: 'include', only: 'only' } as const
const kids = computed({
  get: () => state.value.kids,
  set: (value: KidsMode) => setQuery({ kids: KIDS_PARAMS[value] }),
})
const KIDS_MODES: readonly KidsMode[] = ['hide', 'include', 'only']
const PUBLIC_PARAMS = { hide: undefined, include: 'include', only: 'only' } as const
const publicMode = computed({
  get: () => state.value.public,
  set: (value: PublicMode) => setQuery({ public: PUBLIC_PARAMS[value] }),
})
const publicItems = computed(() =>
  KIDS_MODES.map((mode) => ({ value: mode, title: t(`recipes.list.public_${mode}`) })),
)
const kidsItems = computed(() =>
  KIDS_MODES.map((mode) => ({ value: mode, title: t(`recipes.list.kids_${mode}`) })),
)
const pantryMode = computed({
  get: () => state.value.pantry,
  set: (value: boolean) => setQuery({ pantry: value ? '1' : undefined, missing: undefined }),
})

function clearFilters() {
  setQuery({
    category: undefined,
    tag: undefined,
    difficulty: undefined,
    time: undefined,
    favorites: undefined,
  })
}

/** Úplný reset: všetky filtre, „Čo viem uvariť“, obľúbené aj zoradenie späť na predvolené (vymaže sa aj uložené). */
function resetAll() {
  setQuery({
    category: undefined,
    tag: undefined,
    difficulty: undefined,
    time: undefined,
    favorites: undefined,
    kids: undefined,
    public: undefined,
    pantry: undefined,
    missing: undefined,
    sort: undefined,
    dir: undefined,
  })
}

const hasSavedState = computed(() => savableListQuery(route.query) !== null)

function clearAll() {
  search.value = ''
  void router.replace({ query: {} })
}

/** Zvolené filtre ako odstrániteľné čipy nad zoznamom, aby bolo vidno, čo je zapnuté. */
const activeChips = computed(() => {
  const s = state.value
  const tagName = (id: string) => tags.value?.find((tag) => tag.id === id)?.name ?? id
  const chips: {
    key: string
    label: string
    dimension: FilterDimension | 'kids' | 'public'
    value: string | number
  }[] = []
  if (s.kids !== 'hide')
    chips.push({ key: 'kids', label: t(`recipes.list.kids_${s.kids}`), dimension: 'kids', value: s.kids })
  if (s.public !== 'hide')
    chips.push({
      key: 'public',
      label: t(`recipes.list.public_${s.public}`),
      dimension: 'public',
      value: s.public,
    })
  for (const c of s.category)
    chips.push({ key: `c${c}`, label: t(`common.category.${c}`), dimension: 'category', value: c })
  for (const tb of s.time)
    chips.push({ key: `t${tb}`, label: t(`common.timeBucket.${tb}`), dimension: 'time', value: tb })
  for (const d of s.difficulty) {
    chips.push({ key: `d${d}`, label: t(`common.difficulty.${d}`), dimension: 'difficulty', value: d })
  }
  for (const tag of s.tag)
    chips.push({ key: `g${tag}`, label: `#${tagName(tag)}`, dimension: 'tag', value: tag })
  return chips
})

function removeChip(chip: { dimension: FilterDimension | 'kids' | 'public'; value: string | number }) {
  if (chip.dimension === 'kids') kids.value = 'hide'
  else if (chip.dimension === 'public') publicMode.value = 'hide'
  else toggleFilter(chip.dimension, chip.value)
}

// ─── Zoradenie ────────────────────────────────────────────────────────────────
const sortItems = computed(() => SORT_KEYS.map((key) => ({ title: t(`common.sort.${key}`), value: key })))
/** „Čo viem uvariť“ bez vlastného zoradenia radí podľa toho, čo chýba – vtedy nie je zvolený nič. */
const sortKey = computed<SortKey | null>(() => state.value.sort ?? (state.value.pantry ? null : 'name'))
const sortDir = computed(() => state.value.dir ?? defaultSortDir(sortKey.value ?? 'name'))

function setSort(key: SortKey | null) {
  setQuery({ sort: key ?? undefined, dir: undefined })
}
function flipSortDir() {
  setQuery({ sort: sortKey.value ?? 'name', dir: sortDir.value === 'asc' ? 'desc' : 'asc' })
}

const tableSort = computed<TableSort[]>({
  // „Čo viem uvariť“ bez vlastného zoradenia radí server podľa chýbajúceho, takže šípka nesmie ukazovať názov.
  get: () =>
    state.value.pantry && !state.value.sort ? [] : stateToTableSort(state.value.sort, state.value.dir),
  set: (value) => {
    const next = tableSortToState(value)
    if (next) setQuery({ sort: next.sort, dir: next.dir })
  },
})

const onboarding = computed(() =>
  [
    { to: '/recipes/new', key: 'recipes' },
    { to: '/people', key: 'family' },
    { to: '/plan', key: 'plan' },
    { to: '/shopping', key: 'shopping' },
  ].map(({ to, key }) => ({
    to,
    title: t(`recipes.list.onboarding.${key}.title`),
    text: t(`recipes.list.onboarding.${key}.text`),
  })),
)

// ─── Hromadné úpravy: výber zaškrtávacími poľami, úprava a mazanie ───────────
const selection = useSelection()
// Hromadne sa upravujú a mažú len recepty domácnosti, nie cudzie verejné.
const visibleIds = computed(() => recipes.value?.filter((r) => !r.householdName).map((r) => r.id) ?? [])
watch(visibleIds, (ids) => selection.keepOnly(ids))
const bulkEditOpen = ref(false)
const bulkDeleteOpen = ref(false)
const bulkDelete = useBulkDeleteRecipes()
const bulkSnackbar = ref({ show: false, text: '', color: 'success' })
const notifyBulk = (text: string, color = 'success') => (bulkSnackbar.value = { show: true, text, color })
async function onBulkDelete() {
  try {
    const deleted = await bulkDelete.mutateAsync(selection.selected.value)
    bulkDeleteOpen.value = false
    selection.stop()
    notifyBulk(t('bulk.recipes.deleted', { recipes: tc('common.plural.recipes', deleted) }))
  } catch (e) {
    bulkDeleteOpen.value = false
    notifyBulk(errorText(e, 'bulk.recipes.deleteFailed'), 'error')
  }
}
function onBulkEdited(affected: number) {
  selection.clear()
  notifyBulk(t('bulk.recipes.updated', { recipes: tc('common.plural.recipes', affected) }))
}

const hasFilters = computed(() => Boolean(state.value.q || state.value.pantry || filterCount.value))
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader
        :title="t('recipes.list.title')"
        :subtitle="recipes && mdAndUp ? tc('common.plural.recipes', recipes.length) : undefined"
      >
        <ActionButton
          :icon="mdiWeb"
          :label="t('recipes.list.importFromWeb')"
          variant="tonal"
          data-test="import-button"
          @click="importOpen = true"
        />
        <ActionButton
          :icon="mdiPlus"
          :label="t('recipes.list.newRecipe')"
          color="primary"
          to="/recipes/new"
        />
      </PageHeader>

      <v-alert
        v-if="pantryMode && mdAndUp"
        type="info"
        density="compact"
        class="mb-3"
        :icon="mdiFridgeOutline"
        data-test="pantry-hint"
      >
        <I18nT keypath="recipes.list.pantryHint" scope="global" tag="span">
          <template #pantry>
            <router-link to="/pantry" class="text-primary font-weight-bold">{{
              t('recipes.list.pantryLink')
            }}</router-link>
          </template>
        </I18nT>
      </v-alert>

      <v-btn-toggle
        v-if="pantryMode && mdAndUp"
        :model-value="state.missing ?? 'all'"
        mandatory
        grow
        selected-class="bg-primary"
        class="mb-3 w-100"
        data-test="missing-toggle"
        @update:model-value="setMissing"
      >
        <v-btn value="all">{{ t('recipes.list.missingAll') }}</v-btn>
        <v-btn :value="0">{{ t('recipes.list.missingCanCook', { n: canCook }) }}</v-btn>
        <v-btn :value="1">{{ t('recipes.list.missingMaxOne', { n: missingOne }) }}</v-btn>
      </v-btn-toggle>

      <div class="d-flex align-center ga-2 mb-3">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          :label="t('recipes.list.search')"
          clearable
          hide-details
          autocomplete="off"
        />
        <template v-if="!mdAndUp">
          <v-badge :model-value="mobileFilterCount > 0" :content="mobileFilterCount" color="primary">
            <v-btn
              :icon="mdiFilterVariant"
              variant="tonal"
              :height="controlHeight"
              :width="controlHeight"
              :color="mobileFilterCount ? 'primary' : undefined"
              :aria-label="t('recipes.list.filters')"
              data-test="filters-button"
              @click="filtersOpen = true"
            />
          </v-badge>
          <v-btn
            :icon="mdiCheckboxMarkedOutline"
            :variant="selection.active.value ? 'flat' : 'tonal'"
            :color="selection.active.value ? 'primary' : undefined"
            :height="controlHeight"
            :width="controlHeight"
            :aria-label="t('bulk.select')"
            data-test="select-mode"
            @click="selection.active.value ? selection.stop() : selection.start()"
          />
        </template>
      </div>

      <div v-if="mdAndUp" class="d-flex flex-row flex-wrap align-center ga-2 mb-3">
        <div class="d-flex flex-wrap align-center ga-2">
          <v-btn
            :prepend-icon="mdiFilterVariant"
            :color="filterCount ? 'primary' : undefined"
            variant="tonal"
            :height="controlHeight"
            data-test="filters-button"
            @click="filtersOpen = true"
          >
            {{ t('recipes.list.filters')
            }}<template v-if="panelFilterCount">&nbsp;({{ panelFilterCount }})</template>
          </v-btn>
          <v-btn
            :prepend-icon="favorite ? mdiCheck : mdiHeart"
            :color="favorite ? 'primary' : undefined"
            :variant="favorite ? 'flat' : 'outlined'"
            :height="controlHeight"
            data-test="favorite-toggle"
            @click="favorite = !favorite"
          >
            {{ t('recipes.list.favorites') }}
          </v-btn>
          <v-btn
            :prepend-icon="pantryMode ? mdiCheck : mdiFridgeOutline"
            :color="pantryMode ? 'primary' : undefined"
            :variant="pantryMode ? 'flat' : 'outlined'"
            :height="controlHeight"
            data-test="pantry-toggle"
            @click="pantryMode = !pantryMode"
          >
            {{ t('recipes.list.canCook') }}
          </v-btn>
        </div>

        <div class="d-flex flex-nowrap align-center ga-2 ms-auto">
          <v-select
            :model-value="sortKey"
            :items="sortItems"
            :label="t('recipes.list.sort')"
            hide-details
            class="flex-grow-1"
            style="min-width: 10rem; max-width: 14rem"
            data-test="sort-select"
            @update:model-value="setSort"
          />
          <v-btn
            :icon="sortDir === 'asc' ? mdiSortAscending : mdiSortDescending"
            variant="tonal"
            :height="controlHeight"
            :width="controlHeight"
            :aria-label="sortDir === 'asc' ? t('recipes.list.sortAsc') : t('recipes.list.sortDesc')"
            @click="flipSortDir"
          />
          <v-btn-toggle
            v-model="view"
            mandatory
            selected-class="bg-primary"
            class="flex-shrink-0"
            :style="{ height: `${controlHeight}px` }"
            data-test="view-toggle"
          >
            <v-btn
              :icon="mdiViewGridOutline"
              value="grid"
              :height="controlHeight"
              :width="controlHeight"
              :aria-label="t('recipes.list.viewGrid')"
            />
            <v-btn
              :icon="mdiViewHeadline"
              value="table"
              :height="controlHeight"
              :width="controlHeight"
              :aria-label="t('recipes.list.viewTable')"
            />
          </v-btn-toggle>
          <v-btn
            :icon="mdiCheckboxMarkedOutline"
            :variant="selection.active.value ? 'flat' : 'tonal'"
            :color="selection.active.value ? 'primary' : undefined"
            :height="controlHeight"
            :width="controlHeight"
            :aria-label="t('bulk.select')"
            data-test="select-mode"
            @click="selection.active.value ? selection.stop() : selection.start()"
          />
        </div>
      </div>

      <BulkBar
        v-if="selection.active.value"
        :count="selection.count.value"
        :total="visibleIds.length"
        @select-all="selection.set(visibleIds)"
        @clear="selection.clear()"
        @close="selection.stop()"
        @edit="bulkEditOpen = true"
        @remove="bulkDeleteOpen = true"
      />

      <div
        v-if="activeChips.length || hasSavedState"
        class="d-flex flex-wrap align-center ga-2 mb-3"
        data-test="active-filters"
      >
        <v-chip
          v-for="chip in activeChips"
          :key="chip.key"
          closable
          size="small"
          color="primary"
          variant="tonal"
          @click:close="removeChip(chip)"
        >
          {{ chip.label }}
        </v-chip>
        <v-btn size="small" variant="text" data-test="reset-filters" @click="resetAll">{{
          t('recipes.list.resetFilters')
        }}</v-btn>
      </div>
    </template>

    <v-alert v-if="error" type="error" :text="errorText(error)" />

    <v-row v-else-if="isPending">
      <v-col v-for="n in 6" :key="n" cols="12" sm="6" lg="4">
        <v-skeleton-loader type="image, article" />
      </v-col>
    </v-row>

    <template v-else-if="recipes && recipes.length === 0">
      <EmptyState
        v-if="hasFilters"
        :icon="mdiMagnify"
        :title="t('recipes.list.nothingFoundTitle')"
        :text="t('recipes.list.nothingFoundText')"
      >
        <v-btn variant="tonal" color="primary" @click="clearAll">{{ t('recipes.list.clearFilters') }}</v-btn>
      </EmptyState>
      <EmptyState
        v-else
        :icon="mdiBookOpenPageVariantOutline"
        :title="t('recipes.list.welcomeTitle')"
        :text="t('recipes.list.welcomeText')"
      >
        <div class="d-flex flex-column align-center w-100">
          <v-list lines="two" class="text-start mb-4 w-100" max-width="26rem">
            <v-list-item
              v-for="(step, i) in onboarding"
              :key="step.to"
              :to="step.to"
              :title="`${i + 1}. ${step.title}`"
              :subtitle="step.text"
            />
          </v-list>
          <v-btn color="primary" :prepend-icon="mdiPlus" to="/recipes/new">{{
            t('recipes.list.addFirst')
          }}</v-btn>
        </div>
      </EmptyState>
    </template>

    <RecipeTable
      v-else-if="recipes && view === 'table'"
      v-model:sort-by="tableSort"
      v-model:selected="selection.selected.value"
      :items="recipes"
      :selectable="selection.active.value"
    />

    <!-- Toľko stĺpcov, koľko sa zmestí (karta aspoň 260 px): na mobile jeden, na širokom monitore päť. Mriežka
         Vuetify má len pevné podiely z 12, preto CSS grid. -->
    <div
      v-else-if="recipes"
      class="ga-4"
      style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))"
      data-test="recipe-grid"
    >
      <RecipeCard
        v-for="recipe in recipes"
        :key="recipe.id"
        :recipe="recipe"
        :selectable="selection.active.value"
        :selected="selection.has(recipe.id)"
        @toggle="selection.toggle(recipe.id)"
      />
    </div>

    <ImportRecipeDialog v-model="importOpen" />

    <RecipeBulkEditDialog v-model="bulkEditOpen" :ids="selection.selected.value" @saved="onBulkEdited" />
    <ConfirmDialog
      v-model="bulkDeleteOpen"
      :title="t('bulk.recipes.deleteTitle')"
      :text="t('bulk.recipes.deleteText', { recipes: tc('common.plural.recipes', selection.count.value) })"
      :confirm-label="t('bulk.remove')"
      :loading="bulkDelete.isPending.value"
      @confirm="onBulkDelete"
    />
    <v-snackbar v-model="bulkSnackbar.show" :color="bulkSnackbar.color" timeout="4000">{{
      bulkSnackbar.text
    }}</v-snackbar>

    <RecipeFilterPanel
      v-if="list"
      v-model="filtersOpen"
      :state="state"
      :facets="list.facets"
      :tags="tags ?? []"
      :result-count="recipes?.length ?? 0"
      @toggle="toggleFilter"
      @clear="clearFilters"
    >
      <!-- Na počítači sú v paneli len Detské a Recepty od iných, ostatné je v riadku nad zoznamom. -->
      <RecipeQuickFilters
        :visibility-only="mdAndUp"
        v-model:favorite="favorite"
        v-model:kids="kids"
        v-model:public-mode="publicMode"
        v-model:pantry-mode="pantryMode"
        v-model:view="view"
        :sort-key="sortKey"
        :kids-enabled="kidsEnabled"
        :kids-items="kidsItems"
        :public-items="publicItems"
        :sort-items="sortItems"
        :sort-dir="sortDir"
        :missing="state.missing ?? 'all'"
        :can-cook="canCook"
        :missing-one="missingOne"
        @update:sort-key="setSort"
        @update:missing="setMissing"
        @flip-sort-dir="flipSortDir"
      />
    </RecipeFilterPanel>
  </ListLayout>
</template>
