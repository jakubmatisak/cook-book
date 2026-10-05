<script setup lang="ts">
import { mdiPlus } from '@mdi/js'
import type { FamilyMemberDto, MealSlotDto, PlanEntryDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { cellKey } from '../week'
import PlanEntryCard from './PlanEntryCard.vue'

defineProps<{
  dates: string[]
  slots: MealSlotDto[]
  groups: Map<string, PlanEntryDto[]>
  members: FamilyMemberDto[]
  today: string
}>()
defineEmits<{ add: [date: string, slotId: string]; edit: [entry: PlanEntryDto] }>()
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
            class="pa-1 align-top"
            :class="{ 'bg-surface-variant': d === today }"
          >
            <div class="d-flex flex-column ga-1">
              <PlanEntryCard
                v-for="entry in groups.get(cellKey(d, slot.id)) ?? []"
                :key="entry.id"
                :entry="entry"
                :members="members"
                dense
                @edit="$emit('edit', $event)"
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
