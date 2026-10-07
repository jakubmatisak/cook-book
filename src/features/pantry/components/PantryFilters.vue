<script setup lang="ts">
import { mdiCheck, mdiClockAlertOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'
import { useControlHeight } from '@/composables/useDensity'

/** Filtre špajze: kategória, len to, čo je doma, a čomu končí trvanlivosť (na stránke aj v spodnom paneli). */
const { t } = useI18n()
const controlHeight = useControlHeight()
defineProps<{ categoryItems: { title: string; value: string }[]; expiringCount: number }>()
const category = defineModel<string | null>('category', { required: true })
const onlyHome = defineModel<boolean>('onlyHome', { required: true })
const onlyExpiring = defineModel<boolean>('onlyExpiring', { required: true })
</script>

<template>
  <v-select
    v-model="category"
    :items="categoryItems"
    :label="t('pantry.page.category')"
    clearable
    hide-details
    data-test="pantry-category"
    style="min-width: 12rem"
  />
  <div class="d-flex flex-wrap ga-2">
    <v-btn
      :color="onlyHome ? 'primary' : undefined"
      :variant="onlyHome ? 'flat' : 'outlined'"
      :prepend-icon="onlyHome ? mdiCheck : undefined"
      :height="controlHeight"
      :aria-pressed="onlyHome"
      data-test="only-home-chip"
      @click="onlyHome = !onlyHome"
    >
      {{ t('pantry.page.onlyHome') }}
    </v-btn>
    <v-btn
      :color="onlyExpiring ? 'warning' : undefined"
      :variant="onlyExpiring ? 'flat' : 'outlined'"
      :prepend-icon="onlyExpiring ? mdiCheck : mdiClockAlertOutline"
      :height="controlHeight"
      :aria-pressed="onlyExpiring"
      data-test="expiring-chip"
      @click="onlyExpiring = !onlyExpiring"
    >
      {{ t('pantry.page.expiring') }}<template v-if="expiringCount">&nbsp;({{ expiringCount }})</template>
    </v-btn>
  </div>
</template>
