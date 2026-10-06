<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import StarterIngredients from '@/components/StarterIngredients.vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'
</script>

<template>
  <AppShell>
    <HouseholdGate>
      <StarterIngredients>
        <router-view />
      </StarterIngredients>
    </HouseholdGate>
  </AppShell>
</template>
