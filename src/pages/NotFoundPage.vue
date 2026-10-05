<script setup lang="ts">
import { mdiMapMarkerQuestionOutline } from '@mdi/js'
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <EmptyState :icon="mdiMapMarkerQuestionOutline" title="Táto stránka neexistuje">
    <v-btn color="primary" to="/recepty">Späť na recepty</v-btn>
  </EmptyState>
</template>
