<script setup lang="ts">
import { mdiCheck, mdiFridgeOutline, mdiMagnify, mdiPotSteamOutline } from '@mdi/js'
import { computed, ref } from 'vue'
import type { IngredientDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { useIngredients, usePantry, useShopCategories, useTogglePantry } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'

const { data: ingredients, isPending, error } = useIngredients()
const { data: pantry } = usePantry()
const { data: categories } = useShopCategories()
const toggle = useTogglePantry()

const search = ref('')
const onlyHome = ref(false)
const inPantry = computed(() => new Set(pantry.value?.ingredientIds ?? []))

const groups = computed(() => {
  const needle = normalizeText(search.value ?? '')
  const visible = (ingredients.value ?? []).filter(
    (i) =>
      (!needle || normalizeText(i.name).includes(needle)) && (!onlyHome.value || inPantry.value.has(i.id)),
  )
  const order = new Map((categories.value ?? []).map((c, index) => [c.id, index]))
  const byCategory = new Map<string | null, IngredientDto[]>()
  for (const i of visible) byCategory.set(i.shopCategoryId, [...(byCategory.get(i.shopCategoryId) ?? []), i])
  return [...byCategory.entries()]
    .sort(([a], [b]) => (a ? (order.get(a) ?? 99) : 100) - (b ? (order.get(b) ?? 99) : 100))
    .map(([id, items]) => ({
      id: id ?? 'none',
      name: categories.value?.find((c) => c.id === id)?.name ?? 'Ostatné',
      items,
    }))
})

const subtitle = computed(() =>
  ingredients.value?.length
    ? `Doma: ${plural(inPantry.value.size, 'ingrediencia', 'ingrediencie', 'ingrediencií')} z ${ingredients.value.length}`
    : undefined,
)

const snackbar = ref({ show: false, text: '' })
async function onToggle(item: IngredientDto) {
  try {
    await toggle.mutateAsync({ ingredientId: item.id, inPantry: !inPantry.value.has(item.id) })
  } catch (e) {
    snackbar.value = { show: true, text: e instanceof Error ? e.message : 'Zmena sa neuložila.' }
  }
}
</script>

<template>
  <PageHeader title="Špajza" :subtitle="subtitle">
    <v-btn
      color="primary"
      variant="tonal"
      :prepend-icon="mdiPotSteamOutline"
      :to="{ path: '/recepty', query: { doma: '1' } }"
    >
      Čo viem uvariť
    </v-btn>
  </PageHeader>

  <p class="text-body-2 text-medium-emphasis mb-4">
    Označ, čo máš doma. V receptoch potom filter „Čo viem uvariť“ ukáže, na čo máš všetko, a čo ti chýba.
  </p>

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
      :color="onlyHome ? 'primary' : undefined"
      :variant="onlyHome ? 'flat' : 'outlined'"
      :prepend-icon="onlyHome ? mdiCheck : undefined"
      @click="onlyHome = !onlyHome"
    >
      Len čo mám doma
    </v-chip>
  </div>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="list-item@6" />
  <EmptyState
    v-else-if="!ingredients?.length"
    :icon="mdiFridgeOutline"
    title="Zatiaľ žiadne ingrediencie"
    text="Pribudnú automaticky, keď uložíš prvý recept."
  />
  <p v-else-if="!groups.length" class="text-body-2 text-medium-emphasis">Nič sa nenašlo.</p>

  <v-card v-else>
    <v-list class="py-0">
      <template v-for="(group, gi) in groups" :key="group.id">
        <v-divider v-if="gi > 0" />
        <v-list-subheader class="text-primary font-weight-bold text-uppercase">{{
          group.name
        }}</v-list-subheader>
        <v-list-item
          v-for="item in group.items"
          :key="item.id"
          :title="item.name"
          link
          @click="onToggle(item)"
        >
          <template #prepend>
            <v-checkbox-btn
              :model-value="inPantry.has(item.id)"
              color="primary"
              :aria-label="item.name"
              @click.stop
              @update:model-value="onToggle(item)"
            />
          </template>
        </v-list-item>
      </template>
    </v-list>
  </v-card>

  <v-snackbar v-model="snackbar.show" color="error">{{ snackbar.text }}</v-snackbar>
</template>
