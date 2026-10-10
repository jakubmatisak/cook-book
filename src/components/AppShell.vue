<script setup lang="ts">
import {
  mdiAccountCircleOutline,
  mdiCheck,
  mdiChevronDoubleLeft,
  mdiChevronDoubleRight,
  mdiCloudOffOutline,
  mdiHomeOutline,
  mdiLogout,
  mdiMenu,
  mdiThemeLightDark,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
} from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIsFetching } from '@tanstack/vue-query'
import { useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useHouseholds } from '@/api/households'
import { useOnline } from '@/composables/useOnline'
import { usePrintMode } from '@/composables/usePrintMode'
import { ACCESS_LOGOUT_PATH, canLogout } from '@/lib/auth'
import { activeHousehold, setActiveHousehold } from '@/lib/household'
import { APP_VERSION_LABEL } from '@/lib/version'
import { LOGO_ICON } from '@/design/logo'
import { useApplyTheme, useThemePreference, type ThemePreference } from '@/composables/useThemePreference'
import { navigationPending } from '@/router/navigationPending'
import { PRIMARY_NAV, SECONDARY_NAV, SETTINGS_NAV } from './navigation'

const { mdAndUp } = useDisplay()
const showLogout = typeof location !== 'undefined' && canLogout(location.hostname)
const online = useOnline()
// Tenký pruh pod hornou lištou: prechod na stránku alebo načítavanie dát zo servera.
const fetching = useIsFetching()
const loading = computed(() => navigationPending.value || fetching.value > 0)
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
const { t } = useI18n()
const themeLabel = (value: ThemePreference) => t(`common.shell.theme.${value}`)

// Prepínač domácností: len pre človeka, ktorý je členom viacerých. Prepnutie načíta aplikáciu odznova,
// aby v pamäti nezostali dáta predošlej domácnosti.
const { data: households } = useHouseholds()
const activeName = computed(() => households.value?.find((h) => h.id === activeHousehold.value)?.name ?? '')
function switchHousehold(id: string) {
  if (id === activeHousehold.value) return
  setActiveHousehold(id)
  window.location.assign('/')
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
        <v-btn
          icon
          variant="text"
          to="/"
          :active="false"
          :aria-label="t('common.shell.home', { name: t('common.app.name') })"
          data-test="logo"
        >
          <v-icon :icon="LOGO_ICON" color="primary" size="32" />
        </v-btn>
      </template>
      <v-app-bar-title class="font-weight-bold">{{ t('common.app.name') }}</v-app-bar-title>
      <template #append>
        <v-menu v-if="households && households.length > 1">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdAndUp ? undefined : mdiHomeOutline"
              :prepend-icon="mdAndUp ? mdiHomeOutline : undefined"
              :text="mdAndUp ? activeName : undefined"
              variant="text"
              class="text-none"
              :aria-label="t('common.shell.household', { name: activeName })"
              data-test="household-switcher"
            />
          </template>
          <v-list min-width="220" data-test="household-menu">
            <v-list-item
              v-for="h in households"
              :key="h.id"
              :title="h.name"
              :append-icon="h.id === activeHousehold ? mdiCheck : undefined"
              data-test="household-switch-item"
              @click="switchHousehold(h.id)"
            />
          </v-list>
        </v-menu>
        <v-btn
          :icon="THEME_ICONS[preference]"
          variant="text"
          :aria-label="t('common.shell.switchTheme', { theme: themeLabel(preference) })"
          :title="themeLabel(preference)"
          data-test="theme-toggle"
          @click="cycle"
        />
        <!-- Pravý roh: nastavenia, odhlásenie (len pri Cloudflare Access) a pod tým názov a verzia aplikácie. -->
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiAccountCircleOutline"
              variant="text"
              :aria-label="t('common.shell.account')"
              data-test="account"
            />
          </template>
          <v-list min-width="240" data-test="account-menu">
            <v-list-item
              :to="SETTINGS_NAV.to"
              :title="t(SETTINGS_NAV.titleKey)"
              :prepend-icon="SETTINGS_NAV.icon"
              data-test="account-settings"
            />
            <template v-if="showLogout">
              <!-- Celá stránka (nie router): odhlásenie rieši Cloudflare Access. -->
              <v-list-item
                :href="ACCESS_LOGOUT_PATH"
                :title="t('common.shell.logout')"
                :prepend-icon="mdiLogout"
                data-test="logout"
              />
            </template>
            <v-divider />
            <v-list-item
              :title="t('common.app.name')"
              :subtitle="t('common.app.version', { version: APP_VERSION_LABEL })"
              data-test="app-version"
            >
              <template #prepend><v-icon :icon="LOGO_ICON" color="primary" /></template>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
      <v-progress-linear
        :active="loading"
        indeterminate
        absolute
        location="bottom"
        color="primary"
        data-test="loading-bar"
      />
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp && showChrome" permanent :rail="rail" border="e" data-test="side-nav">
      <v-list nav density="comfortable" class="pt-3">
        <v-list-item
          v-for="item in PRIMARY_NAV"
          :key="item.to"
          :to="item.to"
          :exact="item.exact"
          :prepend-icon="item.icon"
          :title="t(item.titleKey)"
          rounded="sm"
          data-test="nav-item"
        />
        <v-divider class="my-2" />
        <v-list-item
          v-for="item in SECONDARY_NAV"
          :key="item.to"
          :to="item.to"
          :exact="item.exact"
          :prepend-icon="item.icon"
          :title="t(item.titleKey)"
          rounded="sm"
          data-test="nav-item"
        />
      </v-list>
      <!-- Zbalenie a rozbalenie bočného menu: šípka dolu v menu. -->
      <template #append>
        <v-list nav density="comfortable">
          <v-list-item
            :prepend-icon="rail ? mdiChevronDoubleRight : mdiChevronDoubleLeft"
            :title="rail ? undefined : t('common.shell.collapseMenu')"
            :aria-label="rail ? t('common.shell.expandMenu') : t('common.shell.collapseMenu')"
            rounded="sm"
            data-test="menu-toggle"
            @click="rail = !rail"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-navigation-drawer
      v-else-if="!mdAndUp && showChrome"
      v-model="mobileMenu"
      temporary
      location="bottom"
      data-test="mobile-nav"
    >
      <v-list nav density="comfortable" class="py-3">
        <!-- Hlavné stránky sú v spodných kartách, menu ponúka len ostatné. -->
        <v-list-item
          v-for="item in SECONDARY_NAV"
          :key="item.to"
          :to="item.to"
          :exact="item.exact"
          :prepend-icon="item.icon"
          :title="t(item.titleKey)"
          rounded="sm"
          data-test="nav-item"
          @click="mobileMenu = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-4 pa-md-6" style="max-width: 1920px">
        <v-alert
          v-if="!online"
          type="warning"
          density="compact"
          class="mb-4 d-print-none"
          :icon="mdiCloudOffOutline"
        >
          {{ t('common.shell.offline') }}
        </v-alert>
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!mdAndUp && showChrome" border="t" data-test="bottom-nav">
      <v-btn
        v-for="item in PRIMARY_NAV"
        :key="item.to"
        :to="item.to"
        :exact="item.exact"
        data-test="nav-item"
      >
        <v-icon :icon="item.icon" />
        <span>{{ t(item.titleKey) }}</span>
      </v-btn>
      <v-btn data-test="nav-item" data-menu="open" @click="mobileMenu = true">
        <v-icon :icon="mdiMenu" />
        <span>{{ t('common.nav.menu') }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
