<script setup lang="ts">
import { mdiAlertOutline, mdiClose, mdiMagnify, mdiRefresh, mdiShuffleVariant } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto, MealSlotDto } from '@shared/api'
import {
  COMPOSE_BRUSHES,
  MAX_LEFTOVER_DAYS,
  type ComposeBrush,
  type ComposeItem,
  type ComposeTimeLimit,
} from '@shared/compose'
import { addDays, startOfWeek } from '@shared/dates'
import { preferenceConflicts } from '@shared/preferences'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@shared/recipes'
import { MAX_COMPOSE_DAYS } from '@shared/schemas/plan'
import { useTags } from '@/api/catalog'
import { useApplyCompose, useComposePlan, usePlan, usePlanStays } from '@/api/plan'
import { useRecipe, useRecipes } from '@/api/recipes'
import { slotName } from '@/i18n/defaults'
import { errorText } from '@/i18n/errors'
import { formatDayLabel, formatMinutes, tc } from '@/i18n/format'
import {
  applyItems,
  brushSummary,
  cellKey,
  chooseRecipe,
  clearItem,
  defaultCategories,
  gridCells,
  initialGrid,
  nextOption,
  paintCell,
  paintColumn,
  paintRow,
  rangeDates,
  repeatsOf,
  setLeftoverDays,
  summarize,
  weekdayLimits,
  type BrushGrid,
  type TimeLimits,
} from '../compose'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  /** Zobrazený týždeň v jedálničku (predvolený rozsah). */
  weekStart: string
  today: string
  weekStartsOn: number
  slots: MealSlotDto[]
  members: FamilyMemberDto[]
}>()
const emit = defineEmits<{ applied: [count: number, from: string] }>()

const step = ref(1)
const error = ref('')

// ─── Krok 1: obdobie a jedlá dňa ─────────────────────────────────────────────

const weekEnd = addDays(props.weekStart, 6)
const from = ref(props.today > props.weekStart && props.today <= weekEnd ? props.today : props.weekStart)
const to = ref(weekEnd)
const dates = computed(() => rangeDates(from.value, to.value))
const rangeValid = computed(() => dates.value.length > 0 && dates.value.length <= MAX_COMPOSE_DAYS)

function restOfWeek() {
  from.value = props.today
  to.value = addDays(startOfWeek(props.today, props.weekStartsOn), 6)
}
function nextWeek() {
  from.value = addDays(startOfWeek(props.today, props.weekStartsOn), 7)
  to.value = addDays(from.value, 6)
}

interface SlotSetting {
  slotId: string
  name: string
  selected: boolean
  categories: RecipeCategory[]
  withSoup: boolean
}
const slotSettings = ref<SlotSetting[]>(
  props.slots
    .filter((s) => s.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const categories = defaultCategories(s.name)
      return {
        slotId: s.id,
        name: slotName(s.name),
        selected: categories[0] === 'hlavne',
        categories,
        withSoup: false,
      }
    }),
)
const activeSlots = computed(() => slotSettings.value.filter((s) => s.selected && s.categories.length))
const categoryItems = RECIPE_CATEGORIES.filter((c) => c !== 'detske').map((c) => ({
  title: t(`common.category.${c}`),
  value: c,
}))

const { data: tags } = useTags()
const tagItems = computed(() => (tags.value ?? []).map((tag) => ({ title: tag.name, value: tag.id })))
const tagIds = ref<string[]>([])
const cookAhead = ref(true)
const leftoverDays = ref(1)
const replace = ref(false)

// Čo už v jedálničku v rozsahu je (obsadené políčka, „Už máme“) a kto je na návšteve.
const { data: existing } = usePlan(from, to)
const { data: stays } = usePlanStays(from, to)
const occupied = computed(() => {
  const map = new Map<string, string[]>()
  for (const e of existing.value ?? []) {
    const key = cellKey(e.date, e.slotId)
    map.set(key, [...(map.get(key) ?? []), e.recipe?.title ?? e.freeText ?? ''])
  }
  return map
})
const guestsOn = (date: string) =>
  (stays.value ?? []).filter((s) => s.fromDate <= date && date <= s.toDate).map((s) => s.memberId)

const canContinue = computed(() => rangeValid.value && activeSlots.value.length > 0)

// ─── Krok 2: štetce ──────────────────────────────────────────────────────────

