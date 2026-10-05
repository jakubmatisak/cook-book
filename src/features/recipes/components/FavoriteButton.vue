<script setup lang="ts">
import { mdiHeart, mdiHeartOutline } from '@mdi/js'
import { useToggleFavorite } from '@/api/recipes'

const props = defineProps<{ recipeId: string; isFavorite: boolean; size?: string }>()
const toggle = useToggleFavorite()

function onClick() {
  toggle.mutate({ id: props.recipeId, favorite: !props.isFavorite })
}
</script>

<template>
  <v-btn
    :icon="isFavorite ? mdiHeart : mdiHeartOutline"
    :color="isFavorite ? 'primary' : undefined"
    :size="size ?? 'small'"
    variant="text"
    :aria-label="isFavorite ? 'Odobrať z obľúbených' : 'Pridať medzi obľúbené'"
    :aria-pressed="isFavorite"
    @click.prevent.stop="onClick"
  />
</template>
