<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeIngredientDto, RecipeStepDto } from '@shared/api'
import { usePrintMode } from '@/composables/usePrintMode'
import { formatQuantity, quantityColumnWidth } from '@/i18n/quantity'

/**
 * Ingrediencie (v skupinách, množstvá pod sebou) a postup receptu na čítanie – verejný a zdieľaný recept. Pri tlači
 * je kompaktný ako detail receptu: suroviny a postup vedľa seba, bez rámčekov, hustejšie riadky.
 */
const props = defineProps<{ ingredients: RecipeIngredientDto[]; steps: RecipeStepDto[] }>()
const { t } = useI18n()
const printing = usePrintMode()

const groups = computed(() => {
  const map = new Map<string, RecipeIngredientDto[]>()
  for (const item of props.ingredients) {
    const key = item.groupName ?? ''
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }))
})

const quantityWidth = computed(() =>
  quantityColumnWidth(props.ingredients.map((item) => formatQuantity(item.quantity, item.unit))),
)

const suffix = (item: RecipeIngredientDto) =>
  (item.note ? `, ${item.note}` : '') + (item.isOptional ? ` (${t('recipes.detail.optional')})` : '')
</script>

<template>
  <v-row :density="printing ? 'compact' : undefined">
    <v-col :cols="printing ? 5 : 12" md="5" lg="4" data-test="recipe-ingredients-col">
      <v-card :title="t('recipes.detail.ingredients')" :border="!printing">
        <v-card-text v-if="!ingredients.length" class="text-medium-emphasis">
          {{ t('recipes.detail.noIngredients') }}
        </v-card-text>
        <v-list density="compact" class="py-0 pb-2">
          <template v-for="group in groups" :key="group.name">
            <v-list-subheader v-if="group.name" class="text-primary font-weight-bold">
              {{ group.name }}
            </v-list-subheader>
            <v-list-item v-for="item in group.items" :key="item.id" :min-height="printing ? 24 : undefined">
              <template #prepend>
                <span
                  class="font-weight-bold text-no-wrap me-3"
                  :style="{ minWidth: quantityWidth }"
                  data-test="ingredient-quantity"
                >
                  {{ formatQuantity(item.quantity, item.unit) }}
                </span>
              </template>
              <v-list-item-title class="text-wrap">
                {{ item.name }}<span class="text-medium-emphasis">{{ suffix(item) }}</span>
              </v-list-item-title>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </v-col>
    <v-col :cols="printing ? 7 : 12" md="7" lg="8" data-test="recipe-steps-col">
      <v-card :title="t('recipes.detail.steps')" :border="!printing">
        <v-list :lines="printing ? false : 'three'" class="py-0 pb-2">
          <v-list-item
            v-for="step in steps"
            :key="step.id"
            :class="printing ? 'py-1' : 'py-3'"
            data-test="recipe-step"
          >
            <template #prepend>
              <v-avatar color="primary" :size="printing ? 22 : 32" class="font-weight-bold">{{
                step.position
              }}</v-avatar>
            </template>
            <v-list-item-title
              class="text-wrap text-pre-line"
              :class="printing ? 'text-body-medium' : 'text-body-large'"
            >
              {{ step.text }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-col>
  </v-row>
</template>
