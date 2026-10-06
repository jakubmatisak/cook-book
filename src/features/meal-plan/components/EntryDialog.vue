<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FamilyMemberDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { entryPortions } from '@shared/portions'
import { planEntryInputSchema } from '@shared/schemas/plan'
import { useDeleteEntry, useSaveEntry } from '@/api/plan'
import { useRecipe, useRecipes } from '@/api/recipes'
import { describeWarning, preferenceConflicts } from '@shared/preferences'
import { describeIssues } from '@/features/recipes/form'
import { matchesSearch } from '@/lib/search'

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
}>()

const mode = ref<'recipe' | 'text'>('recipe')
const recipeId = ref<string | null>(null)
const freeText = ref('')
const servings = ref<number | null>(null)
const note = ref('')
const date = ref('')
const slotId = ref('')
const error = ref('')
const confirmDelete = ref(false)

const { data: recipeList } = useRecipes(() => ({}))

// Upozornenie na alergie, averzie a diéty rodiny pri vybranom recepte (recept sa nezakazuje).
const selectedRecipeId = computed(() => (mode.value === 'recipe' ? recipeId.value : null))
const { data: selectedRecipe } = useRecipe(() => selectedRecipeId.value ?? undefined)
const warnings = computed(() => {
  const recipe = selectedRecipe.value
  if (!recipe || recipe.id !== selectedRecipeId.value) return []
  return preferenceConflicts(
    { ingredientIds: recipe.ingredients.map((i) => i.ingredientId), tagIds: recipe.tags.map((t) => t.id) },
    props.members,
    props.entry?.audience ?? 'all',
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
    items.unshift({ title: `${current.title} (zmazaný)`, value: current.id })
  }
  return items
})

const slotItems = computed(() => props.slots.map((s) => ({ title: s.name, value: s.id })))
const dateItems = computed(() =>
  props.dates.map((d) => {
    const label = formatDayLabel(d)
    return { title: `${label.long} ${label.date}`, value: d }
  }),
)

const defaultPortions = computed(() => {
  const fromMembers = entryPortions({ servingsOverride: null, audience: 'all' }, props.members)
  if (fromMembers !== null) return `${String(fromMembers).replace('.', ',')} podľa rodiny`
  const recipe = recipes.value?.find((r) => r.id === recipeId.value)
  return recipe ? `${recipe.servings} podľa receptu` : 'podľa receptu'
})

const slotName = computed(() => props.slots.find((s) => s.id === slotId.value)?.name ?? '')
const dayLabel = computed(() => (date.value ? formatDayLabel(date.value) : null))

function buildInput() {
  return {
    date: date.value,
    slotId: slotId.value,
    recipeId: mode.value === 'recipe' ? recipeId.value : null,
    freeText: mode.value === 'text' ? freeText.value : null,
    servingsOverride: servings.value || null,
    note: note.value,
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
    error.value = e instanceof Error ? e.message : 'Uloženie zlyhalo.'
  }
}

async function onDelete() {
  if (!props.entry) return
  try {
    await remove.mutateAsync(props.entry.id)
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Zmazanie zlyhalo.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card
      :title="entry ? 'Upraviť jedlo' : 'Pridať jedlo'"
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
          <v-btn value="recipe">Recept</v-btn>
          <v-btn value="text">Vlastný text</v-btn>
        </v-btn-toggle>

        <v-autocomplete
          v-if="mode === 'recipe'"
          v-model="recipeId"
          :items="recipeItems"
          :custom-filter="(value: string, query: string) => matchesSearch(value, query)"
          label="Recept"
          no-data-text="Žiadny recept sa nenašiel"
          autofocus
          hide-details
        />
        <v-text-field
          v-else
          v-model="freeText"
          autocomplete="off"
          label="Čo sa bude jesť"
          placeholder="napr. zvyšky, ideme von, chlieb s maslom"
          autofocus
          hide-details
        />

        <v-alert
          v-if="warnings.length"
          :type="warnings.some((w) => w.kind === 'allergy') ? 'error' : 'warning'"
          density="compact"
          title="Pozor pri tomto jedle"
          data-test="entry-warnings"
        >
          <ul class="ps-4">
            <li v-for="w in warnings" :key="w.memberId + w.kind + w.label">{{ describeWarning(w) }}</li>
          </ul>
        </v-alert>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-number-input
              v-model="servings"
              label="Porcie"
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
            <v-text-field v-model="note" autocomplete="off" label="Poznámka" hide-details />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="date" :items="dateItems" label="Deň" hide-details />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="slotId" :items="slotItems" label="Jedlo" hide-details />
          </v-col>
        </v-row>

        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="flex-wrap">
        <template v-if="entry">
          <v-btn v-if="!confirmDelete" color="error" variant="text" @click="confirmDelete = true"
            >Zmazať</v-btn
          >
          <v-btn v-else color="error" :loading="remove.isPending.value" @click="onDelete"
            >Naozaj zmazať</v-btn
          >
        </template>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn v-if="entry" variant="tonal" :loading="save.isPending.value" @click="submit(true)"
          >Uložiť ako kópiu</v-btn
        >
        <v-btn color="primary" :loading="save.isPending.value" @click="submit()">{{
          entry ? 'Uložiť' : 'Pridať'
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
