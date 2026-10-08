<script setup lang="ts">
import { slotName } from '@/i18n/defaults'
import { mdiPlus } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { formatDayLabel } from '@/i18n/format'
import { cellKey } from '../week'
import PlanEntryCard from './PlanEntryCard.vue'

const { t } = useI18n()
const props = defineProps<{
  dates: string[]
  slots: MealSlotDto[]
  groups: Map<string, PlanEntryDto[]>
  members: FamilyMemberDto[]
  today: string
}>()
const emit = defineEmits<{
  add: [date: string, slotId: string]
  edit: [entry: PlanEntryDto]
  /** Karta bola pustená na pole; `copy` = držané Ctrl alebo Alt. */
  move: [entry: PlanEntryDto, date: string, slotId: string, copy: boolean]
}>()

// Presúvanie myšou: id záznamu cestuje v dátach ťahu, pole pod kurzorom sa zvýrazní.
const dropKey = ref<string | null>(null)

function onDragStart(event: DragEvent, entry: PlanEntryDto) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('text/plain', entry.id)
  event.dataTransfer.effectAllowed = 'copyMove'
}

function onDragOver(event: DragEvent, key: string) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = event.ctrlKey || event.altKey ? 'copy' : 'move'
  dropKey.value = key
}

function onDragLeave(event: DragEvent, key: string) {
  const inside =
    event.relatedTarget instanceof Node && (event.currentTarget as Node).contains(event.relatedTarget)
  if (!inside && dropKey.value === key) dropKey.value = null
}

function onDrop(event: DragEvent, date: string, slotId: string) {
  event.preventDefault()
  dropKey.value = null
  const id = event.dataTransfer?.getData('text/plain')
  const entry = [...props.groups.values()].flat().find((e) => e.id === id)
  if (entry) emit('move', entry, date, slotId, event.ctrlKey || event.altKey)
}
</script>

<template>
  <!-- Pevná mriežka z Vuetify riadkov a stĺpcov: dni majú rovnakú šírku a pri pridávaní jedál sa nič neposúva. -->
  <v-card>
    <v-row no-gutters class="flex-nowrap">
      <v-col class="border-thin" style="flex: 0 0 7rem; max-width: 7rem" />
      <v-col
        v-for="d in dates"
        :key="d"
        class="text-center border-thin pa-2 overflow-hidden"
        :class="{ 'bg-primary': d === today }"
        style="min-width: 0"
      >
        <div class="text-body-small font-weight-bold text-uppercase">{{ formatDayLabel(d).short }}</div>
        <div class="text-body-medium">{{ formatDayLabel(d).date }}</div>
      </v-col>
    </v-row>
    <v-row v-for="slot in slots" :key="slot.id" no-gutters class="flex-nowrap">
      <v-col
        class="border-thin pa-2 d-flex align-center text-body-medium font-weight-bold"
        :class="{ 'opacity-60': !slot.isEnabled }"
        style="flex: 0 0 7rem; max-width: 7rem"
      >
        {{ slotName(slot.name) }}
      </v-col>
      <v-col
        v-for="d in dates"
        :key="d"
        class="pa-1 border-thin overflow-hidden"
        :class="[
          d === today ? 'bg-surface-variant' : '',
          dropKey === cellKey(d, slot.id) ? 'bg-primary-lighten-4 border-primary' : '',
        ]"
        style="min-width: 0"
        :data-cell="cellKey(d, slot.id)"
        @dragover="onDragOver($event, cellKey(d, slot.id))"
        @dragleave="onDragLeave($event, cellKey(d, slot.id))"
        @drop="onDrop($event, d, slot.id)"
      >
        <div class="d-flex flex-column ga-1">
          <PlanEntryCard
            v-for="entry in groups.get(cellKey(d, slot.id)) ?? []"
            :key="entry.id"
            :entry="entry"
            :members="members"
            dense
            draggable
            @edit="$emit('edit', $event)"
            @dragstart="onDragStart"
          />
          <v-btn
            size="x-small"
            variant="text"
            :icon="mdiPlus"
            class="align-self-center d-print-none"
            :aria-label="t('plan.week.addAria', { slot: slotName(slot.name), day: formatDayLabel(d).long })"
            @click="$emit('add', d, slot.id)"
          />
        </div>
      </v-col>
    </v-row>
  </v-card>
</template>
