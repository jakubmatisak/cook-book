<script setup lang="ts">
import { useDisplay } from 'vuetify'

defineProps<{ title: string; subtitle?: string }>()
const { smAndDown } = useDisplay()
</script>

<template>
  <!-- Jednotná hlavička stránky: nadpis a akcie vedľa seba; na mobile akcie v samostatnom riadku pod nadpisom. -->
  <div class="d-flex flex-wrap align-center ga-2 mb-4">
    <div :class="smAndDown ? 'w-100' : 'me-auto'">
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.default" class="d-flex flex-wrap align-center ga-2" :class="{ 'w-100': smAndDown }">
      <slot />
    </div>
  </div>
</template>
