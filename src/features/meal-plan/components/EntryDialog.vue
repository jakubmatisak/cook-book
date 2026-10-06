<script setup lang="ts">
import { slotName as displaySlotName } from '@/i18n/defaults'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto, GuestStayDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { entryPortions } from '@shared/portions'
import { planEntryInputSchema } from '@shared/schemas/plan'
import { useDeleteEntry, useSaveEntry } from '@/api/plan'
import { useRecipe, useRecipes } from '@/api/recipes'
import { preferenceConflicts } from '@shared/preferences'
import { describeIssues } from '@/features/recipes/form'
import { errorText } from '@/i18n/errors'
import { formatDayLabel, formatNumber } from '@/i18n/format'
import { matchesSearch } from '@/lib/search'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  /** Upravovaný záznam; null = nový. */
  entry: PlanEntryDto | null
  initialDate: string
  initialSlotId: string
  /** Predvolený recept pri pridávaní nového jedla (napr. z detailu receptu). */
  initialRecipeId?: string | null
  slots: MealSlotDto[]
  dates: string[]
  members: FamilyMemberDto[]
  /** Pobyty návštev v zobrazenom týždni (návšteva podľa pobytu sa počíta automaticky). */
  stays?: GuestStayDto[]
}>()

const mode = ref<'recipe' | 'text'>('recipe')
const recipeId = ref<string | null>(null)
const freeText = ref('')
const servings = ref<number | null>(null)
const guestIds = ref<string[]>([])
const note = ref('')
const date = ref('')
const slotId = ref('')
const error = ref('')
const confirmDelete = ref(false)

const { data: recipeList } = useRecipes(() => ({ kids: 'include' }))

// Návštevy pri jedle: ručne vybrané aj tie, ktorých pobyt pokrýva zvolený deň.
const stayGuestIds = computed(() => [
  ...new Set(
    (props.stays ?? [])
      .filter((s) => s.fromDate <= date.value && date.value <= s.toDate)
      .map((s) => s.memberId),
  ),
])
const presentGuestIds = computed(() => [...new Set([...guestIds.value, ...stayGuestIds.value])])
const stayGuestNames = computed(() =>
  props.members
    .filter((m) => stayGuestIds.value.includes(m.id) && !guestIds.value.includes(m.id))
    .map((m) => m.name),
)

// Upozornenie na alergie, averzie a diéty rodiny pri vybranom recepte (recept sa nezakazuje).
const selectedRecipeId = computed(() => (mode.value === 'recipe' ? recipeId.value : null))
const { data: selectedRecipe } = useRecipe(() => selectedRecipeId.value ?? undefined)
const warnings = computed(() => {
  const recipe = selectedRecipe.value
  if (!recipe || recipe.id !== selectedRecipeId.value) return []
  return preferenceConflicts(
    {
      ingredientIds: recipe.ingredients.map((i) => i.ingredientId),
      tagIds: recipe.tags.map((tag) => tag.id),
    },
    props.members,
    props.entry?.audience ?? 'all',
    presentGuestIds.value,
  )
})
const recipes = computed(() => recipeList.value?.items)
const save = useSaveEntry()
const remove = useDeleteEntry()

watch(open, (isOpen) => {
  if (!isOpen) return
  const e = props.entry
  mode.value = e && !e.recipeId ? 'text' : 'recipe'
  recipeId.value = e ? e.recipeId : (props.initialRecipeId ?? null)
  freeText.value = e?.freeText ?? ''
  servings.value = e?.servingsOverride ?? null
  guestIds.value = e ? [...e.guestIds] : []
  note.value = e?.note ?? ''
  date.value = e?.date ?? props.initialDate
  slotId.value = e?.slotId ?? props.initialSlotId
  error.value = ''
  confirmDelete.value = false
})

const recipeItems = computed(() => {
  const items = (recipes.value ?? []).map((r) => ({ title: r.title, value: r.id }))
  const current = props.entry?.recipe
  if (current && !items.some((i) => i.value === current.id)) {
    items.unshift({ title: t('plan.entry.deletedRecipe', { title: current.title }), value: current.id })
  }
  return items
})

// Návštevy z Rodiny (aktívne); pri jedle sa vyberajú ručne, inak sa nepočítajú do porcií ani upozornení.
const guestItems = computed(() =>
  props.members
    .filter((m) => m.kind === 'guest' && (m.isActive || guestIds.value.includes(m.id)))
    .map((m) => ({ title: m.name, value: m.id })),
)

const slotItems = computed(() => props.slots.map((s) => ({ title: displaySlotName(s.name), value: s.id })))
const dateItems = computed(() =>
  props.dates.map((d) => {
    const label = formatDayLabel(d)
    return { title: `${label.long} ${label.date}`, value: d }
  }),
)

