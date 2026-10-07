<script setup lang="ts">
import { computed } from 'vue'
import { useAutoStarterIngredients } from '@/composables/useAutoStarterIngredients'
import { useDensity } from '@/composables/useDensity'
import { useSyncUserSettings } from '@/composables/useSyncUserSettings'
import { densityDefaults } from '@/design/density'

// Volá API domácnosti, preto beží až vo vnútri HouseholdGate (po zvolení domácnosti).
useAutoStarterIngredients()
useSyncUserSettings()

// Hustota rozhrania pre všetky stránky aj ich okná (okná dedia predvolené props podľa stromu komponentov).
const density = useDensity()
const defaults = computed(() => densityDefaults(density.value))
</script>

<template>
  <v-defaults-provider :defaults="defaults">
    <slot />
  </v-defaults-provider>
</template>
