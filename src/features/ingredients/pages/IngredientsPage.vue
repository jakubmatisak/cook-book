<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import {
  mdiCheckboxMarkedOutline,
  mdiFilterVariant,
  mdiFormatListChecks,
  mdiMagnify,
  mdiPencilOutline,
  mdiPlaylistPlus,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { IngredientDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { UNITS, type UnitCode } from '@shared/units'
import {
  useAddStarterIngredients,
  useIngredients,
  useShopCategories,
  useStarterStatus,
  useUpdateIngredient,
} from '@/api/catalog'
import { useBulkDeleteIngredients } from '@/api/bulk'
import BulkBar from '@/components/BulkBar.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useSelection } from '@/composables/useSelection'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import ListLayout from '@/components/ListLayout.vue'
import { useControlHeight } from '@/composables/useDensity'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import IngredientBulkEditDialog from '../components/IngredientBulkEditDialog.vue'
import IngredientEditDialog from '../components/IngredientEditDialog.vue'
import IngredientMergeDialog from '../components/IngredientMergeDialog.vue'
import MergeSuggestionsCard from '../components/MergeSuggestionsCard.vue'
import CategorySuggestions from '../components/CategorySuggestions.vue'

const { t } = useI18n()
const controlHeight = useControlHeight()
const { data: ingredients, isPending, error } = useIngredients({ refreshCounts: true })
const { data: categories } = useShopCategories()
const update = useUpdateIngredient()
const { data: starter } = useStarterStatus()
// Tlačidlo má zmysel, len keď niektorá základná surovina chýba.
const missingStarters = computed(() => starter.value?.missing ?? 0)

const search = ref('')
/** Filter podľa kategórie obchodu (napr. len mäso); `none` = ingrediencie bez kategórie. */
const category = ref<string | null>(null)
const NO_CATEGORY = 'none'

const filtered = computed(() => {
  const needle = normalizeText(search.value ?? '')
  return (ingredients.value ?? []).filter(
    (i) =>
      (!needle || normalizeText(i.name).includes(needle)) &&
      (!category.value || (i.shopCategoryId ?? NO_CATEGORY) === category.value),
  )
})

// Na mobile je výber kategórie v spodnom paneli, aby nad zoznamom ostalo len hľadanie.
const filtersOpen = ref(false)
const filterCount = computed(() => (category.value ? 1 : 0))

// Riadky s dvoma rozbaľovacími zoznamami sú ťažké: stovky naraz by stránku na chvíľu zasekli. Vykresľujú sa
// po dávkach, ďalšia dávka pribudne, keď sa koniec zoznamu priblíži k obrazovke.
const BATCH = 30
const limit = ref(BATCH)
watch([search, category], () => (limit.value = BATCH))
const visible = computed(() => filtered.value.slice(0, limit.value))
const remaining = computed(() => filtered.value.length - visible.value.length)
const showMore = () => (limit.value += BATCH)
const onEndVisible = (isIntersecting: boolean) => {
  if (isIntersecting) showMore()
}

/** Kategórie s počtom ingrediencií vo filtri; na konci tie bez kategórie. */
const filterItems = computed(() => {
  const counts = new Map<string, number>()
  for (const i of ingredients.value ?? []) {
    const key = i.shopCategoryId ?? NO_CATEGORY
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [
    ...(categories.value ?? []).map((c) => ({
      title: t('ingredients.page.categoryOption', { name: c.name, count: counts.get(c.id) ?? 0 }),
      value: c.id,
    })),
    {
      title: t('ingredients.page.uncategorized', { count: counts.get(NO_CATEGORY) ?? 0 }),
      value: NO_CATEGORY,
    },
  ]
})

const categoryItems = computed(() => categories.value?.map((c) => ({ title: c.name, value: c.id })) ?? [])
const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)

const snackbar = ref({ show: false, text: '', color: 'error' })

const addStarter = useAddStarterIngredients()
async function onAddStarter() {
  try {
    const { added } = await addStarter.mutateAsync()
    snackbar.value = {
      show: true,
      color: 'success',
      text: added
        ? t('ingredients.page.added', { items: tc('ingredients.count', added) })
        : t('ingredients.page.allStarters'),
    }
  } catch (e) {
    snackbar.value = {
      show: true,
      color: 'error',
      text: errorText(e, 'ingredients.page.addFailed'),
    }
  }
}

async function patch(
  item: IngredientDto,
  change: { shopCategoryId?: string | null; defaultUnit?: UnitCode | null },
) {
  try {
    await update.mutateAsync({ id: item.id, patch: change })
  } catch (e) {
    snackbar.value = {
      show: true,
      color: 'error',
      text: errorText(e, 'ingredients.page.changeFailed'),
    }
  }
}

const { mdAndUp } = useDisplay()

const editOpen = ref(false)
const editTarget = ref<IngredientDto | null>(null)
function edit(item: IngredientDto) {
  editTarget.value = item
  editOpen.value = true
}

// ─── Hromadné úpravy: výber zaškrtávacími poľami, úprava a mazanie ───────────
const selection = useSelection()
const visibleIds = computed(() => filtered.value.map((i) => i.id))
watch(visibleIds, (ids) => selection.keepOnly(ids))
const bulkEditOpen = ref(false)
// Zlúčenie vybraných ingrediencií do jednej (napr. Banán a Banány).
const mergeOpen = ref(false)
/** Návrh na zlúčenie (karta návrhov); bez neho sa zlučujú vybrané ingrediencie. */
const suggested = ref<IngredientDto[] | null>(null)
const mergeItems = computed(
  () => suggested.value ?? (ingredients.value ?? []).filter((i) => selection.has(i.id)),
)
function mergeSuggested(items: IngredientDto[]) {
  suggested.value = items
  mergeOpen.value = true
}
function mergeSelected() {
  suggested.value = null
  mergeOpen.value = true
}
function onMerged(ingredient: IngredientDto) {
  selection.stop()
  snackbar.value = {
    show: true,
    color: 'success',
    text: t('ingredients.merge.done', { name: ingredient.name }),
  }
}
const bulkDeleteOpen = ref(false)
const bulkDelete = useBulkDeleteIngredients()
function onBulkEdited(affected: number) {
  selection.clear()
  snackbar.value = {
    show: true,
    color: 'success',
    text: t('bulk.ingredients.updated', { items: tc('ingredients.count', affected) }),
  }
}
async function onBulkDelete() {
  try {
    const { deleted, skipped } = await bulkDelete.mutateAsync(selection.selected.value)
    bulkDeleteOpen.value = false
    selection.stop()
    const parts = [
      deleted
        ? t('bulk.ingredients.deleted', { items: tc('ingredients.count', deleted) })
        : t('bulk.ingredients.nothingDeleted'),
      skipped.length ? t('bulk.ingredients.skipped', { names: skipped.join(', ') }) : '',
    ]
    snackbar.value = {
      show: true,
      color: deleted ? 'success' : 'warning',
      text: parts.filter(Boolean).join(' '),
    }
  } catch (e) {
    bulkDeleteOpen.value = false
    snackbar.value = { show: true, color: 'error', text: errorText(e, 'bulk.ingredients.deleteFailed') }
  }
}

const usage = (item: IngredientDto) =>
  item.usageCount ? tc('ingredients.usedIn', item.usageCount) : t('ingredients.page.unused')
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader
        :title="t('common.nav.ingredients')"
        :subtitle="mdAndUp ? t('ingredients.page.subtitle') : undefined"
      >
        <v-btn
          v-if="missingStarters > 0"
          variant="tonal"
          :prepend-icon="mdiPlaylistPlus"
          :loading="addStarter.isPending.value"
          data-test="add-starter"
          @click="onAddStarter"
        >
          {{ t('ingredients.page.addStartersCount', { n: missingStarters }) }}
        </v-btn>
        <CategorySuggestions
          v-if="ingredients"
          :ingredients="ingredients"
          @done="(text, color) => (snackbar = { show: true, color: color ?? 'success', text })"
        />
        <v-btn
          :prepend-icon="mdiCheckboxMarkedOutline"
          :variant="selection.active.value ? 'flat' : 'tonal'"
          :color="selection.active.value ? 'primary' : undefined"
          data-test="select-mode"
          @click="selection.active.value ? selection.stop() : selection.start()"
        >
          {{ t('bulk.select') }}
        </v-btn>
      </PageHeader>

      <BulkBar
        v-if="selection.active.value"
        :count="selection.count.value"
        :total="visibleIds.length"
        mergeable
        @merge="mergeSelected"
        @select-all="selection.set(visibleIds)"
        @clear="selection.clear()"
        @close="selection.stop()"
        @edit="bulkEditOpen = true"
        @remove="bulkDeleteOpen = true"
      />

      <MergeSuggestionsCard v-if="ingredients" :ingredients="ingredients" @merge="mergeSuggested" />

      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <v-text-field
          v-model="search"
          autocomplete="off"
          :prepend-inner-icon="mdiMagnify"
          :label="t('ingredients.page.search')"
          clearable
          hide-details
          class="flex-grow-1"
          :style="mdAndUp ? 'min-width: 16rem' : undefined"
        />
        <v-select
          v-if="mdAndUp"
          v-model="category"
          :items="filterItems"
          :label="t('ingredients.page.category')"
          clearable
          hide-details
          data-test="ingredients-category"
          style="min-width: 14rem; max-width: 20rem"
        />
        <v-badge v-else :model-value="filterCount > 0" :content="filterCount" color="primary">
          <v-btn
            :icon="mdiFilterVariant"
            variant="tonal"
            :color="filterCount ? 'primary' : undefined"
            :height="controlHeight"
            :width="controlHeight"
            :aria-label="t('ingredients.page.filters')"
            data-test="ingredients-filters-button"
            @click="filtersOpen = true"
          />
        </v-badge>
      </div>

      <v-bottom-sheet v-if="!mdAndUp" v-model="filtersOpen">
        <v-card :title="t('ingredients.page.filters')">
          <v-card-text>
            <v-select
              v-model="category"
              :items="filterItems"
              :label="t('ingredients.page.category')"
              clearable
              hide-details
              data-test="ingredients-category"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" @click="filtersOpen = false">{{ t('common.actions.close') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-bottom-sheet>
    </template>

    <v-alert v-if="error" type="error" :text="errorText(error)" />
    <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@6" />
    <EmptyState
      v-else-if="!ingredients?.length"
      :icon="mdiFormatListChecks"
      :title="t('ingredients.page.empty.title')"
      :text="t('ingredients.page.empty.text')"
    >
      <v-btn
        color="primary"
        :prepend-icon="mdiPlaylistPlus"
        :loading="addStarter.isPending.value"
        @click="onAddStarter"
      >
        {{ t('ingredients.page.addStarters') }}
      </v-btn>
    </EmptyState>
    <p v-else-if="!filtered.length" class="text-body-medium text-medium-emphasis">
      {{ t('ingredients.page.nothingFound') }}
    </p>

    <v-card v-else>
      <template v-for="(item, index) in visible" :key="item.id">
        <v-divider v-if="index > 0" />
        <v-row density="compact" align="center" class="px-4 py-1 ma-0" data-test="ingredient-row">
          <v-col cols="12" sm="4" class="d-flex align-center">
            <v-checkbox-btn
              v-if="selection.active.value"
              :model-value="selection.has(item.id)"
              color="primary"
              class="flex-grow-0 me-2"
              :aria-label="t('bulk.selectAria', { name: item.name })"
              :data-test="`select-${item.id}`"
              @update:model-value="selection.toggle(item.id)"
            />
            <div class="flex-grow-1">
              <div class="text-body-large font-weight-bold">{{ item.name }}</div>
              <div class="text-body-small text-medium-emphasis">{{ usage(item) }}</div>
            </div>
            <v-btn
              :icon="mdiPencilOutline"
              size="small"
              variant="text"
              :aria-label="t('ingredients.page.editAria', { name: item.name })"
              data-test="edit-ingredient"
              @click="edit(item)"
            />
          </v-col>
          <v-col cols="7" sm="5">
            <v-select
              :model-value="item.shopCategoryId"
              :items="categoryItems"
              :label="t('ingredients.page.shopCategory')"
              density="compact"
              clearable
              hide-details
              @update:model-value="patch(item, { shopCategoryId: $event ?? null })"
            />
          </v-col>
          <v-col cols="5" sm="3">
            <v-select
              :model-value="item.defaultUnit"
              :items="unitItems"
              item-props
              :label="t('ingredients.page.unit')"
              density="compact"
              clearable
              hide-details
              @update:model-value="patch(item, { defaultUnit: $event ?? null })"
            />
          </v-col>
        </v-row>
      </template>
    </v-card>
    <div
      v-if="filtered.length && remaining > 0"
      v-intersect="onEndVisible"
      class="d-flex justify-center py-2"
    >
      <v-btn variant="text" data-test="ingredients-more" @click="showMore">
        {{ t('ingredients.page.more', { n: remaining }) }}
      </v-btn>
    </div>

    <IngredientEditDialog v-model="editOpen" :ingredient="editTarget" />
    <IngredientMergeDialog v-model="mergeOpen" :items="mergeItems" @merged="onMerged" />
    <IngredientBulkEditDialog v-model="bulkEditOpen" :ids="selection.selected.value" @saved="onBulkEdited" />
    <ConfirmDialog
      v-model="bulkDeleteOpen"
      :title="t('bulk.ingredients.deleteTitle')"
      :text="t('bulk.ingredients.deleteText', { items: tc('ingredients.count', selection.count.value) })"
      :confirm-label="t('bulk.remove')"
      :loading="bulkDelete.isPending.value"
      @confirm="onBulkDelete"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{
      snackbar.text
    }}</v-snackbar>
  </ListLayout>
</template>
