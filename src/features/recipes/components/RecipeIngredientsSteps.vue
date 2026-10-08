<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecipeIngredientDto, RecipeStepDto } from '@shared/api'
import { formatQuantity, quantityColumnWidth } from '@/i18n/quantity'

/** Ingrediencie (v skupinách, množstvá pod sebou) a postup receptu na čítanie – verejný a zdieľaný recept. */
const props = defineProps<{ ingredients: RecipeIngredientDto[]; steps: RecipeStepDto[] }>()
const { t } = useI18n()

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
  <v-row>
    <v-col cols="12" md="5" lg="4">
      <v-card :title="t('recipes.detail.ingredients')">
        <v-card-text v-if="!ingredients.length" class="text-medium-emphasis">
          {{ t('recipes.detail.noIngredients') }}
        </v-card-text>
        <v-list density="compact" class="py-0 pb-2">
          <template v-for="group in groups" :key="group.name">
            <v-list-subheader v-if="group.name" class="text-primary font-weight-bold">
              {{ group.name }}
            </v-list-subheader>
            <v-list-item v-for="item in group.items" :key="item.id">
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
    <v-col cols="12" md="7" lg="8">
      <v-card :title="t('recipes.detail.steps')">
        <v-list lines="three" class="py-0 pb-2">
          <v-list-item v-for="step in steps" :key="step.id" class="py-3">
            <template #prepend>
              <v-avatar color="primary" size="32" class="font-weight-bold">{{ step.position }}</v-avatar>
            </template>
            <v-list-item-title class="text-wrap text-body-large text-pre-line">
              {{ step.text }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-col>
  </v-row>
</template>
