<script setup lang="ts">
import { mdiBookOpenPageVariantOutline } from '@mdi/js'
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <h1 class="text-h5 tw:mb-2">Recepty</h1>
  <EmptyState
    :icon="mdiBookOpenPageVariantOutline"
    title="Zatiaľ žiadne recepty"
    text="Pridávanie, vyhľadávanie a fotky receptov prídu vo fáze 1."
  />
</template>
