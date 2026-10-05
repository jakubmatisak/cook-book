<script setup lang="ts">
import { mdiFormatListChecks, mdiMagnify } from '@mdi/js'
import { computed, ref } from 'vue'
import type { IngredientDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { UNITS, type UnitCode } from '@shared/units'
import { useIngredients, useShopCategories, useUpdateIngredient } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'

const { data: ingredients, isPending, error } = useIngredients()
const { data: categories } = useShopCategories()
const update = useUpdateIngredient()

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
const unitItems = UNITS.map((u) => ({ title: u.code, value: u.code, subtitle: u.label }))

const snackbar = ref({ show: false, text: '' })

async function patch(
  item: IngredientDto,
  change: { shopCategoryId?: string | null; defaultUnit?: UnitCode | null },
) {
  try {
    await update.mutateAsync({ id: item.id, patch: change })
  } catch (e) {
    snackbar.value = { show: true, text: e instanceof Error ? e.message : 'Zmena sa neuložila.' }
  }
}
</script>

<template>
  <div class="tw:flex tw:flex-col tw:gap-4">
    <div>
      <h1 class="text-h5">Ingrediencie</h1>
      <p class="text-body-2 text-medium-emphasis">
        Kategória obchodu určuje poradie v nákupnom zozname. Nové ingrediencie pribúdajú samy pri písaní
        receptov.
      </p>
    </div>

    <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
      <v-text-field
        v-model="search"
        :prepend-inner-icon="mdiMagnify"
        label="Hľadať ingredienciu"
        clearable
        hide-details
        class="tw:min-w-60 tw:flex-1"
      />
      <v-chip
        :color="onlyUncategorized ? 'primary' : undefined"
        :variant="onlyUncategorized ? 'flat' : 'outlined'"
        @click="onlyUncategorized = !onlyUncategorized"
      >
        Bez kategórie ({{ uncategorizedCount }})
      </v-chip>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" :text="error.message" />
    <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@6" />
    <EmptyState
      v-else-if="!ingredients?.length"
      :icon="mdiFormatListChecks"
      title="Zatiaľ žiadne ingrediencie"
      text="Pribudnú automaticky, keď uložíš prvý recept."
    />
    <p v-else-if="!filtered.length" class="text-body-2 text-medium-emphasis">Nič sa nenašlo.</p>

    <v-card v-else>
      <v-list lines="two" class="tw:py-0">
        <template v-for="(item, index) in filtered" :key="item.id">
          <v-divider v-if="index > 0" />
          <div class="tw:grid tw:gap-2 tw:px-4 tw:py-3 tw:sm:grid-cols-[1fr_14rem_10rem] tw:sm:items-center">
            <div>
              <div class="text-body-1 tw:font-semibold">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ item.usageCount ? `v ${item.usageCount} receptoch` : 'nepoužitá' }}
              </div>
            </div>
            <v-select
              :model-value="item.shopCategoryId"
              :items="categoryItems"
              label="Kategória obchodu"
              density="compact"
              clearable
              hide-details
              @update:model-value="patch(item, { shopCategoryId: $event ?? null })"
            />
            <v-select
              :model-value="item.defaultUnit"
              :items="unitItems"
              item-props
              label="Jednotka"
              density="compact"
              clearable
              hide-details
              @update:model-value="patch(item, { defaultUnit: $event ?? null })"
            />
          </div>
        </template>
      </v-list>
    </v-card>

    <v-snackbar v-model="snackbar.show" color="error">{{ snackbar.text }}</v-snackbar>
  </div>
</template>
