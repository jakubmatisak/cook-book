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
  <div class="row tw:flex tw:items-center tw:gap-1 tw:pr-1" :class="{ 'row--checked': item.isChecked }">
    <button
      type="button"
      class="tw:flex tw:min-h-12 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3 tw:py-1 tw:pl-2 tw:text-left"
      role="checkbox"
      :aria-checked="item.isChecked"
      @click="$emit('toggle', item)"
    >
      <v-checkbox-btn
        :model-value="item.isChecked"
        color="primary"
        density="compact"
        tabindex="-1"
        aria-hidden="true"
        class="tw:pointer-events-none tw:flex-none"
      />
      <span class="tw:min-w-0 tw:flex-1">
        <span class="name tw:block tw:truncate tw:text-base tw:font-semibold">{{ item.name }}</span>
        <span v-if="origin" class="tw:block tw:truncate tw:text-xs tw:opacity-60">{{ origin }}</span>
      </span>
      <span v-if="quantity" class="tw:shrink-0 tw:text-sm tw:font-bold tw:tabular-nums">{{ quantity }}</span>
    </button>
    <v-btn
      :icon="mdiPencilOutline"
      size="small"
      variant="text"
      :aria-label="`Upraviť ${item.name}`"
      @click="$emit('edit', item)"
    />
  </div>
</template>

<style scoped>
.row--checked .name {
  text-decoration: line-through;
  opacity: 0.55;
}
</style>
