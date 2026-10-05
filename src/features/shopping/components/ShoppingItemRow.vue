<script setup lang="ts">
import { mdiPencilOutline } from '@mdi/js'
import { computed } from 'vue'
import type { ShoppingItemDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { formatQuantity } from '@shared/units'

const props = defineProps<{ item: ShoppingItemDto }>()
defineEmits<{ toggle: [item: ShoppingItemDto]; edit: [item: ShoppingItemDto] }>()

const quantity = computed(() => formatQuantity(props.item.quantity, props.item.unit))
const origin = computed(() =>
  props.item.sources.map((s) => `${s.recipeTitle} · ${formatDayLabel(s.date).short}`).join(', '),
)
</script>

<template>
  <v-list-item
    :title="item.name"
    :subtitle="origin || undefined"
    :class="{ 'opacity-60': item.isChecked }"
    link
    role="checkbox"
    :aria-checked="item.isChecked"
    @click="$emit('toggle', item)"
  >
    <template #prepend>
      <v-checkbox-btn :model-value="item.isChecked" color="primary" tabindex="-1" aria-hidden="true" />
    </template>
    <template #title="{ title }">
      <span class="font-weight-bold" :class="{ 'text-decoration-line-through': item.isChecked }">{{
        title
      }}</span>
    </template>
    <template #append>
      <span v-if="quantity" class="text-body-2 font-weight-bold me-2">{{ quantity }}</span>
      <v-btn
        :icon="mdiPencilOutline"
        size="small"
        variant="text"
        :aria-label="`Upraviť ${item.name}`"
        @click.stop="$emit('edit', item)"
      />
    </template>
  </v-list-item>
</template>
