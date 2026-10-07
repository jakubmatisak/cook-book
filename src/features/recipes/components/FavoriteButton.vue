<script setup lang="ts">
import { mdiHeart, mdiHeartOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useToggleFavorite } from '@/api/recipes'

const props = defineProps<{ recipeId: string; isFavorite: boolean; size?: string }>()
const toggle = useToggleFavorite()
const { t } = useI18n()

// Tlačidlo má pevnú hustotu (density="default"): kompaktné malé ikonkové tlačidlo by srdce orezalo.
function onClick() {
  toggle.mutate({ id: props.recipeId, favorite: !props.isFavorite })
}
</script>

<template>
  <v-btn
    :icon="isFavorite ? mdiHeart : mdiHeartOutline"
    :color="isFavorite ? 'primary' : undefined"
    :size="size ?? 'small'"
    density="default"
    variant="tonal"
    :aria-label="isFavorite ? t('recipes.favorite.remove') : t('recipes.favorite.add')"
    :aria-pressed="isFavorite"
    @click.prevent.stop="onClick"
  />
</template>