const BRUSH_COLORS: Record<ComposeBrush, string | undefined> = {
  all: 'primary',
  verified: 'success',
  new: 'info',
  favorite: 'error',
  skip: undefined,
}
const brush = ref<ComposeBrush>('all')
const grid = ref<BrushGrid>({})
const gridFor = ref('')
const limits = ref<TimeLimits>({})
const limitItems = computed(() => [
  { title: t('plan.compose.limits.none'), value: null },
  { title: t('plan.compose.limits.do30'), value: 'do30' },
  { title: t('plan.compose.limits.do60'), value: 'do60' },
])
const setLimit = (date: string, limit: ComposeTimeLimit | null) => {
  const next = { ...limits.value }
  if (limit) next[date] = limit
  else delete next[date]
  limits.value = next
}

function goToPaint() {
  const slotIds = activeSlots.value.map((s) => s.slotId)
  // Nové maľovanie len keď sa zmenili dni, jedlá dňa alebo nahrádzanie; inak ostane, čo človek vyfarbil.
  const signature = JSON.stringify([dates.value, slotIds, replace.value])
  if (signature !== gridFor.value) {
    grid.value = initialGrid(dates.value, slotIds, new Set(occupied.value.keys()), replace.value)
    gridFor.value = signature
  }
  limits.value = Object.fromEntries(
    Object.entries(limits.value).filter(([date]) => dates.value.includes(date)),
  )
  error.value = ''
  step.value = 2
}

const dayLabel = (date: string) => {
  const label = formatDayLabel(date)
  return `${label.short} ${label.date}`
}
const brushText = (b: ComposeBrush) => t(`plan.compose.brushes.${b}`)
const cellText = (date: string, slotId: string) => {
  const key = cellKey(date, slotId)
  const value = grid.value[key] ?? 'skip'
  const titles = occupied.value.get(key)
  return value === 'skip' && titles?.length ? titles.join(', ') : brushText(value)
}
const summaryText = computed(() => {
  const counts = brushSummary(grid.value)
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  if (!total) return t('plan.compose.summaryNone')
  const parts = COMPOSE_BRUSHES.flatMap((b) =>
    b !== 'skip' && counts[b] ? [t('plan.compose.summaryBrush', { n: counts[b], brush: brushText(b) })] : [],
  )
  return t('plan.compose.summary', { cells: tc('plan.compose.cells', total), brushes: parts.join(', ') })
})

// ─── Krok 3: návrh a kontrola ────────────────────────────────────────────────

const compose = useComposePlan()
const items = ref<ComposeItem[]>([])
const randomSeed = () => Math.floor(Math.random() * 2_147_483_647)

async function propose() {
  error.value = ''
  try {
    items.value = await compose.mutateAsync({
      cells: gridCells(grid.value),
      slots: activeSlots.value.map((s) => ({
        slotId: s.slotId,
        categories: s.categories,
        withSoup: s.withSoup && s.categories.includes('hlavne'),
      })),
      timeLimits: limits.value as Record<string, ComposeTimeLimit>,
      tagIds: tagIds.value,
      leftoverDays: cookAhead.value ? leftoverDays.value : 0,
      seed: randomSeed(),
      replace: replace.value,
    })
    step.value = 3
  } catch (e) {
    error.value = errorText(e, 'plan.compose.review.failed')
  }
}

const withSoup = computed(() => new Set(activeSlots.value.filter((s) => s.withSoup).map((s) => s.slotId)))
const itemsIn = (date: string, slotId: string) =>
  items.value.filter((i) => i.date === date && i.slotId === slotId)
const repeats = computed(() =>
  repeatsOf(
    items.value,
    (existing.value ?? []).flatMap((e) =>
      e.recipeId && !(replace.value && grid.value[cellKey(e.date, e.slotId)] !== 'skip')
        ? [{ date: e.date, recipeId: e.recipeId }]
        : [],
    ),
  ),
)
const sourceDay = (item: ComposeItem) => {
  const source = items.value.find((i) => i.key === item.leftoverOf)
  return source ? formatDayLabel(source.date).short : ''
}
const isMeal = (item: ComposeItem) => item.category === 'hlavne' || item.category === 'polievka'
const warningText = (w: ComposeItem['warnings'][number]) =>
  t(`common.preference.warning.${w.kind}`, { name: w.memberName, label: w.label })
