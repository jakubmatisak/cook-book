<script setup lang="ts">
import { mdiCheckboxBlankOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import type { ShoppingItemDto } from '@shared/api'
import { formatDate } from '@/i18n/format'
import { formatQuantity } from '@/i18n/quantity'

defineProps<{
  /** Kategórie obchodu s položkami, ktoré treba kúpiť. */
  groups: { id: string; name: string; items: ShoppingItemDto[] }[]
  /** Dnešný dátum (ISO) na hlavičke výtlačku. */
  date: string
}>()

const { t } = useI18n()
</script>

<template>
  <!-- Len pre tlač: zhustený zoznam do obchodu, bez fotiek a pôvodu položiek, na viac stĺpcov. -->
  <div class="d-none d-print-block" data-test="print-list">
    <div class="text-body-medium font-weight-bold mb-2">
      {{ t('shopping.printView.heading', { date: formatDate(date) }) }}
    </div>
    <div style="column-count: 3; column-gap: 1.5rem" data-test="print-columns">
      <div v-for="group in groups" :key="group.id" class="mb-2">
        <div
          class="text-body-small font-weight-bold text-uppercase mb-1"
          style="break-after: avoid; border-bottom: 1px solid currentColor"
        >
          {{ group.name }}
        </div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="d-flex align-start ga-1 text-body-medium"
          style="break-inside: avoid; line-height: 1.3"
          data-test="print-item"
        >
          <v-icon :icon="mdiCheckboxBlankOutline" size="14" class="mt-1 flex-shrink-0" />
          <span class="flex-grow-1">{{ item.name }}</span>
          <span v-if="formatQuantity(item.quantity, item.unit)" class="font-weight-bold text-no-wrap">
            {{ formatQuantity(item.quantity, item.unit) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
