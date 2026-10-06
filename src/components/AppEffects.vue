<script setup lang="ts">
import { useAutoStarterIngredients } from '@/composables/useAutoStarterIngredients'
import { useSyncUserSettings } from '@/composables/useSyncUserSettings'

// Volá API domácnosti, preto beží až vo vnútri HouseholdGate (po zvolení domácnosti).
useAutoStarterIngredients()
useSyncUserSettings()
</script>

<template>
  <slot />
</template>
