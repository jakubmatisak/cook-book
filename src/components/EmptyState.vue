<script setup lang="ts">
defineProps<{ icon: string; title: string; text?: string }>()
</script>

<template>
  <v-empty-state :icon="icon" :title="title" :text="text">
    <template v-if="$slots.default" #actions>
      <slot />
    </template>
  </v-empty-state>
</template>
