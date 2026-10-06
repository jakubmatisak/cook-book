<script setup lang="ts">
import {
  mdiAccountCircleOutline,
  mdiCloudOffOutline,
  mdiLogout,
  mdiMenu,
  mdiThemeLightDark,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useOnline } from '@/composables/useOnline'
import { usePrintMode } from '@/composables/usePrintMode'
import { ACCESS_LOGOUT_PATH, canLogout } from '@/lib/auth'
import { APP_VERSION_LABEL } from '@/lib/version'
import { useApplyTheme, useThemePreference, type ThemePreference } from '@/composables/useThemePreference'
import { PRIMARY_NAV, SECONDARY_NAV } from './navigation'

const { mdAndUp } = useDisplay()
const showLogout = typeof location !== 'undefined' && canLogout(location.hostname)
const online = useOnline()
const route = useRoute()

/** Stránky s meta.bare (napr. režim varenia) bez lišty a menu. */
const bare = computed(() => route.meta.bare === true)

// Pri tlači sa lišty a menu odstránia (nielen skryjú), aby po nich nezostali prázdne okraje.
const printing = usePrintMode()
const showChrome = computed(() => !bare.value && !printing.value)

useApplyTheme(printing)
const { preference, cycle } = useThemePreference()
const THEME_ICONS: Record<ThemePreference, string> = {
  system: mdiThemeLightDark,
  light: mdiWhiteBalanceSunny,
  dark: mdiWeatherNight,
}
const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Vzhľad podľa zariadenia',
  light: 'Svetlý vzhľad',
  dark: 'Tmavý vzhľad',
}

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
    <v-app-bar v-if="showChrome" density="comfortable" border="b" class="d-print-none">
      <template #prepend>
        <!-- Logo v ľavom rohu: odkaz na úvod. -->
        <v-btn icon variant="text" to="/" aria-label="Kuchárska kniha, úvod" data-test="logo">
          <v-avatar size="32" rounded="sm"><v-img src="/favicon.svg" alt="" /></v-avatar>
        </v-btn>
        <v-app-bar-nav-icon
          v-if="mdAndUp"
          :icon="mdiMenu"
          :aria-label="rail ? 'Rozbaliť menu' : 'Zbaliť menu'"
          data-test="menu-toggle"
          @click="rail = !rail"
        />
      </template>
      <v-app-bar-title class="font-weight-bold">Kuchárska kniha</v-app-bar-title>
      <template #append>
        <!-- Pravý roh: odhlásenie (len pri Cloudflare Access) a pod ním názov a verzia aplikácie. -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiAccountCircleOutline"
              variant="text"
              aria-label="Účet a verzia"
              data-test="account"
            />
          </template>
          <v-list min-width="240" data-test="account-menu">
            <template v-if="showLogout">
              <!-- Celá stránka (nie router): odhlásenie rieši Cloudflare Access. -->
              <v-list-item
                :href="ACCESS_LOGOUT_PATH"
                title="Odhlásiť sa"
                :prepend-icon="mdiLogout"
                data-test="logout"
              />
              <v-divider />
            </template>
            <v-list-item
              title="Kuchárska kniha"
              :subtitle="`Verzia ${APP_VERSION_LABEL}`"
              data-test="app-version"
            >
              <template #prepend>
                <v-avatar size="40" rounded="sm" class="me-3"><v-img src="/favicon.svg" alt="" /></v-avatar>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn
          :icon="THEME_ICONS[preference]"
          variant="text"
          :aria-label="THEME_LABELS[preference] + ' – prepnúť'"
          :title="THEME_LABELS[preference]"
          data-test="theme-toggle"
          @click="cycle"
        />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp && showChrome" permanent :rail="rail" border="e" data-test="side-nav">
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

    <v-navigation-drawer
      v-else-if="!mdAndUp && showChrome"
      v-model="mobileMenu"
      temporary
      location="bottom"
      data-test="mobile-nav"
    >
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
        <v-alert
          v-if="!online"
          type="warning"
          density="compact"
          class="mb-4 d-print-none"
          :icon="mdiCloudOffOutline"
        >
          Bez signálu. Zmeny sa odošlú po pripojení, odškrtávanie nákupu funguje aj teraz.
        </v-alert>
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!mdAndUp && showChrome" border="t" data-test="bottom-nav">
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
