<script setup lang="ts">
import { mdiDownload } from '@mdi/js'
import { ref, watch } from 'vue'
import { useUpdateSettings, useUpdateSlot } from '@/api/family'
import { ApiError, downloadFile } from '@/api/http'
import { useMe } from '@/api/me'
import { plural } from '@/lib/format'

const { data: me, isPending, error } = useMe()

const snackbar = ref({ show: false, text: '', color: 'error' })
const updateSlot = useUpdateSlot()
const updateSettings = useUpdateSettings()

const WEEK_STARTS: { value: 0 | 1 | 6; title: string }[] = [
  { value: 1, title: 'Pondelok' },
  { value: 0, title: 'Nedeľa' },
  { value: 6, title: 'Sobota' },
]

const childFactor = ref(0.5)
watch(
  () => me.value?.settings.childPortionFactor,
  (value) => {
    if (value !== undefined) childFactor.value = value
  },
  { immediate: true },
)

async function run(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (e) {
    snackbar.value = {
      show: true,
      text: e instanceof Error ? e.message : 'Zmena sa neuložila.',
      color: 'error',
    }
  }
}

const toggleSlot = (id: string, isEnabled: boolean | null) =>
  run(() => updateSlot.mutateAsync({ id, patch: { isEnabled: Boolean(isEnabled) } }))
const setWeekStart = (value: number) =>
  run(() => updateSettings.mutateAsync({ weekStartsOn: value as 0 | 1 | 6 }))
const saveChildFactor = (value: number) =>
  run(() => updateSettings.mutateAsync({ childPortionFactor: value }))
const formatFactor = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

const exporting = ref(false)

async function exportData() {
  exporting.value = true
  try {
    await downloadFile('/export', 'kucharska-kniha-export.json')
    snackbar.value = { show: true, text: 'Export stiahnutý.', color: 'success' }
  } catch (e) {
    const text = e instanceof ApiError ? e.message : 'Export sa nepodaril.'
    snackbar.value = { show: true, text, color: 'error' }
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <h1 class="text-h5 tw:mb-4">Nastavenia</h1>

  <div class="tw:flex tw:flex-col tw:gap-4">
    <v-card title="Účet">
      <v-card-text>
        <v-skeleton-loader v-if="isPending" type="list-item-two-line" />
        <v-alert v-else-if="error" type="error" variant="tonal" :text="error.message" />
        <template v-else-if="me">
          <div class="text-body-1 tw:font-semibold">{{ me.user.name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ me.user.email }}</div>
          <div class="text-body-2 tw:mt-3">
            Domácnosť: <strong>{{ me.household.name }}</strong> ·
            {{ plural(me.members.length, 'člen', 'členovia', 'členov') }}
          </div>
        </template>
      </v-card-text>
    </v-card>

    <v-card v-if="me" title="Jedálniček">
      <v-card-text class="tw:flex tw:flex-col tw:gap-4">
        <div>
          <div class="text-subtitle-2 tw:mb-1">Jedlá dňa</div>
          <p class="text-caption text-medium-emphasis">
            Vypnuté jedlá sa v pláne nezobrazujú, kým v nich nič nie je.
          </p>
          <v-switch
            v-for="slot in me.slots"
            :key="slot.id"
            :model-value="slot.isEnabled"
            :label="slot.name"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="toggleSlot(slot.id, $event)"
          />
        </div>
        <v-select
          :model-value="me.settings.weekStartsOn"
          :items="WEEK_STARTS"
          label="Týždeň začína"
          hide-details
          @update:model-value="setWeekStart($event)"
        />
        <div>
          <div class="tw:flex tw:items-baseline tw:justify-between">
            <span class="text-subtitle-2">Predvolená porcia dieťaťa</span>
            <span class="text-body-2 tw:font-bold">{{ formatFactor(childFactor) }} × dospelý</span>
          </div>
          <v-slider
            v-model="childFactor"
            :min="0.25"
            :max="1.5"
            :step="0.05"
            color="primary"
            hide-details
            @end="saveChildFactor"
          />
          <p class="text-caption text-medium-emphasis">Použije sa pri pridaní nového dieťaťa v Rodine.</p>
        </div>
      </v-card-text>
    </v-card>

    <v-card title="Záloha dát">
      <v-card-text class="text-body-2">
        Stiahne všetky recepty, jedálničky a zoznamy ako JSON súbor. Odporúčame raz za mesiac.
      </v-card-text>
      <v-card-actions>
        <v-btn
          color="primary"
          variant="flat"
          :prepend-icon="mdiDownload"
          :loading="exporting"
          @click="exportData"
        >
          Exportovať dáta
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
