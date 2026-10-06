<script setup lang="ts">
import {
  mdiCheck,
  mdiClockAlertOutline,
  mdiFridgeOutline,
  mdiMagnify,
  mdiPencilOutline,
  mdiPlus,
  mdiPotSteamOutline,
  mdiRepeat,
} from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IngredientDto, PantryItemDto, StapleDto } from '@shared/api'
import { normalizeText } from '@shared/text'
import { formatQuantity } from '@/i18n/quantity'
import { useIngredients, usePantry, useShopCategories, useStaples, useTogglePantry } from '@/api/catalog'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import StickyHeader from '@/components/StickyHeader.vue'
import { useToday } from '@/composables/useToday'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import IngredientEditDialog from '@/features/ingredients/components/IngredientEditDialog.vue'
import PantryItemDialog from '../components/PantryItemDialog.vue'
import StapleDialog from '../components/StapleDialog.vue'
import { describeCadence, describeExpiry, expiryStatus } from '../format'

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
const inPantry = computed(() => new Set(pantry.value?.ingredientIds ?? []))
const stock = computed(() => new Map((pantry.value?.items ?? []).map((i) => [i.ingredientId, i])))

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

const quantityLabel = (item: PantryItemDto | undefined) =>
  item ? formatQuantity(item.quantity, item.unit) : ''
const expiryColor = (item: PantryItemDto) => {
  const status = expiryStatus(item.expiresOn, today.value)
  return status === 'expired' ? 'error' : status === 'soon' ? 'warning' : undefined
}

// ─── Úprava zásoby ───────────────────────────────────────────────────────────
const ingredientEditOpen = ref(false)
const itemOpen = ref(false)
const itemTarget = ref<IngredientDto | null>(null)
function editItem(ingredient: IngredientDto) {
  itemTarget.value = ingredient
  itemOpen.value = true
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
  <StickyHeader>
    <PageHeader :title="t('common.nav.pantry')" :subtitle="subtitle">
      <v-btn
        v-if="tab === 'staples'"
        color="primary"
        :prepend-icon="mdiPlus"
        data-test="add-staple"
        @click="editStaple(null)"
      >
        {{ t('pantry.page.addStaple') }}
      </v-btn>
      <v-btn
        v-else
        color="primary"
        variant="tonal"
        :prepend-icon="mdiPotSteamOutline"
        :to="{ path: '/recepty', query: { doma: '1' } }"
      >
        {{ t('pantry.page.cookable') }}
      </v-btn>
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
        style="min-width: 16rem"
      />
      <v-chip
        :color="onlyHome ? 'primary' : undefined"
        :variant="onlyHome ? 'flat' : 'outlined'"
        :prepend-icon="onlyHome ? mdiCheck : undefined"
        @click="onlyHome = !onlyHome"
      >
        {{ t('pantry.page.onlyHome') }}
      </v-chip>
      <v-chip
        :color="onlyExpiring ? 'warning' : undefined"
        :variant="onlyExpiring ? 'flat' : 'outlined'"
        :prepend-icon="onlyExpiring ? mdiCheck : mdiClockAlertOutline"
        data-test="expiring-chip"
        @click="onlyExpiring = !onlyExpiring"
      >
        {{ t('pantry.page.expiring') }}<template v-if="expiringCount">&nbsp;({{ expiringCount }})</template>
      </v-chip>
    </div>
  </StickyHeader>

  <template v-if="tab === 'home'">
    <p class="text-body-2 text-medium-emphasis mb-4">
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
    <p v-else-if="!groups.length" class="text-body-2 text-medium-emphasis">
      {{ t('pantry.page.nothingFound') }}
    </p>

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
            <template v-if="stock.get(item.id)" #subtitle>
              <span class="d-flex flex-wrap align-center ga-1 mt-1">
                <v-chip v-if="quantityLabel(stock.get(item.id))" size="x-small" variant="tonal">
                  {{ quantityLabel(stock.get(item.id)) }}
                </v-chip>
                <v-chip
                  v-if="stock.get(item.id)!.expiresOn"
                  size="x-small"
                  variant="tonal"
                  :color="expiryColor(stock.get(item.id)!)"
                  :prepend-icon="mdiClockAlertOutline"
                >
                  {{ describeExpiry(stock.get(item.id)!.expiresOn, today) }}
                </v-chip>
                <span v-if="stock.get(item.id)!.location" class="text-caption">
                  {{ stock.get(item.id)!.location }}
                </span>
              </span>
            </template>
            <template v-if="inPantry.has(item.id)" #append>
              <v-btn
                :icon="mdiPencilOutline"
                size="small"
                variant="text"
                :aria-label="t('pantry.page.editAria', { name: item.name })"
                @click.stop="editItem(item)"
              />
            </template>
          </v-list-item>
        </template>
      </v-list>
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

  <v-snackbar v-model="snackbar.show" color="error">{{ snackbar.text }}</v-snackbar>
</template>
