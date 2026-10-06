<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHouseholds } from '@/api/households'
import EmptyState from '@/components/EmptyState.vue'
import { activeHouseholdId, lastHouseholdId, resolveHousehold, setActiveHousehold } from '@/lib/household'
import { mdiAlertCircleOutline, mdiHomeOutline } from '@mdi/js'
import HouseholdPicker from './HouseholdPicker.vue'

/**
 * Pustí obsah až po zvolení domácnosti: jediná domácnosť sa zvolí sama, pri viacerých sa ukáže výber.
 * Všetky ďalšie volania API tak už nesú `?h=` aktívnej domácnosti.
 */
const { data: households, isPending, error, refetch } = useHouseholds()

const choice = computed(() =>
  households.value ? resolveHousehold(households.value, activeHouseholdId(), lastHouseholdId()) : null,
)

const ready = ref(false)
watch(
  choice,
  (c) => {
    if (c?.kind === 'ready') {
      setActiveHousehold(c.id)
      ready.value = true
    } else {
      ready.value = false
    }
  },
  { immediate: true },
)

function pick(id: string) {
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
    title="Nepodarilo sa načítať domácnosti"
    :text="error.message"
  >
    <v-btn color="primary" @click="refetch()">Skúsiť znova</v-btn>
  </EmptyState>
  <HouseholdPicker
    v-else-if="choice?.kind === 'pick' && households"
    :households="households"
    :preferred="choice.preferred"
    @pick="pick"
  />
  <EmptyState
    v-else
    :icon="mdiHomeOutline"
    title="Nie si členom žiadnej domácnosti"
    text="Požiadaj vlastníka domácnosti, nech ťa pozve."
  />
</template>
