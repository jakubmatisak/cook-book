<script setup lang="ts">
import { mdiChefHat } from '@mdi/js'
import { useDisplay } from 'vuetify'
import { NAV_ITEMS } from './navigation'

const { mdAndUp } = useDisplay()
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" border="b">
      <template #prepend>
        <v-icon :icon="mdiChefHat" color="primary" class="ml-2" />
      </template>
      <v-app-bar-title class="font-weight-bold">Kuchárska kniha</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp" permanent width="220" border="e" data-test="side-rail">
      <v-list nav density="comfortable" class="pt-4">
        <v-list-item
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="lg"
          data-test="nav-item"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container class="pa-4 pa-md-6" style="max-width: 1200px">
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!mdAndUp" border="t" data-test="bottom-nav">
      <v-btn v-for="item in NAV_ITEMS" :key="item.to" :to="item.to" data-test="nav-item">
        <v-icon :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
