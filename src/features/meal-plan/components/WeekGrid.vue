<script setup lang="ts">
import { mdiPlus } from '@mdi/js'
import { ref } from 'vue'
import type { FamilyMemberDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { cellKey } from '../week'
import PlanEntryCard from './PlanEntryCard.vue'

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
  <v-card>
    <v-table density="comfortable" class="bg-transparent">
      <thead>
        <tr>
          <th style="width: 7rem" />
          <th
            v-for="d in dates"
            :key="d"
            class="text-center"
            :class="{ 'bg-primary': d === today }"
            style="min-width: 8rem"
          >
            <div class="text-caption font-weight-bold text-uppercase">{{ formatDayLabel(d).short }}</div>
            <div class="text-body-2">{{ formatDayLabel(d).date }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="slot in slots" :key="slot.id">
          <th class="text-body-2 font-weight-bold" :class="{ 'opacity-60': !slot.isEnabled }">
            {{ slot.name }}
          </th>
          <td
            v-for="d in dates"
            :key="d"
            class="pa-1 align-top border-md border-dashed border-primary"
            :class="[
              d === today ? 'bg-surface-variant' : '',
              dropKey === cellKey(d, slot.id) ? 'border-opacity-100' : 'border-opacity-0',
            ]"
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
                class="align-self-center"
                :aria-label="`Pridať ${slot.name} ${formatDayLabel(d).long}`"
                @click="$emit('add', d, slot.id)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>