const reviewSummary = computed(() => {
  const s = summarize(items.value)
  return t('plan.compose.review.summary', {
    meals: tc('common.plural.meals', s.meals),
    cooked: s.cooked,
    leftovers: s.leftovers,
  })
})

const onOther = (key: string) => (items.value = nextOption(items.value, key))
const onClear = (key: string) => (items.value = clearItem(items.value, key))
const onLeftovers = (key: string, days: number) => (items.value = setLeftoverDays(items.value, key, days))

// Vybrať recept ručne: upozornenia sa rátajú pre ľudí pri stole v daný deň.
const pickOpen = ref(false)
const pickKey = ref('')
const pickRecipeId = ref<string | null>(null)
const { data: recipeList } = useRecipes(() => ({ kids: 'include', public: 'hide' }))
const recipeItems = computed(() =>
  (recipeList.value?.items ?? []).map((r) => ({ title: r.title, value: r.id })),
)
const { data: picked } = useRecipe(() => pickRecipeId.value ?? undefined)
function onPick(key: string) {
  pickKey.value = key
  pickRecipeId.value = null
  pickOpen.value = true
}
function confirmPick() {
  const recipe = picked.value
  const item = items.value.find((i) => i.key === pickKey.value)
  if (!recipe || recipe.id !== pickRecipeId.value || !item) return
  const warnings = preferenceConflicts(
    {
      id: recipe.id,
      title: recipe.title,
      ingredientIds: recipe.ingredients.map((i) => i.ingredientId),
      tagIds: recipe.tags.map((tag) => tag.id),
    },
    props.members,
    'all',
    guestsOn(item.date),
  )
  items.value = chooseRecipe(items.value, item.key, {
    recipeId: recipe.id,
    title: recipe.title,
    coverImageUrl: recipe.coverImageUrl,
    totalMinutes:
      recipe.prepMinutes === null && recipe.cookMinutes === null
        ? null
        : (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0),
    category: recipe.category,
    warnings,
  })
  pickOpen.value = false
}

const apply = useApplyCompose()
async function confirm() {
  const payload = applyItems(items.value)
  if (!payload.length) return void (error.value = t('plan.compose.review.nothing'))
  error.value = ''
  try {
    const result = await apply.mutateAsync({ replace: replace.value, items: payload })
    emit('applied', result.added, from.value)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.compose.applyFailed')
  }
}

function back() {
  error.value = ''
  step.value -= 1
}
</script>

