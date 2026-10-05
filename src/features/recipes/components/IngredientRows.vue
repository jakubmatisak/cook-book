<script setup lang="ts">
import { mdiArrowDown, mdiArrowUp, mdiClose, mdiPlus } from '@mdi/js'
import { computed } from 'vue'
import { UNITS, type UnitCode } from '@shared/units'
import { useIngredients } from '@/api/catalog'
import { parseQuantity, emptyIngredientRow, type IngredientRow } from '../form'

const rows = defineModel<IngredientRow[]>({ required: true })
const { data: catalog } = useIngredients()

const names = computed(() => catalog.value?.map((i) => i.name) ?? [])
const unitItems = UNITS.map((u) => ({ title: u.code, value: u.code, subtitle: u.label }))

const quantityRule = (value: string) => {
  const parsed = parseQuantity(value ?? '')
  return parsed === null || (Number.isFinite(parsed) && parsed > 0) || 'Napr. 2, 1,5 alebo 1/2'
}

/** Pri výbere známej ingrediencie bez jednotky doplní jej predvolenú jednotku. */
function onNameChange(row: IngredientRow, name: string | null) {
  row.name = name ?? ''
  if (row.unit) return
  const known = catalog.value?.find((i) => i.name.toLowerCase() === row.name.trim().toLowerCase())
  if (known?.defaultUnit) row.unit = known.defaultUnit as UnitCode
}

function add() {
  rows.value.push(emptyIngredientRow())
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
    <div
      v-for="(row, index) in rows"
      :key="row.key"
      class="tw:rounded-xl tw:border tw:border-on-surface/10 tw:p-3"
      data-test="ingredient-row"
    >
      <div class="tw:grid tw:grid-cols-[5.5rem_6.5rem_1fr] tw:gap-2">
        <v-text-field
          v-model="row.quantity"
          label="Množstvo"
          inputmode="decimal"
          :rules="[quantityRule]"
          hide-details="auto"
          density="compact"
        />
        <v-select
          v-model="row.unit"
          :items="unitItems"
          label="Jednotka"
          clearable
          hide-details
          density="compact"
        />
        <v-combobox
          :model-value="row.name"
          :items="names"
          label="Ingrediencia"
          hide-details
          density="compact"
          @update:model-value="onNameChange(row, $event)"
        />
      </div>
      <div class="tw:mt-2 tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2">
        <v-text-field v-model="row.note" label="Poznámka (napr. nadrobno)" hide-details density="compact" />
        <v-text-field
          v-model="row.groupName"
          label="Skupina (napr. Na cesto)"
          hide-details
          density="compact"
        />
      </div>
      <div class="tw:mt-1 tw:flex tw:items-center">
        <v-checkbox v-model="row.isOptional" label="Voliteľná" hide-details density="compact" />
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
          aria-label="Odstrániť ingredienciu"
          @click="remove(index)"
        />
      </div>
    </div>
    <v-btn variant="tonal" color="primary" :prepend-icon="mdiPlus" class="tw:self-start" @click="add">
      Pridať ingredienciu
    </v-btn>
  </div>
</template>
