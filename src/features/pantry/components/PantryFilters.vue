<script setup lang="ts">
import { mdiCheck, mdiClockAlertOutline } from '@mdi/js'
import { useI18n } from 'vue-i18n'

/** Filtre špajze: kategória, len to, čo je doma, a čomu končí trvanlivosť (na stránke aj v spodnom paneli). */
const { t } = useI18n()
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
  <div class="d-flex flex-wrap ga-3">
    <v-chip
      :color="onlyHome ? 'primary' : undefined"
      :variant="onlyHome ? 'flat' : 'outlined'"
      :prepend-icon="onlyHome ? mdiCheck : undefined"
      data-test="only-home-chip"
      @click="onlyHome = !onlyHome"
    >
      {{ t('pantry.page.onlyHome') }}
    </v-chip>
    <v-chip
      :color="onlyExpiring ? 'warning' : undefined"
      :variant="onlyExpiring ? 'flat' : 'outlined'"
      :prepend-icon="onlyExpiring ? mdiCheck : mdiClockAlertOutline"
      data-test="expiring-chip"
      @click="onlyExpiring = !onlyExpiring"
    >
      {{ t('pantry.page.expiring') }}<template v-if="expiringCount">&nbsp;({{ expiringCount }})</template>
    </v-chip>
  </div>
</template>
