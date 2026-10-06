<script setup lang="ts">
import { mdiCheck, mdiFormatListChecks, mdiMagnify, mdiPencilOutline, mdiPlaylistPlus } from '@mdi/js'
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import type { IngredientDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { UNITS, type UnitCode } from '@shared/units'
import {
  useAddStarterIngredients,
  useIngredients,
  useShopCategories,
  useUpdateIngredient,
} from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import IngredientEditDialog from '../components/IngredientEditDialog.vue'
import { plural } from '@/lib/format'

const { data: ingredients, isPending, error } = useIngredients({ refreshCounts: true })
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

const snackbar = ref({ show: false, text: '', color: 'error' })

const addStarter = useAddStarterIngredients()
async function onAddStarter() {
  try {
    const { added } = await addStarter.mutateAsync()
    snackbar.value = {
      show: true,
      color: 'success',
      text: added
        ? `Pridané: ${plural(added, 'ingrediencia', 'ingrediencie', 'ingrediencií')}.`
        : 'Základné suroviny už máš všetky.',
    }
  } catch (e) {
    snackbar.value = {
      show: true,
      color: 'error',
      text: e instanceof Error ? e.message : 'Suroviny sa nepodarilo pridať.',
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
      text: e instanceof Error ? e.message : 'Zmena sa neuložila.',
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

const usage = (item: IngredientDto) =>
  item.usageCount ? `v ${plural(item.usageCount, 'recepte', 'receptoch', 'receptoch')}` : 'nepoužitá'
</script>

<template>
  <!-- Lepkavá hlavička: odsadená o výšku hornej lišty (--v-layout-top), na mobile bez dlhého podtitulu. -->
  <v-sheet
    position="sticky"
    color="background"
    class="pb-1"
    :style="{ top: 'var(--v-layout-top)', zIndex: 2 }"
    data-test="sticky-header"
  >
    <PageHeader
      title="Ingrediencie"
      :subtitle="
        mdAndUp
          ? 'Kategória obchodu určuje poradie v nákupnom zozname. Nové ingrediencie pribúdajú samy pri písaní receptov.'
          : undefined
      "
    >
      <v-btn
        variant="tonal"
        :prepend-icon="mdiPlaylistPlus"
        :loading="addStarter.isPending.value"
        data-test="add-starter"
        @click="onAddStarter"
      >
        Pridať základné suroviny
      </v-btn>
    </PageHeader>

    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-text-field
        v-model="search"
        autocomplete="off"
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
  </v-sheet>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@6" />
  <EmptyState
    v-else-if="!ingredients?.length"
    :icon="mdiFormatListChecks"
    title="Zatiaľ žiadne ingrediencie"
    text="Pribudnú automaticky, keď uložíš prvý recept, alebo si môžeš naraz pridať základné suroviny."
  >
    <v-btn
      color="primary"
      :prepend-icon="mdiPlaylistPlus"
      :loading="addStarter.isPending.value"
      @click="onAddStarter"
    >
      Pridať základné suroviny
    </v-btn>
  </EmptyState>
  <p v-else-if="!filtered.length" class="text-body-2 text-medium-emphasis">Nič sa nenašlo.</p>

  <v-card v-else>
    <template v-for="(item, index) in filtered" :key="item.id">
      <v-divider v-if="index > 0" />
      <v-row dense align="center" class="px-4 py-2 ma-0">
        <v-col cols="12" sm="4" class="d-flex align-center">
          <div class="flex-grow-1">
            <div class="text-body-1 font-weight-bold">{{ item.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ usage(item) }}</div>
          </div>
          <v-btn
            :icon="mdiPencilOutline"
            size="small"
            variant="text"
            :aria-label="`Upraviť alebo zmazať ingredienciu ${item.name}`"
            data-test="edit-ingredient"
            @click="edit(item)"
          />
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

  <IngredientEditDialog v-model="editOpen" :ingredient="editTarget" />

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>
