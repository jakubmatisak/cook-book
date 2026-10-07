<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHouseholds } from '@/api/households'
import EmptyState from '@/components/EmptyState.vue'
import { errorText } from '@/i18n/errors'
import {
  activeHouseholdId,
  clearActiveHousehold,
  lastHouseholdId,
  reloadApp,
  resolveHousehold,
  setActiveHousehold,
} from '@/lib/household'
import { mdiAlertCircleOutline } from '@mdi/js'
import CreateOwnHousehold from './CreateOwnHousehold.vue'
import HouseholdPicker from './HouseholdPicker.vue'

/**
 * Pustí obsah až po zvolení domácnosti: jediná domácnosť sa zvolí sama, pri viacerých sa ukáže výber.
 * Všetky ďalšie volania API tak už nesú `?h=` aktívnej domácnosti.
 */
const { t } = useI18n()
const { data: households, isPending, error, refetch } = useHouseholds()

const choice = computed(() =>
  households.value ? resolveHousehold(households.value, activeHouseholdId(), lastHouseholdId()) : null,
)

const ready = ref(false)
// Keď sa domácnosť zmení, až kým už bežia stránky (odobrali nás z nej, zanikla), načítame aplikáciu odznova:
// v pamäti by inak zostali dáta predošlej domácnosti.
let opened: string | null = null
watch(
  choice,
  (c) => {
    if (c?.kind === 'ready') {
      setActiveHousehold(c.id)
      if (opened !== null && opened !== c.id) return reloadApp()
      opened = c.id
      ready.value = true
    } else if (ready.value && c) {
      clearActiveHousehold()
      reloadApp()
    } else {
      ready.value = false
    }
  },
  { immediate: true },
)

function pick(id: string) {
  opened = id
  setActiveHousehold(id)
  ready.value = true
}
</script>

<template>
  <slot v-if="ready" />
  <v-skeleton-loader v-else-if="isPending" type="article" />
  <EmptyState
    v-else-if="error"
    :icon="mdiAlertCircleOutline"
    :title="t('households.gate.loadFailed')"
    :text="errorText(error)"
  >
    <v-btn color="primary" @click="refetch()">{{ t('common.actions.retry') }}</v-btn>
  </EmptyState>
  <HouseholdPicker
    v-else-if="choice?.kind === 'pick' && households"
    :households="households"
    :preferred="choice.preferred"
    @pick="pick"
  />
  <CreateOwnHousehold v-else @created="pick" />
</template>
