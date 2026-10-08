<script setup lang="ts">
import { mdiHeart, mdiHeartOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useToggleFavorite } from '@/api/recipes'

/** `plain`: v lište s ostatnými ikonkami (detail receptu) – bez pozadia a s hustotou podľa nastavenia ako susedia. */
const props = defineProps<{ recipeId: string; isFavorite: boolean; size?: string; plain?: boolean }>()
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
    :density="plain ? undefined : 'default'"
    :variant="plain ? 'text' : 'tonal'"
    :aria-label="isFavorite ? t('recipes.favorite.remove') : t('recipes.favorite.add')"
    :aria-pressed="isFavorite"
    @click.prevent.stop="onClick"
  />
</template>
