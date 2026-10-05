<script setup lang="ts">
import { mdiPencilOutline } from '@mdi/js'
import { computed } from 'vue'
import type { ShoppingItemDto } from '@shared/api'
import { formatDayLabel } from '@shared/dates'
import { formatQuantity } from '@shared/units'

const props = defineProps<{ item: ShoppingItemDto }>()
defineEmits<{ toggle: [item: ShoppingItemDto]; edit: [item: ShoppingItemDto] }>()

const quantity = computed(() => formatQuantity(props.item.quantity, props.item.unit))
const photo = computed(() => props.item.sources.find((s) => s.coverImageUrl)?.coverImageUrl ?? null)
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
    @click="$emit('toggle', item)"
  >
    <template #prepend>
      <v-checkbox-btn
        :model-value="item.isChecked"
        color="primary"
        :aria-label="item.name"
        @click.stop
        @update:model-value="$emit('toggle', item)"
      />
    </template>
    <template v-if="photo" #subtitle>
      <span class="d-flex align-center ga-2">
        <v-avatar size="20" rounded="sm"><v-img :src="photo" cover /></v-avatar>
        <span class="text-truncate">{{ origin }}</span>
      </span>
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
