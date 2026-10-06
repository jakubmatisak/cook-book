<script setup lang="ts">
import { mdiArrowDown, mdiArrowUp, mdiClose, mdiPlus } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { emptyStepRow, parseQuantity, type StepRow } from '../form'

const { t } = useI18n()
const rows = defineModel<StepRow[]>({ required: true })

const timerRule = (value: string) => {
  const parsed = parseQuantity(value ?? '')
  return parsed === null || (Number.isFinite(parsed) && parsed > 0) || t('recipes.steps.timerRule')
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
  <div class="d-flex flex-column ga-3">
    <div v-for="(row, index) in rows" :key="row.key" class="d-flex ga-3" data-test="step-row">
      <v-avatar size="28" color="primary" class="mt-3 flex-shrink-0 font-weight-bold">{{
        index + 1
      }}</v-avatar>
      <div class="flex-grow-1">
        <v-textarea
          v-model="row.text"
          :label="t('recipes.steps.label', { n: index + 1 })"
          rows="2"
          auto-grow
          hide-details
        />
        <div class="d-flex align-center ga-2 mt-2">
          <v-text-field
            v-model="row.timerMinutes"
            autocomplete="off"
            :label="t('recipes.steps.timer')"
            inputmode="decimal"
            :rules="[timerRule]"
            hide-details="auto"
            density="compact"
            style="max-width: 9rem"
          />
          <v-spacer />
          <v-btn
            :icon="mdiArrowUp"
            size="small"
            variant="text"
            :aria-label="t('recipes.rows.up')"
            @click="move(index, -1)"
          />
          <v-btn
            :icon="mdiArrowDown"
            size="small"
            variant="text"
            :aria-label="t('recipes.rows.down')"
            @click="move(index, 1)"
          />
          <v-btn
            :icon="mdiClose"
            size="small"
            variant="text"
            :aria-label="t('recipes.steps.remove')"
            @click="remove(index)"
          />
        </div>
      </div>
    </div>
    <v-btn variant="tonal" color="primary" :prepend-icon="mdiPlus" class="align-self-start" @click="add">
      {{ t('recipes.steps.add') }}
    </v-btn>
  </div>
</template>
