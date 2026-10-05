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
  <div class="d-flex flex-column ga-3">
    <v-card
      v-for="d in dates"
      :id="`den-${d}`"
      :key="d"
      :color="d === today ? 'primary' : undefined"
      :variant="d === today ? 'outlined' : 'flat'"
    >
      <v-card-item>
        <v-card-title class="text-subtitle-1 font-weight-bold text-capitalize">
          {{ formatDayLabel(d).long }}
          <span class="text-body-2 text-medium-emphasis font-weight-regular ms-1">{{
            formatDayLabel(d).date
          }}</span>
          <v-chip v-if="d === today" size="x-small" color="primary" variant="flat" class="ms-2">dnes</v-chip>
        </v-card-title>
      </v-card-item>
      <v-divider />
      <template v-for="(slot, index) in slots" :key="slot.id">
        <v-divider v-if="index > 0" />
        <v-row no-gutters align="center" class="px-3 py-1">
          <v-col cols="auto" style="width: 5rem">
            <span class="text-caption font-weight-bold text-medium-emphasis">{{ slot.name }}</span>
          </v-col>
          <v-col class="d-flex flex-column ga-1 py-1">
            <PlanEntryCard
              v-for="entry in groups.get(cellKey(d, slot.id)) ?? []"
              :key="entry.id"
              :entry="entry"
              :members="members"
              @edit="$emit('edit', $event)"
            />
          </v-col>
          <v-col cols="auto" class="d-print-none">
            <v-btn
              :icon="mdiPlus"
              size="small"
              variant="text"
              color="primary"
              :aria-label="`Pridať ${slot.name} ${formatDayLabel(d).long}`"
              @click="$emit('add', d, slot.id)"
            />
          </v-col>
        </v-row>
      </template>
    </v-card>
  </div>
</template>
