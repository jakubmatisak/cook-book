<script setup lang="ts">
import { mdiClockAlertOutline, mdiPencilOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IngredientDto, PantryItemDto } from '@shared/api'
import { formatQuantity } from '@/i18n/quantity'
import { describeExpiry, expiryStatus } from '../format'

/**
 * Jeden riadok špajze. Samostatný komponent, aby sa po zaškrtnutí prekreslil len tento riadok, nie celý zoznam
 * (stovky riadkov so zaškrtávacím políčkom sú na mobile pomalé). Stav číta cez funkcie z rodiča a udalosti
 * posielajú ingredienciu, takže props ostatných riadkov sa nemenia.
 */
const { t } = useI18n()
const props = defineProps<{
  item: IngredientDto
  today: string
  isChecked: (id: string) => boolean
  stockOf: (id: string) => PantryItemDto | undefined
}>()
// Computed vráti rovnakú hodnotu pre ostatné riadky, takže sa po zaškrtnutí prekreslí len tento.
const checked = computed(() => props.isChecked(props.item.id))
const stock = computed(() => props.stockOf(props.item.id))
const emit = defineEmits<{ toggle: [item: IngredientDto]; edit: [item: IngredientDto] }>()

const quantity = computed(() => (stock.value ? formatQuantity(stock.value.quantity, stock.value.unit) : ''))
const expiryColor = computed(() => {
  const status = expiryStatus(stock.value?.expiresOn ?? null, props.today)
  return status === 'expired' ? 'error' : status === 'soon' ? 'warning' : undefined
})
</script>

<template>
  <v-list-item :title="item.name" link @click="emit('toggle', item)">
    <template #prepend>
      <v-checkbox-btn
        :model-value="checked"
        color="primary"
        :aria-label="item.name"
        @click.stop
        @update:model-value="emit('toggle', item)"
      />
    </template>
    <template v-if="stock" #subtitle>
      <span class="d-flex flex-wrap align-center ga-1 mt-1">
        <v-chip v-if="quantity" size="x-small" variant="tonal">{{ quantity }}</v-chip>
        <v-chip
          v-if="stock.expiresOn"
          size="x-small"
          variant="tonal"
          :color="expiryColor"
          :prepend-icon="mdiClockAlertOutline"
        >
          {{ describeExpiry(stock.expiresOn, today) }}
        </v-chip>
        <span v-if="stock.location" class="text-caption">{{ stock.location }}</span>
      </span>
    </template>
    <template #append>
      <v-btn
        :icon="mdiPencilOutline"
        size="small"
        variant="text"
        :aria-label="
          checked
            ? t('pantry.page.editAria', { name: item.name })
            : t('pantry.page.editIngredientAria', { name: item.name })
        "
        @click.stop="emit('edit', item)"
      />
    </template>
  </v-list-item>
</template>
