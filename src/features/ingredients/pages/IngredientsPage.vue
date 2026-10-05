<script setup lang="ts">
import { mdiCheck, mdiFormatListChecks, mdiMagnify } from '@mdi/js'
import { computed, ref } from 'vue'
import type { IngredientDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { UNITS, type UnitCode } from '@shared/units'
import { useIngredients, useShopCategories, useUpdateIngredient } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'

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

const usage = (item: IngredientDto) =>
  item.usageCount ? `v ${plural(item.usageCount, 'recepte', 'receptoch', 'receptoch')}` : 'nepoužitá'
</script>

<template>
  <PageHeader
    title="Ingrediencie"
    subtitle="Kategória obchodu určuje poradie v nákupnom zozname. Nové ingrediencie pribúdajú samy pri písaní receptov."
  />

  <div class="d-flex flex-wrap align-center ga-3 mb-4">
    <v-text-field
      v-model="search"
      :prepend-inner-icon="mdiMagnify"
      label="Hľadať ingredienciu"
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
      Bez kategórie ({{ uncategorizedCount }})
    </v-chip>
  </div>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@6" />
  <EmptyState
    v-else-if="!ingredients?.length"
    :icon="mdiFormatListChecks"
    title="Zatiaľ žiadne ingrediencie"
    text="Pribudnú automaticky, keď uložíš prvý recept."
  />
  <p v-else-if="!filtered.length" class="text-body-2 text-medium-emphasis">Nič sa nenašlo.</p>

  <v-card v-else>
    <template v-for="(item, index) in filtered" :key="item.id">
      <v-divider v-if="index > 0" />
      <v-row dense align="center" class="px-4 py-2 ma-0">
        <v-col cols="12" sm="4">
          <div class="text-body-1 font-weight-bold">{{ item.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ usage(item) }}</div>
        </v-col>
        <v-col cols="7" sm="5">
          <v-select
            :model-value="item.shopCategoryId"
            :items="categoryItems"
            label="Kategória obchodu"
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
            label="Jednotka"
            density="compact"
            clearable
            hide-details
            @update:model-value="patch(item, { defaultUnit: $event ?? null })"
          />
        </v-col>
      </v-row>
    </template>
  </v-card>

  <v-snackbar v-model="snackbar.show" color="error">{{ snackbar.text }}</v-snackbar>
</template>
