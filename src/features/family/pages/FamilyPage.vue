<script setup lang="ts">
import { mdiAccountGroupOutline } from '@mdi/js'
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <h1 class="text-h5 tw:mb-2">Rodina</h1>
  <EmptyState
    :icon="mdiAccountGroupOutline"
    title="Členovia rodiny"
    text="Pridanie detí a dospelých s veľkosťou porcie príde vo fáze 2."
  />
</template>
