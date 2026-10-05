<script setup lang="ts">
defineProps<{ icon: string; title: string; text?: string }>()
</script>

<template>
  <div class="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:px-4 tw:py-16 tw:text-center">
    <v-avatar size="72" color="surface-variant">
      <v-icon :icon="icon" size="36" color="primary" />
    </v-avatar>
    <h2 class="text-h6">{{ title }}</h2>
    <p v-if="text" class="text-body-2 text-medium-emphasis tw:max-w-md">{{ text }}</p>
    <slot />
  </div>
</template>
