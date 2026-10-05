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
        <v-icon :icon="mdiChefHat" color="primary" class="tw:ml-2" />
      </template>
      <v-app-bar-title class="tw:font-bold">Kuchárska kniha</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp" permanent rail rail-width="96" border="e" data-test="side-rail">
      <v-list nav class="tw:pt-4">
        <v-list-item
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          rounded="lg"
          class="tw:mb-2 tw:py-2"
          data-test="nav-item"
        >
          <div class="tw:flex tw:flex-col tw:items-center tw:gap-1">
            <v-icon :icon="item.icon" />
            <span class="text-caption tw:font-semibold">{{ item.title }}</span>
          </div>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <div class="tw:mx-auto tw:w-full tw:max-w-[1200px] tw:p-4 tw:md:p-6">
        <slot />
      </div>
    </v-main>

    <v-bottom-navigation v-if="!mdAndUp" border="t" data-test="bottom-nav">
      <v-btn v-for="item in NAV_ITEMS" :key="item.to" :to="item.to" data-test="nav-item">
        <v-icon :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
