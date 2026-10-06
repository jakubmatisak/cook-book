<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import {
  mdiCheck,
  mdiCheckboxMarkedOutline,
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
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import IngredientBulkEditDialog from '../components/IngredientBulkEditDialog.vue'
import IngredientEditDialog from '../components/IngredientEditDialog.vue'

const { t } = useI18n()
const { data: ingredients, isPending, error } = useIngredients({ refreshCounts: true })
const { data: categories } = useShopCategories()
const update = useUpdateIngredient()
const { data: starter } = useStarterStatus()
// Tlačidlo má zmysel, len keď niektorá základná surovina chýba.
const missingStarters = computed(() => starter.value?.missing ?? 0)

const search = ref('')
const onlyUncategorized = ref(false)

const filtered = computed(() => {
  const needle = normalizeText(search.value ?? '')
  return (ingredients.value ?? []).filter(
    (i) =>
      (!needle || normalizeText(i.name).includes(needle)) && (!onlyUncategorized.value || !i.shopCategoryId),
  )
})

const uncategorizedCount = computed(() => ingredients.value?.filter((i) => !i.shopCategoryId).length ?? 0)

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
        @select-all="selection.set(visibleIds)"
        @clear="selection.clear()"
        @close="selection.stop()"
        @edit="bulkEditOpen = true"
        @remove="bulkDeleteOpen = true"
      />

      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <v-text-field
          v-model="search"
          autocomplete="off"
          :prepend-inner-icon="mdiMagnify"
          :label="t('ingredients.page.search')"
          clearable
          hide-details
          class="flex-grow-1"
          style="min-width: 16rem"
        />
        <v-chip
          :color="onlyUncategorized ? 'primary' : undefined"
          :variant="onlyUncategorized ? 'flat' : 'outlined'"
          :prepend-icon="onlyUncategorized ? mdiCheck : undefined"
          @click="onlyUncategorized = !onlyUncategorized"
        >
          {{ t('ingredients.page.uncategorized', { count: uncategorizedCount }) }}
        </v-chip>
      </div>
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
    <p v-else-if="!filtered.length" class="text-body-2 text-medium-emphasis">
      {{ t('ingredients.page.nothingFound') }}
    </p>

    <v-card v-else>
      <template v-for="(item, index) in filtered" :key="item.id">
        <v-divider v-if="index > 0" />
        <v-row dense align="center" class="px-4 py-2 ma-0">
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
              <div class="text-body-1 font-weight-bold">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ usage(item) }}</div>
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

    <IngredientEditDialog v-model="editOpen" :ingredient="editTarget" />
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
