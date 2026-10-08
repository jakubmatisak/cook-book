<script setup lang="ts">
import { mdiDeleteOutline, mdiDotsVertical, mdiPencilOutline } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ShoppingItemDto } from '@shared/api'
import { formatQuantity } from '@/i18n/quantity'
import { formatDayLabel } from '@/i18n/format'

const { t } = useI18n()
const props = defineProps<{ item: ShoppingItemDto }>()
defineEmits<{
  toggle: [item: ShoppingItemDto]
  edit: [item: ShoppingItemDto]
  remove: [item: ShoppingItemDto]
}>()

const quantity = computed(() => formatQuantity(props.item.quantity, props.item.unit))
const photo = computed(() => props.item.sources.find((s) => s.coverImageUrl)?.coverImageUrl ?? null)
const origin = computed(() =>
  props.item.source === 'staple'
    ? t('shopping.item.staple')
    : props.item.sources.map((s) => `${s.recipeTitle} · ${formatDayLabel(s.date).short}`).join(', '),
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
      <span v-if="quantity" class="text-body-medium font-weight-bold me-2">{{ quantity }}</span>
      <v-menu>
        <template #activator="{ props: activator }">
          <v-btn
            v-bind="activator"
            :icon="mdiDotsVertical"
            size="small"
            variant="text"
            :aria-label="t('shopping.item.menuAria', { name: item.name })"
            :data-test="`item-menu-${item.id}`"
            class="d-print-none"
            @click.stop
          />
        </template>
        <v-list density="compact">
          <v-list-item
            :prepend-icon="mdiPencilOutline"
            :title="t('shopping.item.edit')"
            data-test="item-edit"
            @click="$emit('edit', item)"
          />
          <v-list-item
            :prepend-icon="mdiDeleteOutline"
            :title="t('shopping.item.remove')"
            base-color="error"
            data-test="item-remove"
            @click="$emit('remove', item)"
          />
        </v-list>
      </v-menu>
    </template>
  </v-list-item>
</template>
