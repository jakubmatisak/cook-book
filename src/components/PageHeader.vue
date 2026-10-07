<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <!-- Jednotná hlavička stránky: nadpis a akcie vedľa seba; keď sa akcie nezmestia, zalomia sa pod nadpis. -->
  <div class="d-flex flex-wrap align-center ga-2 mb-4">
    <div class="me-auto">
      <h1 class="text-h5 font-weight-bold">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.default" class="d-flex flex-wrap align-center ga-2 d-print-none">
      <slot />
    </div>
  </div>
</template>
