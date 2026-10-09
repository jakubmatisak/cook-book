<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { COLOR_SCHEMES, type ColorScheme } from '@shared/userSettings'
import { schemes } from '@/design/tokens'
import { useThemePreference } from '@/composables/useThemePreference'

const { t } = useI18n()
const { scheme, setScheme } = useThemePreference()

/** Vzorky schémy: hlavná a doplnková farba, pozadie svetlého a hlavná farba tmavého režimu. */
const swatches = (value: ColorScheme) => [
  schemes[value].light.primary,
  schemes[value].light.secondary,
  schemes[value].light.background,
  schemes[value].dark.primary,
]
</script>

<template>
  <div>
    <div class="text-body-small text-medium-emphasis mb-2">{{ t('settings.appearance.scheme') }}</div>
    <v-row density="compact">
      <v-col v-for="value in COLOR_SCHEMES" :key="value" cols="6" sm="4" md="3">
        <v-card
          tag="button"
          type="button"
          class="w-100 text-start pa-2"
          :variant="scheme === value ? 'tonal' : 'outlined'"
          :color="scheme === value ? 'primary' : undefined"
          :aria-pressed="String(scheme === value)"
          :data-test="`color-scheme-${value}`"
          @click="setScheme(value)"
        >
          <div class="d-flex">
            <v-sheet
              v-for="(color, index) in swatches(value)"
              :key="index"
              :color="color"
              height="28"
              class="flex-grow-1"
            />
          </div>
          <div class="text-body-small font-weight-bold mt-2 text-high-emphasis">
            {{ t(`settings.appearance.schemes.${value}`) }}
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
