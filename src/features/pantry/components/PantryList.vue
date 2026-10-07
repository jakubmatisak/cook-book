<script setup lang="ts">
import type { IngredientDto, PantryItemDto } from '@shared/api'
import PantryRow from './PantryRow.vue'

/**
 * Zoznam špajze po kategóriách. Stav „mám doma“ a zásoby číta každý riadok sám cez funkcie `isChecked`
 * a `stockOf`, takže zaškrtnutie neprekreslí zoznam ani ostatné riadky – len ten jeden.
 */
defineProps<{
  groups: { id: string; name: string; items: IngredientDto[] }[]
  today: string
  isChecked: (id: string) => boolean
  stockOf: (id: string) => PantryItemDto | undefined
}>()
const emit = defineEmits<{ toggle: [item: IngredientDto]; edit: [item: IngredientDto] }>()
const onToggle = (item: IngredientDto) => emit('toggle', item)
const onEdit = (item: IngredientDto) => emit('edit', item)
</script>

<template>
  <v-list class="py-0">
    <template v-for="(group, gi) in groups" :key="group.id">
      <v-divider v-if="gi > 0" />
      <v-list-subheader class="text-primary font-weight-bold text-uppercase">{{
        group.name
      }}</v-list-subheader>
      <PantryRow
        v-for="item in group.items"
        :key="item.id"
        :item="item"
        :today="today"
        :is-checked="isChecked"
        :stock-of="stockOf"
        @toggle="onToggle"
        @edit="onEdit"
      />
    </template>
  </v-list>
</template>
