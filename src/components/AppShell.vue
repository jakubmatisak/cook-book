<script setup lang="ts">
import { mdiChefHat, mdiMenu } from '@mdi/js'
import { ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { PRIMARY_NAV, SECONDARY_NAV } from './navigation'

const { mdAndUp } = useDisplay()

const RAIL_KEY = 'kniha:menu-rail'
const readRail = () => {
  try {
    return localStorage.getItem(RAIL_KEY) === '1'
  } catch {
    return false
  }
}

/** Desktop: bočné menu zbalené na rail (pamätá sa na zariadení). */
const rail = ref(readRail())
watch(rail, (value) => {
  try {
    localStorage.setItem(RAIL_KEY, value ? '1' : '0')
  } catch {
    // súkromné okno a pod.
  }
})

/** Mobil: menu so všetkými stránkami otvorené tlačidlom. */
const mobileMenu = ref(false)
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" border="b">
      <template #prepend>
        <v-app-bar-nav-icon
          v-if="mdAndUp"
          :icon="mdiMenu"
          :aria-label="rail ? 'Rozbaliť menu' : 'Zbaliť menu'"
          data-test="menu-toggle"
          @click="rail = !rail"
        />
        <v-icon v-else :icon="mdiChefHat" color="primary" class="ml-2" />
      </template>
      <v-app-bar-title class="font-weight-bold">Kuchárska kniha</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp" permanent :rail="rail" border="e" data-test="side-nav">
      <v-list nav density="comfortable" class="pt-3">
        <v-list-item
          v-for="item in PRIMARY_NAV"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="sm"
          data-test="nav-item"
        />
        <v-divider class="my-2" />
        <v-list-item
          v-for="item in SECONDARY_NAV"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="sm"
          data-test="nav-item"
        />
      </v-list>
    </v-navigation-drawer>

    <v-navigation-drawer v-else v-model="mobileMenu" temporary location="bottom" data-test="mobile-nav">
      <v-list nav density="comfortable" class="py-3">
        <v-list-item
          v-for="item in [...PRIMARY_NAV, ...SECONDARY_NAV]"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="sm"
          data-test="nav-item"
          @click="mobileMenu = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container class="pa-4 pa-md-6" style="max-width: 1200px">
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!mdAndUp" border="t" data-test="bottom-nav">
      <v-btn v-for="item in PRIMARY_NAV" :key="item.to" :to="item.to" data-test="nav-item">
        <v-icon :icon="item.icon" />
        <span>{{ item.title }}</span>
      </v-btn>
      <v-btn data-test="nav-item" data-menu="open" @click="mobileMenu = true">
        <v-icon :icon="mdiMenu" />
        <span>Menu</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
