<script setup lang="ts">
import { mdiCalendarMonthOutline } from '@mdi/js'
import EmptyState from '@/components/EmptyState.vue'
</script>

<template>
  <h1 class="text-h5 tw:mb-2">Týždenný plán</h1>
  <EmptyState
    :icon="mdiCalendarMonthOutline"
    title="Jedálniček ešte nie je"
    text="Plánovanie jedál na týždeň s porciami pre deti a dospelých príde vo fáze 2."
  />
</template>
