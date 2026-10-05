<script setup lang="ts">
import { mdiCartOutline } from '@mdi/js'
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <h1 class="text-h5 tw:mb-2">Nákupný zoznam</h1>
  <EmptyState
    :icon="mdiCartOutline"
    title="Zoznam je prázdny"
    text="Zoznam vygenerovaný z jedálnička a zdieľaný medzi vami príde vo fáze 3."
  />
</template>
