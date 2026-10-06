<script setup lang="ts">
import {
  mdiCalendarToday,
  mdiChevronLeft,
  mdiChevronRight,
  mdiContentCopy,
  mdiContentSaveOutline,
  mdiDotsVertical,
  mdiCalendarImport,
  mdiPrinterOutline,
} from '@mdi/js'
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PlanEntryDto, TemplateApplyResult, WeekTemplateDto } from '@shared/api'
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABELS, type RecipeCategory } from '@shared/recipes'
import { addDays, formatWeekRange, weekDates } from '@shared/dates'
import { useMe } from '@/api/me'
import { useCopyPlan, useDeleteEntry, usePlan, useSaveEntry } from '@/api/plan'
import PageHeader from '@/components/PageHeader.vue'
import { useElementWidth } from '@/composables/useElementWidth'
import { useToday } from '@/composables/useToday'
import { printPage } from '@/composables/usePrintMode'
import { plural } from '@/lib/format'
import ApplyTemplateDialog from '../components/ApplyTemplateDialog.vue'
import EntryDialog from '../components/EntryDialog.vue'
import SaveTemplateDialog from '../components/SaveTemplateDialog.vue'
import SuggestionsCard from '../components/SuggestionsCard.vue'
import WeekGrid from '../components/WeekGrid.vue'
import WeekList from '../components/WeekList.vue'
import {
  entryToInput,
  filterEntriesByCategory,
  groupEntries,
  moveTarget,
  gridFits,
  pickSlotForNow,
  resolveWeekStart,
  visibleSlots,
} from '../week'

const route = useRoute()
const router = useRouter()
// Mriežka len keď sa zmestí do šírky obsahu, inak zoznam po dňoch (vodorovný posuvník je nepríjemný).
const area = ref<HTMLElement>()
const areaWidth = useElementWidth(area, typeof window === 'undefined' ? 0 : window.innerWidth)
const canGrid = computed(() => gridFits(areaWidth.value))
const { data: me } = useMe()

const today = useToday()
const weekStartsOn = computed(() => me.value?.settings.weekStartsOn ?? 1)
const start = computed(() =>
  resolveWeekStart(
    typeof route.query.tyzden === 'string' ? route.query.tyzden : undefined,
    weekStartsOn.value,
    today.value,
  ),
)
const dates = computed(() => weekDates(start.value))
const isCurrentWeek = computed(() => dates.value.includes(today.value))

const { data: entries, isPending, error } = usePlan(start, () => addDays(start.value, 6))
// Filter podľa typu jedla (dezert, polievka…): chipy ukazujú typy, ktoré sa v týždni vyskytujú, a zvolené.
const selectedCategories = ref<RecipeCategory[]>([])
const categoryOptions = computed(() => {
  const present = new Set<RecipeCategory>(selectedCategories.value)
  for (const e of entries.value ?? []) if (e.recipe) present.add(e.recipe.category)
  return RECIPE_CATEGORIES.filter((c) => present.has(c)).map((c) => ({
    value: c,
    title: RECIPE_CATEGORY_LABELS[c],
  }))
})
const shownEntries = computed(() => filterEntriesByCategory(entries.value ?? [], selectedCategories.value))
const groups = computed(() => groupEntries(shownEntries.value))
const slots = computed(() => visibleSlots(me.value?.slots ?? [], entries.value ?? []))
const members = computed(() => me.value?.members ?? [])

const goToWeek = (startIso: string | undefined) =>
  router.replace({ query: startIso ? { tyzden: startIso } : {} })

