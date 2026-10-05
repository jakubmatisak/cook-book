<script setup lang="ts">
import { mdiAccountGroupOutline, mdiChevronRight, mdiCogOutline } from '@mdi/js'

const links = [
  { to: '/rodina', title: 'Rodina', subtitle: 'Členovia a veľkosť porcií', icon: mdiAccountGroupOutline },
  { to: '/nastavenia', title: 'Nastavenia', subtitle: 'Účet, domácnosť, export dát', icon: mdiCogOutline },
]
</script>

<template>
  <h1 class="text-h5 tw:mb-4">Viac</h1>
  <v-card>
    <v-list lines="two">
      <v-list-item
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :title="link.title"
        :subtitle="link.subtitle"
        :prepend-icon="link.icon"
        :append-icon="mdiChevronRight"
      />
    </v-list>
  </v-card>
</template>