const defaultPortions = computed(() => {
  const fromMembers = entryPortions(
    { servingsOverride: null, audience: 'all', guestIds: presentGuestIds.value },
    props.members,
  )
  if (fromMembers !== null) return t('plan.entry.portionsFromFamily', { n: formatNumber(fromMembers) })
  const recipe = recipes.value?.find((r) => r.id === recipeId.value)
  return recipe
    ? t('plan.entry.portionsFromRecipe', { n: formatNumber(recipe.servings) })
    : t('plan.entry.portionsByRecipe')
})

const slotName = computed(() => {
  const name = props.slots.find((s) => s.id === slotId.value)?.name
  return name ? displaySlotName(name) : ''
})
const dayLabel = computed(() => (date.value ? formatDayLabel(date.value) : null))

function buildInput() {
  return {
    date: date.value,
    slotId: slotId.value,
    recipeId: mode.value === 'recipe' ? recipeId.value : null,
    freeText: mode.value === 'text' ? freeText.value : null,
    servingsOverride: servings.value || null,
    note: note.value,
    guestIds: guestIds.value,
  }
}

async function submit(asCopy = false) {
  error.value = ''
  const input = buildInput()
  const parsed = planEntryInputSchema.safeParse(input)
  if (!parsed.success) {
    error.value = describeIssues(parsed.error.issues)
      .map((m) => m.replace(/^recipeId: /, ''))
      .join(' ')
    return
  }
  try {
    await save.mutateAsync({ id: asCopy ? undefined : props.entry?.id, input })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.entry.errors.saveFailed')
  }
}

async function onDelete() {
  if (!props.entry) return
  try {
    await remove.mutateAsync(props.entry.id)
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'plan.entry.errors.deleteFailed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card
      :title="entry ? t('plan.entry.editTitle') : t('plan.entry.addTitle')"
      :subtitle="dayLabel ? `${slotName} · ${dayLabel.long} ${dayLabel.date}` : ''"
    >
      <v-card-text class="d-flex flex-column ga-4">
        <v-btn-toggle
          v-model="mode"
          mandatory
          selected-class="bg-primary"
          variant="outlined"
          divided
          density="comfortable"
        >
          <v-btn value="recipe">{{ t('plan.entry.modeRecipe') }}</v-btn>
          <v-btn value="text">{{ t('plan.entry.modeText') }}</v-btn>
        </v-btn-toggle>

        <v-autocomplete
          v-if="mode === 'recipe'"
          v-model="recipeId"
          :items="recipeItems"
          :custom-filter="(value: string, query: string) => matchesSearch(value, query)"
          :label="t('plan.entry.recipe')"
          :no-data-text="t('plan.entry.noRecipe')"
          autofocus
          hide-details
        />
        <v-text-field
          v-else
          v-model="freeText"
          autocomplete="off"
          :label="t('plan.entry.freeText')"
          :placeholder="t('plan.entry.freeTextPlaceholder')"
          autofocus
          hide-details
        />

        <v-alert
          v-if="warnings.length"
          :type="warnings.some((w) => w.kind === 'allergy') ? 'error' : 'warning'"
          density="compact"
          :title="t('plan.entry.warningsTitle')"
          data-test="entry-warnings"
        >
          <ul class="ps-4">
            <li v-for="w in warnings" :key="w.memberId + w.kind + w.label">
              {{ t(`common.preference.warning.${w.kind}`, { name: w.memberName, label: w.label }) }}
            </li>
          </ul>
        </v-alert>

        <v-select
          v-if="guestItems.length"
          v-model="guestIds"
          :items="guestItems"
          :label="t('plan.entry.guests')"
          multiple
          chips
          closable-chips
          clearable
          hide-details
          data-test="entry-guests"
        />
        <p v-if="stayGuestNames.length" class="text-caption text-medium-emphasis" data-test="entry-stay-hint">
          {{ t('plan.stays.entryHint', { names: stayGuestNames.join(', ') }) }}
        </p>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-number-input
              v-model="servings"
              :label="t('plan.entry.portions')"
              :placeholder="defaultPortions"
              persistent-placeholder
              :min="0.5"
              :max="100"
              :step="0.5"
              :precision="null"
              control-variant="split"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="note" autocomplete="off" :label="t('plan.entry.note')" hide-details />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="date" :items="dateItems" :label="t('plan.entry.day')" hide-details />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="slotId" :items="slotItems" :label="t('plan.entry.meal')" hide-details />
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="flex-wrap">
        <template v-if="entry">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true">{{
            t('common.actions.delete')
          }}</v-btn>
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete">{{
            t('plan.confirmDelete')
          }}</v-btn>
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn v-if="entry" variant="tonal" :loading="save.isPending.value" @click="submit(true)">{{
          t('plan.entry.saveAsCopy')
        }}</v-btn>
        <v-btn color="primary" :loading="save.isPending.value" @click="submit()">{{
          entry ? t('common.actions.save') : t('common.actions.add')
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
