<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import AppEffects from '@/components/AppEffects.vue'
import HouseholdGate from '@/features/households/components/HouseholdGate.vue'

// Recept cez odkaz na zdieľanie otvára aj neprihlásený: bez menu a domácnosti, ktoré by volali API s prihlásením.
// Kým router nevyrieši prvú adresu, rozhodne cesta (inak by sa na chvíľu spustilo menu a jeho volania).
const route = useRoute()
const isPublic = computed(() =>
  route.matched.length > 0 ? route.meta.public === true : window.location.pathname.startsWith('/s/'),
)
</script>

<template>
  <v-app v-if="isPublic">
    <v-main>
      <v-container class="pa-4 pa-md-6" style="max-width: 1200px">
        <router-view />
      </v-container>
    </v-main>
  </v-app>
  <AppShell v-else>
    <HouseholdGate>
      <AppEffects>
        <router-view />
      </AppEffects>
    </HouseholdGate>
  </AppShell>
</template>
