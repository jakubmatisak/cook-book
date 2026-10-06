<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import { useAutoStarterIngredients } from '@/composables/useAutoStarterIngredients'

useAutoStarterIngredients()
</script>

<template>
  <AppShell>
    <router-view />
  </AppShell>
</template>
