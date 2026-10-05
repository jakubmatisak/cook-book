<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <!-- Jednotná hlavička stránky: nadpis vľavo, akcie vpravo, na mobile sa zalomí. -->
  <div class="d-flex flex-wrap align-center ga-2 mb-4">
    <div class="me-auto">
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <slot />
  </div>
</template>
