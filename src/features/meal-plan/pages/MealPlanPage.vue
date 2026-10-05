<script setup lang="ts">
import { mdiCalendarToday, mdiChevronLeft, mdiChevronRight, mdiContentCopy, mdiDotsVertical } from '@mdi/js'
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import type { PlanEntryDto } from '@shared/api'
import { addDays, formatWeekRange, todayIso, weekDates } from '@shared/dates'
import { useMe } from '@/api/me'
import { useCopyPlan, usePlan } from '@/api/plan'
import { plural } from '@/lib/format'
import EntryDialog from '../components/EntryDialog.vue'
import WeekGrid from '../components/WeekGrid.vue'
import WeekList from '../components/WeekList.vue'
import { groupEntries, resolveWeekStart, visibleSlots } from '../week'

const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()
const { data: me } = useMe()

const today = todayIso()
const weekStartsOn = computed(() => me.value?.settings.weekStartsOn ?? 1)
const start = computed(() =>
  resolveWeekStart(
    typeof route.query.tyzden === 'string' ? route.query.tyzden : undefined,
    weekStartsOn.value,
    today,
  ),
)
const dates = computed(() => weekDates(start.value))
const isCurrentWeek = computed(() => dates.value.includes(today))

const { data: entries, isPending, error } = usePlan(start, () => addDays(start.value, 6))
const groups = computed(() => groupEntries(entries.value ?? []))
const slots = computed(() => visibleSlots(me.value?.slots ?? [], entries.value ?? []))
const members = computed(() => me.value?.members ?? [])

function goToWeek(startIso: string | undefined) {
  void router.replace({ query: startIso ? { tyzden: startIso } : {} })
}

async function goToday() {
  goToWeek(undefined)
  await nextTick()
  if (!mdAndUp.value)
    document.getElementById(`den-${today}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Dialóg jedla
const dialogOpen = ref(false)
const editing = ref<PlanEntryDto | null>(null)
const dialogDate = ref(today)
const dialogSlot = ref('')

function onAdd(date: string, slotId: string) {
  editing.value = null
  dialogDate.value = date
  dialogSlot.value = slotId
  dialogOpen.value = true
}

function onEdit(entry: PlanEntryDto) {
  editing.value = entry
  dialogDate.value = entry.date
  dialogSlot.value = entry.slotId
  dialogOpen.value = true
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
    goToWeek(nextWeek.value)
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
  <div class="tw:flex tw:flex-col tw:gap-4">
    <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <h1 class="text-h5 tw:mr-auto">Jedálniček</h1>
      <div class="tw:flex tw:items-center tw:gap-1">
        <v-btn
          :icon="mdiChevronLeft"
          variant="text"
          aria-label="Predošlý týždeň"
          @click="goToWeek(addDays(start, -7))"
        />
        <span class="text-body-1 tw:min-w-36 tw:text-center tw:font-semibold">{{
          formatWeekRange(start)
        }}</span>
        <v-btn
          :icon="mdiChevronRight"
          variant="text"
          aria-label="Ďalší týždeň"
          @click="goToWeek(addDays(start, 7))"
        />
        <v-btn
          v-if="!isCurrentWeek"
          :prepend-icon="mdiCalendarToday"
          variant="tonal"
          size="small"
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
          </v-list>
        </v-menu>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" :text="error.message" />
    <v-skeleton-loader v-else-if="isPending" type="table" />
    <template v-else>
      <v-alert v-if="!members.length" type="info" variant="tonal" density="compact">
        Pridaj členov rodiny v sekcii
        <router-link to="/rodina" class="text-primary tw:font-semibold">Rodina</router-link>
        a porcie sa budú počítať automaticky.
      </v-alert>
      <WeekGrid
        v-if="mdAndUp"
        :dates="dates"
        :slots="slots"
        :groups="groups"
        :members="members"
        :today="today"
        @add="onAdd"
        @edit="onEdit"
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
    </template>

    <EntryDialog
      v-model="dialogOpen"
      :entry="editing"
      :initial-date="dialogDate"
      :initial-slot-id="dialogSlot"
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
            class="tw:mt-2"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="copyOpen = false">Zrušiť</v-btn>
          <v-btn color="primary" variant="flat" :loading="copy.isPending.value" @click="copyToNextWeek">
            Kopírovať
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{
      snackbar.text
    }}</v-snackbar>
  </div>
</template>
