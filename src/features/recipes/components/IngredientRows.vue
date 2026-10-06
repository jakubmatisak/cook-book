<script setup lang="ts">
import { unitText } from '@/i18n/quantity'
import { mdiArrowDown, mdiArrowUp, mdiClose, mdiPlus } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UNITS, type UnitCode } from '@shared/units'
import { useIngredients } from '@/api/catalog'
import { emptyIngredientRow, parseQuantity, type IngredientRow } from '../form'

const { t } = useI18n()
const rows = defineModel<IngredientRow[]>({ required: true })
const { data: catalog } = useIngredients()

const names = computed(() => catalog.value?.map((i) => i.name) ?? [])
const unitItems = computed(() =>
  UNITS.map((u) => ({ title: unitText(u.code), value: u.code, subtitle: t(`common.unit.${u.code}`) })),
)

const quantityRule = (value: string) => {
  const parsed = parseQuantity(value ?? '')
  return parsed === null || (Number.isFinite(parsed) && parsed > 0) || t('recipes.ingredients.quantityRule')
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
  <div class="d-flex flex-column ga-3">
    <v-sheet v-for="(row, index) in rows" :key="row.key" border class="pa-3" data-test="ingredient-row">
      <v-row dense>
        <v-col cols="12" sm="6" order="first" order-sm="last">
          <v-combobox
            :model-value="row.name"
            :items="names"
            :label="t('recipes.ingredients.name')"
            hide-details
            density="compact"
            @update:model-value="onNameChange(row, $event)"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model="row.quantity"
            autocomplete="off"
            :label="t('recipes.ingredients.quantity')"
            inputmode="decimal"
            :rules="[quantityRule]"
            hide-details="auto"
            density="compact"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-select
            v-model="row.unit"
            :items="unitItems"
            item-props
            :label="t('recipes.ingredients.unit')"
            clearable
            hide-details
            density="compact"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="row.note"
            autocomplete="off"
            :label="t('recipes.ingredients.note')"
            hide-details
            density="compact"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="row.groupName"
            autocomplete="off"
            :label="t('recipes.ingredients.group')"
            hide-details
            density="compact"
          />
        </v-col>
      </v-row>
      <div class="d-flex align-center mt-1">
        <v-checkbox
          v-model="row.isOptional"
          :label="t('recipes.ingredients.optional')"
          hide-details
          density="compact"
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
          :aria-label="t('recipes.ingredients.remove')"
          @click="remove(index)"
        />
      </div>
    </v-sheet>
    <v-btn variant="tonal" color="primary" :prepend-icon="mdiPlus" class="align-self-start" @click="add">
      {{ t('recipes.ingredients.add') }}
    </v-btn>
  </div>
</template>
