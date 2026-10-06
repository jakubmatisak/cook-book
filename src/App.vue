<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import AppEffects from '@/components/AppEffects.vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'
</script>

<template>
  <AppShell>
    <HouseholdGate>
      <AppEffects>
        <router-view />
      </AppEffects>
    </HouseholdGate>
  </AppShell>
</template>
