<script setup lang="ts">
import { useAutoStarterIngredients } from '@/composables/useAutoStarterIngredients'

// Volá API domácnosti, preto beží až vo vnútri HouseholdGate (po zvolení domácnosti).
useAutoStarterIngredients()
</script>

<template>
  <slot />
</template>
