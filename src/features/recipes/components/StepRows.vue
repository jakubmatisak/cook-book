<script setup lang="ts">
import { mdiArrowDown, mdiArrowUp, mdiClose, mdiPlus } from '@mdi/js'
import { emptyStepRow, parseQuantity, type StepRow } from '../form'

const rows = defineModel<StepRow[]>({ required: true })

const timerRule = (value: string) => {
  const parsed = parseQuantity(value ?? '')
  return parsed === null || (Number.isFinite(parsed) && parsed > 0) || 'Počet minút'
}

function add() {
  rows.value.push(emptyStepRow())
}

function remove(index: number) {
  rows.value.splice(index, 1)
  if (rows.value.length === 0) add()
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= rows.value.length) return
  const [row] = rows.value.splice(index, 1)
  rows.value.splice(target, 0, row!)
}
</script>

<template>
  <div class="tw:flex tw:flex-col tw:gap-3">
    <div v-for="(row, index) in rows" :key="row.key" class="tw:flex tw:gap-3" data-test="step-row">
      <v-avatar size="28" color="primary" class="tw:mt-3 tw:shrink-0 tw:text-sm tw:font-bold">
        {{ index + 1 }}
      </v-avatar>
      <div class="tw:flex-1">
        <v-textarea v-model="row.text" :label="`Krok ${index + 1}`" rows="2" auto-grow hide-details />
        <div class="tw:mt-2 tw:flex tw:items-center tw:gap-2">
          <v-text-field
            v-model="row.timerMinutes"
            label="Časovač (min)"
            inputmode="decimal"
            :rules="[timerRule]"
            hide-details="auto"
            density="compact"
            class="tw:max-w-36"
          />
          <v-spacer />
          <v-btn
            :icon="mdiArrowUp"
            size="small"
            variant="text"
            aria-label="Posunúť vyššie"
            @click="move(index, -1)"
          />
          <v-btn
            :icon="mdiArrowDown"
            size="small"
            variant="text"
            aria-label="Posunúť nižšie"
            @click="move(index, 1)"
          />
          <v-btn
            :icon="mdiClose"
            size="small"
            variant="text"
            aria-label="Odstrániť krok"
            @click="remove(index)"
          />
        </div>
      </div>
    </div>
    <v-btn variant="tonal" color="primary" :prepend-icon="mdiPlus" class="tw:self-start" @click="add">
      Pridať krok
    </v-btn>
  </div>
</template>