async function goToday() {
  await goToWeek(undefined)
  await nextTick()
  if (!canGrid.value) {
    document.getElementById(`den-${today.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Dialóg jedla
const dialogOpen = ref(false)
const editing = ref<PlanEntryDto | null>(null)
const dialogDate = ref(today.value)
const dialogSlot = ref('')
const dialogRecipe = ref<string | undefined>(undefined)

function onAdd(date: string, slotId: string) {
  dialogRecipe.value = undefined
  editing.value = null
  dialogDate.value = date
  dialogSlot.value = slotId
  dialogOpen.value = true
}

function onEdit(entry: PlanEntryDto) {
  dialogRecipe.value = undefined
  editing.value = entry
  dialogDate.value = entry.date
  dialogSlot.value = entry.slotId
  dialogOpen.value = true
}

// Návrh „čo uvariť dnes“: otvorí dialóg s receptom na dnes a najbližšie jedlo dňa
function onPlanSuggestion(recipeId: string) {
  const now = new Date()
  const slot = pickSlotForNow(me.value?.slots ?? [], now.getHours() * 60 + now.getMinutes())
  editing.value = null
  dialogRecipe.value = recipeId
  dialogDate.value = today.value
  dialogSlot.value = slot?.id ?? ''
  dialogOpen.value = true
}

const printWeek = () => printPage()

// Šablóny týždňov
const saveTemplateOpen = ref(false)
const applyTemplateOpen = ref(false)

function onTemplateSaved(template: WeekTemplateDto) {
  snackbar.value = { show: true, text: `Šablóna „${template.name}“ je uložená.`, color: 'success' }
}

function onTemplateApplied(result: TemplateApplyResult) {
  const skipped = result.skipped
    ? ` (${plural(result.skipped, 'jedlo', 'jedlá', 'jedál')} bez receptu sa vynechalo)`
    : ''
  snackbar.value = {
    show: true,
    text: `Vložené: ${plural(result.applied, 'jedlo', 'jedlá', 'jedál')}${skipped}.`,
    color: 'success',
  }
}

// Presúvanie a kopírovanie jedál myšou v mriežke
const saveEntry = useSaveEntry()
const deleteEntry = useDeleteEntry()
const undo = ref<(() => Promise<void>) | null>(null)

async function onMove(entry: PlanEntryDto, date: string, slotId: string, copyEntry: boolean) {
  const target = moveTarget(entry, date, slotId)
  if (!copyEntry && !target) return
  try {
    if (copyEntry) {
      const created = await saveEntry.mutateAsync({ input: entryToInput(entry, date, slotId) })
      undo.value = async () => void (await deleteEntry.mutateAsync(created.id))
    } else {
      const from = { date: entry.date, slotId: entry.slotId }
      await saveEntry.mutateAsync({ id: entry.id, input: entryToInput(entry, date, slotId) })
      undo.value = async () =>
        void (await saveEntry.mutateAsync({
          id: entry.id,
          input: entryToInput(entry, from.date, from.slotId),
        }))
    }
    snackbar.value = {
      show: true,
      text: copyEntry ? 'Jedlo skopírované.' : 'Jedlo presunuté.',
      color: 'success',
    }
  } catch (e) {
    undo.value = null
    snackbar.value = { show: true, text: e instanceof Error ? e.message : 'Presun zlyhal.', color: 'error' }
  }
}

async function onUndo() {
  const run = undo.value
  undo.value = null
  snackbar.value.show = false
  try {
    await run?.()
  } catch (e) {
    snackbar.value = {
      show: true,
      text: e instanceof Error ? e.message : 'Vrátenie zlyhalo.',
      color: 'error',
    }
  }
}

// Kopírovanie týždňa
const copy = useCopyPlan()
const copyOpen = ref(false)
const copyReplace = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })
const nextWeek = computed(() => addDays(start.value, 7))

async function copyToNextWeek() {
  try {
    const result = await copy.mutateAsync({
      fromDate: start.value,
      toDate: nextWeek.value,
      days: 7,
      replace: copyReplace.value,
    })
    copyOpen.value = false
    snackbar.value = {
      show: true,
      text: `Skopírované: ${plural(result.copied, 'jedlo', 'jedlá', 'jedál')}.`,
      color: 'success',
    }
    await goToWeek(nextWeek.value)
  } catch (e) {
    snackbar.value = {
      show: true,
      text: e instanceof Error ? e.message : 'Kopírovanie zlyhalo.',
      color: 'error',
    }
  }
}
</script>

<template>
  <PageHeader title="Jedálniček">
    <v-btn-group variant="outlined" density="comfortable" divided>
      <v-btn :icon="mdiChevronLeft" aria-label="Predošlý týždeň" @click="goToWeek(addDays(start, -7))" />
      <v-btn class="text-none font-weight-bold" style="min-width: 11rem">{{ formatWeekRange(start) }}</v-btn>
      <v-btn :icon="mdiChevronRight" aria-label="Ďalší týždeň" @click="goToWeek(addDays(start, 7))" />
    </v-btn-group>
    <v-btn
      v-if="!isCurrentWeek"
      :prepend-icon="mdiCalendarToday"
      variant="tonal"
      color="primary"
      @click="goToday"
    >
      Dnes
    </v-btn>
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" :icon="mdiDotsVertical" variant="text" aria-label="Ďalšie akcie" />
      </template>
      <v-list>
        <v-list-item
          :prepend-icon="mdiContentCopy"
          title="Kopírovať do ďalšieho týždňa"
          :disabled="!entries?.length"
          @click="copyOpen = true"
        />
        <v-list-item
          :prepend-icon="mdiContentSaveOutline"
          title="Uložiť týždeň ako šablónu"
          :disabled="!entries?.length"
          @click="saveTemplateOpen = true"
        />
        <v-list-item :prepend-icon="mdiPrinterOutline" title="Tlačiť týždeň" @click="printWeek" />
        <v-list-item
          :prepend-icon="mdiCalendarImport"
          title="Použiť šablónu na tento týždeň"
          @click="applyTemplateOpen = true"
        />
      </v-list>
    </v-menu>
  </PageHeader>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="table" />
  <div v-else ref="area">
    <v-alert v-if="!members.length" type="info" density="compact" class="mb-4 d-print-none">
      Pridaj členov rodiny v sekcii
      <router-link to="/rodina" class="text-primary font-weight-bold">Rodina</router-link>
      a porcie sa budú počítať automaticky.
    </v-alert>
    <v-chip-group
      v-if="categoryOptions.length > 1 || selectedCategories.length"
      v-model="selectedCategories"
      multiple
      filter
      color="primary"
      class="mb-3 d-print-none"
      aria-label="Typ jedla"
      data-test="category-filter"
    >
      <v-chip
        v-for="option in categoryOptions"
        :key="option.value"
        :value="option.value"
        variant="outlined"
        filter
      >
        {{ option.title }}
      </v-chip>
    </v-chip-group>
    <SuggestionsCard v-if="isCurrentWeek" class="d-print-none" :date="today" @plan="onPlanSuggestion" />
    <WeekGrid
      v-if="canGrid"
      :dates="dates"
      :slots="slots"
      :groups="groups"
      :members="members"
      :today="today"
      @add="onAdd"
      @edit="onEdit"
      @move="onMove"
    />
    <WeekList
      v-else
      :dates="dates"
      :slots="slots"
      :groups="groups"
      :members="members"
      :today="today"
      @add="onAdd"
      @edit="onEdit"
    />
  </div>

  <EntryDialog
    v-model="dialogOpen"
    :entry="editing"
    :initial-date="dialogDate"
    :initial-slot-id="dialogSlot"
    :initial-recipe-id="dialogRecipe"
    :slots="me?.slots ?? []"
    :dates="dates"
    :members="members"
  />

  <v-dialog v-model="copyOpen" max-width="440">
    <v-card title="Kopírovať do ďalšieho týždňa">
      <v-card-text>
        Všetky jedlá z týždňa {{ formatWeekRange(start) }} sa skopírujú do týždňa
        {{ formatWeekRange(nextWeek) }}.
        <v-checkbox
          v-model="copyReplace"
          label="Nahradiť jedlá, ktoré tam už sú"
          hide-details
          density="compact"
          class="mt-2"
        />
      </v-card-text>
      <v-card-actions class="flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="copyOpen = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="copy.isPending.value" @click="copyToNextWeek">Kopírovať</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <SaveTemplateDialog
    v-model="saveTemplateOpen"
    :from-date="start"
    :entry-count="entries?.length ?? 0"
    @saved="onTemplateSaved"
  />
  <ApplyTemplateDialog v-model="applyTemplateOpen" :to-date="start" @applied="onTemplateApplied" />

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
    {{ snackbar.text }}
    <template v-if="undo" #actions>
      <v-btn variant="text" @click="onUndo">Späť</v-btn>
    </template>
  </v-snackbar>
</template>
