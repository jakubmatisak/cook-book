<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ icon: string; label: string; to?: RouteLocationRaw }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <!-- Pevne nad spodnou navigáciou: v-main nastavuje --v-layout-bottom na jej výšku. -->
  <v-btn
    class="page-fab"
    color="primary"
    size="x-large"
    rounded="xl"
    elevation="4"
    :icon="icon"
    :to="to"
    :aria-label="label"
    @click="$emit('click')"
  />
</template>

<style scoped>
.page-fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));
  z-index: 5;
}
</style>