<template>
  <v-dialog v-model="open" fullscreen scrollable transition="dialog-bottom-transition">
    <v-card>
      <v-toolbar color="surface" density="comfortable">
        <v-btn :icon="mdiClose" :aria-label="t('plan.compose.close')" @click="open = false" />
        <v-toolbar-title>{{ t('plan.compose.title') }}</v-toolbar-title>
      </v-toolbar>
      <v-stepper v-model="step" flat class="flex-grow-0">
        <v-stepper-header>
          <v-stepper-item :value="1" :title="t('plan.compose.steps.settings')" :complete="step > 1" />
          <v-divider />
          <v-stepper-item :value="2" :title="t('plan.compose.steps.paint')" :complete="step > 2" />
          <v-divider />
          <v-stepper-item :value="3" :title="t('plan.compose.steps.review')" />
        </v-stepper-header>
      </v-stepper>

      <v-card-text>
        <v-container class="pa-0">
          <!-- Krok 1 -->
          <div v-if="step === 1" class="d-flex flex-column ga-4">
            <div class="d-flex flex-wrap ga-2 align-center">
              <v-text-field
                v-model="from"
                type="date"
                :label="t('plan.compose.range.from')"
                hide-details
                density="compact"
                max-width="200"
                data-test="compose-from"
              />
              <v-text-field
                v-model="to"
                type="date"
                :label="t('plan.compose.range.to')"
                hide-details
                density="compact"
                max-width="200"
                data-test="compose-to"
              />
              <v-btn variant="tonal" @click="restOfWeek">{{ t('plan.compose.range.restOfWeek') }}</v-btn>
              <v-btn variant="tonal" @click="nextWeek">{{ t('plan.compose.range.nextWeek') }}</v-btn>
            </div>
            <v-alert
              v-if="!rangeValid"
              type="warning"
              density="compact"
              :text="t('plan.compose.range.invalid', { n: MAX_COMPOSE_DAYS })"
            />

            <div>
              <div class="text-title-small mb-2">{{ t('plan.compose.slots.title') }}</div>
              <v-row dense>
                <v-col v-for="slot in slotSettings" :key="slot.slotId" cols="12" sm="6" md="4">
                  <v-card variant="outlined" class="pa-3">
                    <v-checkbox
                      v-model="slot.selected"
                      :label="slot.name"
                      hide-details
                      density="compact"
                      :data-test="`compose-slot-${slot.slotId}`"
                    />
                    <v-select
                      v-model="slot.categories"
                      :items="categoryItems"
                      :label="t('plan.compose.slots.categories')"
                      :disabled="!slot.selected"
                      multiple
                      chips
                      hide-details
                      density="compact"
                      class="mt-2"
                    />
                    <v-switch
                      v-if="slot.categories.includes('hlavne')"
                      v-model="slot.withSoup"
                      :label="t('plan.compose.slots.withSoup')"
                      :disabled="!slot.selected"
                      color="primary"
                      hide-details
                      density="compact"
                      :data-test="`compose-soup-${slot.slotId}`"
                    />
                  </v-card>
                </v-col>
              </v-row>
              <v-alert
                v-if="!activeSlots.length"
                type="warning"
                density="compact"
                class="mt-2"
                :text="t('plan.compose.slots.none')"
              />
            </div>

            <v-autocomplete
              v-model="tagIds"
              :items="tagItems"
              :label="t('plan.compose.tags')"
              :hint="t('plan.compose.tagsHint')"
              persistent-hint
              multiple
              chips
              closable-chips
              density="compact"
            />

            <div class="d-flex flex-wrap align-center ga-3">
              <v-switch
                v-model="cookAhead"
                :label="t('plan.compose.leftovers.label')"
                color="primary"
                hide-details
                density="compact"
                class="flex-grow-0"
                data-test="compose-leftovers"
              />
              <v-btn-toggle
                v-if="cookAhead"
                v-model="leftoverDays"
                mandatory
                density="compact"
                variant="outlined"
                color="primary"
                divided
              >
                <v-btn v-for="n in MAX_LEFTOVER_DAYS" :key="n" :value="n">
                  {{ t('plan.compose.leftovers.days', { n }) }}
                </v-btn>
              </v-btn-toggle>
            </div>
            <p class="text-body-small text-medium-emphasis mt-n2">{{ t('plan.compose.leftovers.hint') }}</p>

            <v-checkbox v-model="replace" :label="t('plan.compose.replace')" hide-details density="compact" />
          </div>

          <!-- Krok 2 -->
          <div v-else-if="step === 2" class="d-flex flex-column ga-3">
            <p class="text-body-medium text-medium-emphasis">{{ t('plan.compose.paintHint') }}</p>
            <v-chip-group v-model="brush" mandatory :aria-label="t('plan.compose.brush')">
              <v-chip
                v-for="b in COMPOSE_BRUSHES"
                :key="b"
                :value="b"
                :color="BRUSH_COLORS[b]"
                :variant="brush === b ? 'flat' : 'tonal'"
                :class="{ 'text-decoration-line-through': b === 'skip' }"
                :data-test="`brush-${b}`"
              >
                {{ brushText(b) }}
              </v-chip>
            </v-chip-group>
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                size="small"
                variant="tonal"
                data-test="preset-workdays"
                @click="limits = weekdayLimits(dates, limits, 'workdays')"
              >
                {{ t('plan.compose.presets.workdays') }}
              </v-btn>
              <v-btn
                size="small"
                variant="tonal"
                data-test="preset-weekend"
                @click="limits = weekdayLimits(dates, limits, 'weekend')"
              >
                {{ t('plan.compose.presets.weekend') }}
              </v-btn>
            </div>

            <v-row dense align="center">
              <v-col cols="12" md="4" class="d-none d-md-block" />
              <v-col v-for="slot in activeSlots" :key="slot.slotId">
                <v-btn
                  block
                  variant="text"
                  class="text-none font-weight-bold"
                  :aria-label="t('plan.compose.paintColumn', { slot: slot.name })"
                  :data-test="`paint-column-${slot.slotId}`"
                  @click="grid = paintColumn(grid, dates, slot.slotId, brush)"
                >
                  {{ slot.name }}
                </v-btn>
              </v-col>
            </v-row>
            <v-row v-for="date in dates" :key="date" dense align="center">
              <v-col cols="12" md="4" class="d-flex align-center ga-2">
                <v-btn
                  variant="text"
                  class="text-none font-weight-bold"
                  :aria-label="t('plan.compose.paintRow', { day: dayLabel(date) })"
                  :data-test="`paint-row-${date}`"
                  @click="
                    grid = paintRow(
                      grid,
                      date,
                      activeSlots.map((s) => s.slotId),
                      brush,
                    )
                  "
                >
                  {{ dayLabel(date) }}
                </v-btn>
                <v-select
                  :model-value="limits[date] ?? null"
                  :items="limitItems"
                  :aria-label="t('plan.compose.limit')"
                  hide-details
                  density="compact"
                  :data-test="`limit-${date}`"
                  @update:model-value="setLimit(date, $event)"
                />
              </v-col>
              <v-col v-for="slot in activeSlots" :key="slot.slotId">
                <v-btn
                  block
                  height="48"
                  class="text-none"
                  :color="BRUSH_COLORS[grid[cellKey(date, slot.slotId)] ?? 'skip']"
                  :variant="(grid[cellKey(date, slot.slotId)] ?? 'skip') === 'skip' ? 'outlined' : 'flat'"
                  :aria-label="
                    t('plan.compose.cellAria', {
                      day: dayLabel(date),
                      slot: slot.name,
                      brush: brushText(grid[cellKey(date, slot.slotId)] ?? 'skip'),
                    })
                  "
                  :data-test="`cell-${date}-${slot.slotId}`"
                  @click="grid = paintCell(grid, date, slot.slotId, brush)"
                >
                  <span class="text-truncate">{{ cellText(date, slot.slotId) }}</span>
                </v-btn>
              </v-col>
            </v-row>
            <p class="text-body-medium font-weight-medium" data-test="compose-summary">{{ summaryText }}</p>
          </div>

          <!-- Krok 3 -->
          <div v-else class="d-flex flex-column ga-3" data-test="compose-review">
            <div class="d-flex flex-wrap align-center ga-2">
              <span class="text-body-medium font-weight-medium">{{ reviewSummary }}</span>
              <v-spacer />
              <v-btn
                :prepend-icon="mdiShuffleVariant"
                variant="tonal"
                :loading="compose.isPending.value"
                @click="propose"
              >
                {{ t('plan.compose.review.again') }}
              </v-btn>
            </div>
            <v-row v-for="date in dates" :key="date" dense>
              <v-col cols="12" md="2" class="text-title-small pt-3">{{ dayLabel(date) }}</v-col>
              <v-col v-for="slot in activeSlots" :key="slot.slotId" cols="12" :md="true">
                <div class="text-label-medium text-medium-emphasis mb-1 d-md-none">{{ slot.name }}</div>
                <div class="d-flex flex-column ga-2">
                  <v-card
                    v-for="it in itemsIn(date, slot.slotId)"
                    :key="it.key"
                    :variant="it.recipeId ? 'tonal' : 'outlined'"
                    :color="it.leftoverOf ? 'secondary' : it.recipeId ? 'primary' : undefined"
                    density="compact"
                    :data-test="`review-item-${it.key}`"
                  >
                    <v-card-item class="pa-2">
                      <div v-if="withSoup.has(it.slotId)" class="text-label-small text-medium-emphasis">
                        {{ t(`plan.compose.review.${it.course}`) }}
                      </div>
                      <div
                        class="text-body-medium font-weight-bold text-high-emphasis"
                        :class="{ 'font-italic font-weight-regular': !it.recipeId }"
                      >
                        {{ it.title ?? t('plan.compose.review.empty') }}
                      </div>
                      <div class="d-flex flex-wrap ga-1 mt-1">
                        <v-chip v-if="it.leftoverOf" size="x-small" color="secondary" variant="flat">
                          {{ t('plan.compose.review.leftoverOf', { day: sourceDay(it) }) }}
                        </v-chip>
                        <v-chip
                          v-if="it.totalMinutes !== null && !it.leftoverOf"
                          size="x-small"
                          variant="outlined"
                        >
                          {{ formatMinutes(it.totalMinutes) }}
                        </v-chip>
                        <v-chip
                          v-if="repeats.get(it.key)?.length"
                          size="x-small"
                          color="warning"
                          variant="flat"
                          data-test="repeats-badge"
                        >
                          {{
                            t('plan.compose.review.repeats', {
                              days: repeats
                                .get(it.key)!
                                .map((d) => formatDayLabel(d).short)
                                .join(', '),
                            })
                          }}
                        </v-chip>
                      </div>
                      <div
                        v-for="(w, index) in it.warnings"
                        :key="index"
                        class="d-flex align-center ga-1 text-body-small mt-1"
                        :class="w.kind === 'allergy' ? 'text-error' : 'text-warning'"
                      >
                        <v-icon :icon="mdiAlertOutline" size="14" />{{ warningText(w) }}
                      </div>
                    </v-card-item>
                    <v-card-actions class="pa-1 pt-0 flex-wrap ga-1" style="min-height: 0">
                      <template v-if="it.leftoverOf">
                        <v-btn size="small" variant="text" :prepend-icon="mdiClose" @click="onClear(it.key)">
                          {{ t('plan.compose.review.clearLeftover') }}
                        </v-btn>
                      </template>
                      <template v-else>
                        <v-btn
                          :icon="mdiRefresh"
                          size="small"
                          variant="text"
                          :aria-label="t('plan.compose.review.other')"
                          :title="t('plan.compose.review.other')"
                          :disabled="it.options.length < 2 && !!it.recipeId"
                          :data-test="`other-${it.key}`"
                          @click="onOther(it.key)"
                        />
                        <v-btn
                          :icon="mdiMagnify"
                          size="small"
                          variant="text"
                          :aria-label="t('plan.compose.review.pick')"
                          :title="t('plan.compose.review.pick')"
                          @click="onPick(it.key)"
                        />
                        <v-btn
                          v-if="it.recipeId"
                          :icon="mdiClose"
                          size="small"
                          variant="text"
                          :aria-label="t('plan.compose.review.clear')"
                          :title="t('plan.compose.review.clear')"
                          @click="onClear(it.key)"
                        />
                        <v-spacer />
                        <v-btn-toggle
                          v-if="it.recipeId && isMeal(it)"
                          :model-value="it.leftoverDays"
                          mandatory
                          density="compact"
                          variant="outlined"
                          divided
                          @update:model-value="onLeftovers(it.key, $event)"
                        >
                          <v-btn
                            v-for="n in MAX_LEFTOVER_DAYS + 1"
                            :key="n"
                            :value="n - 1"
                            size="x-small"
                            :aria-label="t('plan.compose.leftovers.daysAria', { n: n - 1 })"
                            :data-test="`leftover-${it.key}-${n - 1}`"
                          >
                            +{{ n - 1 }}
                          </v-btn>
                        </v-btn-toggle>
                      </template>
                    </v-card-actions>
                  </v-card>
                </div>
              </v-col>
            </v-row>
          </div>

          <v-alert v-if="error" type="error" density="compact" class="mt-3" :text="error" />
        </v-container>
      </v-card-text>

      <v-divider />
      <v-card-actions class="px-4 py-3 flex-wrap ga-2">
        <v-btn v-if="step > 1" variant="text" data-test="compose-back" @click="back">
          {{ t('plan.compose.back') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          v-if="step === 1"
          color="primary"
          variant="flat"
          :disabled="!canContinue"
          data-test="compose-next"
          @click="goToPaint"
        >
          {{ t('plan.compose.next') }}
        </v-btn>
        <v-btn
          v-else-if="step === 2"
          color="primary"
          variant="flat"
          :disabled="!gridCells(grid).length"
          :loading="compose.isPending.value"
          data-test="compose-next"
          @click="propose"
        >
          {{ t('plan.compose.next') }}
        </v-btn>
        <v-btn
          v-else
          color="primary"
          variant="flat"
          :loading="apply.isPending.value"
          data-test="compose-confirm"
          @click="confirm"
        >
          {{ t('plan.compose.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="pickOpen" max-width="480">
    <v-card :title="t('plan.compose.pick.title')">
      <v-card-text>
        <v-autocomplete
          v-model="pickRecipeId"
          :items="recipeItems"
          :label="t('plan.compose.pick.recipe')"
          autofocus
          hide-details
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="pickOpen = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :disabled="!picked || picked.id !== pickRecipeId" @click="confirmPick">
          {{ t('plan.compose.pick.choose') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
