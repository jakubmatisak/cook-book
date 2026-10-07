<script setup lang="ts">
import {
  mdiFilterVariant,
  mdiFridgeOutline,
  mdiMagnify,
  mdiPencilOutline,
  mdiPlus,
  mdiPotSteamOutline,
  mdiRepeat,
} from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { IngredientDto, PantryItemDto, StapleDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { formatQuantity } from '@/i18n/quantity'
import { useIngredients, usePantry, useShopCategories, useStaples, useTogglePantry } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import ActionButton from '@/components/ActionButton.vue'
import PageHeader from '@/components/PageHeader.vue'
import ListLayout from '@/components/ListLayout.vue'
import { useControlHeight } from '@/composables/useDensity'
import { useToday } from '@/composables/useToday'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import IngredientEditDialog from '@/features/ingredients/components/IngredientEditDialog.vue'
import NewIngredientDialog from '../components/NewIngredientDialog.vue'
import PantryFilters from '../components/PantryFilters.vue'
import PantryList from '../components/PantryList.vue'
import PantryItemDialog from '../components/PantryItemDialog.vue'
import StapleDialog from '../components/StapleDialog.vue'
import { describeCadence, expiryStatus } from '../format'

const { t } = useI18n()
const { data: ingredients, isPending, error } = useIngredients()
const { data: pantry } = usePantry()
const { data: categories } = useShopCategories()
const { data: staples, isPending: staplesPending, error: staplesError } = useStaples()
const toggle = useTogglePantry()
const today = useToday()

const tab = ref<'home' | 'staples'>('home')
const search = ref('')
const onlyHome = ref(false)
const onlyExpiring = ref(false)
// Filter podľa kategórie obchodu: id kategórie, `none` (ostatné, bez kategórie) alebo prázdne = všetky.
const category = ref<string | null>(null)
// Na mobile sú filtre v spodnom paneli, aby nad zoznamom ostalo len hľadanie.
const { mdAndUp } = useDisplay()
const controlHeight = useControlHeight()
const filtersOpen = ref(false)
const filterCount = computed(
  () => (category.value ? 1 : 0) + (onlyHome.value ? 1 : 0) + (onlyExpiring.value ? 1 : 0),
)
const categoryItems = computed(() => [
  ...(categories.value ?? []).map((c) => ({ title: c.name, value: c.id })),
  { title: t('pantry.page.otherCategory'), value: 'none' },
])
const inPantry = computed(() => new Set(pantry.value?.ingredientIds ?? []))
const stock = computed(() => new Map((pantry.value?.items ?? []).map((i) => [i.ingredientId, i])))
// Riadky zoznamu čítajú stav cez tieto funkcie samy, takže zaškrtnutie neprekreslí celý zoznam.
const isChecked = (id: string) => inPantry.value.has(id)
const stockOf = (id: string) => stock.value.get(id)

/** „Čoskoro“ pri zozname zásob znamená najbližší týždeň. */
const EXPIRING_DAYS = 7
const isExpiring = (item: PantryItemDto | undefined) => {
  const status = expiryStatus(item?.expiresOn ?? null, today.value, EXPIRING_DAYS)
  return status === 'soon' || status === 'expired'
}
const expiringCount = computed(() => [...stock.value.values()].filter(isExpiring).length)

const groups = computed(() => {
  const needle = normalizeText(search.value ?? '')
  const visible = (ingredients.value ?? []).filter(
    (i) =>
      (!needle || normalizeText(i.name).includes(needle)) &&
      (!category.value ||
        (category.value === 'none' ? !i.shopCategoryId : i.shopCategoryId === category.value)) &&
      (!onlyHome.value || inPantry.value.has(i.id)) &&
      (!onlyExpiring.value || isExpiring(stock.value.get(i.id))),
  )
  const order = new Map((categories.value ?? []).map((c, index) => [c.id, index]))
  const byCategory = new Map<string | null, IngredientDto[]>()
  for (const i of visible) byCategory.set(i.shopCategoryId, [...(byCategory.get(i.shopCategoryId) ?? []), i])
  return [...byCategory.entries()]
    .sort(([a], [b]) => (a ? (order.get(a) ?? 99) : 100) - (b ? (order.get(b) ?? 99) : 100))
    .map(([id, items]) => ({
      id: id ?? 'none',
      name: categories.value?.find((c) => c.id === id)?.name ?? t('pantry.page.otherCategory'),
      items,
    }))
})

const subtitle = computed(() =>
  ingredients.value?.length
    ? t('pantry.page.subtitle', {
        items: tc('ingredients.count', inPantry.value.size),
        total: ingredients.value.length,
      })
    : undefined,
)

const snackbar = ref({ show: false, text: '' })
async function onToggle(item: IngredientDto) {
  try {
    await toggle.mutateAsync({ ingredientId: item.id, inPantry: !inPantry.value.has(item.id) })
  } catch (e) {
    snackbar.value = { show: true, text: errorText(e, 'pantry.page.changeFailed') }
  }
}

// ─── Úprava zásoby ───────────────────────────────────────────────────────────
const ingredientEditOpen = ref(false)
const itemOpen = ref(false)
const itemTarget = ref<IngredientDto | null>(null)
// Surovina doma: množstvo a trvanlivosť; surovina, ktorú nemám doma, nemá zásobu, preto sa rovno upravuje ona sama.
function editItem(ingredient: IngredientDto) {
  itemTarget.value = ingredient
  if (inPantry.value.has(ingredient.id)) itemOpen.value = true
  else ingredientEditOpen.value = true
}

// ─── Nová surovina (ručné pridanie) ───────────────────────────────────────────
const newOpen = ref(false)
const newName = ref('')
function addIngredient(name = '') {
  newName.value = name
  newOpen.value = true
}

// ─── Stále položky ───────────────────────────────────────────────────────────
const stapleOpen = ref(false)
const stapleTarget = ref<StapleDto | null>(null)
function editStaple(staple: StapleDto | null) {
  stapleTarget.value = staple
  stapleOpen.value = true
}
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader :title="t('common.nav.pantry')" :subtitle="subtitle">
        <ActionButton
          v-if="tab === 'staples'"
          :icon="mdiPlus"
          :label="t('pantry.page.addStaple')"
          color="primary"
          data-test="add-staple"
          @click="editStaple(null)"
        />
        <template v-else>
          <ActionButton
            :icon="mdiPlus"
            :label="t('pantry.page.addIngredient')"
            color="primary"
            data-test="add-ingredient"
            @click="addIngredient()"
          />
          <ActionButton
            :icon="mdiPotSteamOutline"
            :label="t('pantry.page.cookable')"
            color="primary"
            variant="tonal"
            :to="{ path: '/recipes', query: { pantry: '1' } }"
          />
        </template>
      </PageHeader>

      <v-tabs v-model="tab" color="primary" class="mb-4">
        <v-tab value="home" data-test="tab-home">{{ t('pantry.page.tabHome') }}</v-tab>
        <v-tab value="staples" data-test="tab-staples">{{ t('pantry.page.tabStaples') }}</v-tab>
      </v-tabs>

      <div v-if="tab === 'home'" class="d-flex flex-wrap align-center ga-3 mb-2">
        <v-text-field
          v-model="search"
          autocomplete="off"
          :prepend-inner-icon="mdiMagnify"
          :label="t('pantry.page.search')"
          clearable
          hide-details
          class="flex-grow-1"
          :style="mdAndUp ? 'min-width: 16rem' : undefined"
        />
        <PantryFilters
          v-if="mdAndUp"
          v-model:category="category"
          v-model:only-home="onlyHome"
          v-model:only-expiring="onlyExpiring"
          :category-items="categoryItems"
          :expiring-count="expiringCount"
        />
        <v-badge v-else :model-value="filterCount > 0" :content="filterCount" color="primary">
          <v-btn
            :icon="mdiFilterVariant"
            variant="tonal"
            :height="controlHeight"
            :width="controlHeight"
            :color="filterCount ? 'primary' : undefined"
            :aria-label="t('pantry.page.filters')"
            data-test="pantry-filters-button"
            @click="filtersOpen = true"
          />
        </v-badge>
      </div>

      <v-bottom-sheet v-if="!mdAndUp" v-model="filtersOpen">
        <v-card :title="t('pantry.page.filters')">
          <v-card-text class="d-flex flex-column ga-3">
            <PantryFilters
              v-model:category="category"
              v-model:only-home="onlyHome"
              v-model:only-expiring="onlyExpiring"
              :category-items="categoryItems"
              :expiring-count="expiringCount"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" @click="filtersOpen = false">{{ t('common.actions.close') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-bottom-sheet>
    </template>

    <template v-if="tab === 'home'">
      <p v-if="mdAndUp" class="text-body-2 text-medium-emphasis mb-4" data-test="pantry-intro">
        {{ t('pantry.page.homeIntro') }}
      </p>

      <v-alert v-if="error" type="error" :text="errorText(error)" />
      <v-skeleton-loader v-else-if="isPending" type="list-item@6" />
      <EmptyState
        v-else-if="!ingredients?.length"
        :icon="mdiFridgeOutline"
        :title="t('pantry.page.empty.title')"
        :text="t('pantry.page.empty.text')"
      />
      <div v-else-if="!groups.length" class="d-flex flex-column align-start ga-2">
        <p class="text-body-2 text-medium-emphasis">{{ t('pantry.page.nothingFound') }}</p>
        <v-btn
          v-if="search?.trim()"
          variant="tonal"
          color="primary"
          :prepend-icon="mdiPlus"
          data-test="add-from-search"
          @click="addIngredient(search.trim())"
        >
          {{ t('pantry.page.addFromSearch', { name: search.trim() }) }}
        </v-btn>
      </div>

      <v-card v-else>
        <PantryList
          :groups="groups"
          :today="today"
          :is-checked="isChecked"
          :stock-of="stockOf"
          @toggle="onToggle"
          @edit="editItem"
        />
      </v-card>
    </template>

    <template v-else>
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ t('pantry.page.staplesIntro') }}
      </p>

      <v-alert v-if="staplesError" type="error" :text="errorText(staplesError)" />
      <v-skeleton-loader v-else-if="staplesPending" type="list-item@4" />
      <EmptyState
        v-else-if="!staples?.length"
        :icon="mdiRepeat"
        :title="t('pantry.page.staplesEmpty.title')"
        :text="t('pantry.page.staplesEmpty.text')"
      >
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="editStaple(null)">{{
          t('pantry.page.addStapleShort')
        }}</v-btn>
      </EmptyState>
      <v-card v-else>
        <v-list class="py-0">
          <v-list-item
            v-for="staple in staples"
            :key="staple.id"
            :title="staple.name"
            :subtitle="describeCadence(staple.everyNWeeks)"
            link
            @click="editStaple(staple)"
          >
            <template #prepend>
              <v-icon :icon="mdiRepeat" color="primary" class="me-3" />
            </template>
            <template #append>
              <span
                v-if="formatQuantity(staple.quantity, staple.unit)"
                class="text-body-2 font-weight-bold me-2"
              >
                {{ formatQuantity(staple.quantity, staple.unit) }}
              </span>
              <v-btn
                :icon="mdiPencilOutline"
                size="small"
                variant="text"
                :aria-label="t('pantry.page.editStapleAria', { name: staple.name })"
                @click.stop="editStaple(staple)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </template>

    <PantryItemDialog
      v-model="itemOpen"
      :ingredient="itemTarget"
      :item="itemTarget ? stock.get(itemTarget.id) : undefined"
      @edit-ingredient="((itemOpen = false), (ingredientEditOpen = true))"
    />
    <IngredientEditDialog v-model="ingredientEditOpen" :ingredient="itemTarget" />
    <StapleDialog v-model="stapleOpen" :staple="stapleTarget" />
    <NewIngredientDialog v-model="newOpen" :initial-name="newName" />

    <v-snackbar v-model="snackbar.show" color="error">{{ snackbar.text }}</v-snackbar>
  </ListLayout>
</template>
