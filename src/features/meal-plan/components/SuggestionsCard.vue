<script setup lang="ts">
import {
  mdiCalendarPlus,
  mdiChevronDown,
  mdiChevronUp,
  mdiClockOutline,
  mdiLightbulbOnOutline,
  mdiPotSteamOutline,
} from '@mdi/js'
import { ref, watch } from 'vue'
import type { SuggestionDto } from '@shared/api'
import { useSuggestions } from '@/api/recipes'
import { formatMinutes } from '@/lib/format'

const props = defineProps<{ date: string }>()
defineEmits<{ plan: [recipeId: string] }>()

const { data: suggestions } = useSuggestions(() => props.date)

// Zbalenie karty sa pamätá v prehliadači, aby neprekážala tomu, kto ju nepoužíva.
const KEY = 'kniha:suggestions-open'
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}
const open = ref(readOpen())
watch(open, (value) => {
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    // súkromné okno a pod.
  }
})

const reasonColor = (reason: string): string | undefined =>
  reason === 'Máš všetko doma' ? 'success' : reason.startsWith('Chýba') ? 'warning' : undefined

const visibleReasons = (s: SuggestionDto) => s.reasons.slice(0, 3)
</script>

<template>
  <v-card v-if="suggestions?.length" class="mb-4" data-test="suggestions">
    <v-card-item>
      <template #prepend>
        <v-icon :icon="mdiLightbulbOnOutline" color="primary" />
      </template>
      <v-card-title class="font-weight-bold">Čo uvariť dnes</v-card-title>
      <v-card-subtitle>Podľa špajze a posledného varenia</v-card-subtitle>
      <template #append>
        <v-btn
          :icon="open ? mdiChevronUp : mdiChevronDown"
          variant="text"
          :aria-label="open ? 'Zbaliť návrhy' : 'Rozbaliť návrhy'"
          :aria-expanded="open"
          @click="open = !open"
        />
      </template>
    </v-card-item>
    <v-expand-transition>
      <div v-show="open">
        <v-card-text class="pt-0">
          <v-slide-group show-arrows>
            <v-slide-group-item v-for="s in suggestions" :key="s.recipeId">
              <v-card variant="outlined" width="240" class="me-3 d-flex flex-column" data-test="suggestion">
                <v-card-item>
                  <template #prepend>
                    <v-avatar rounded="sm" size="48" color="surface-variant">
                      <v-img v-if="s.coverImageUrl" :src="s.coverImageUrl" cover />
                      <v-icon v-else :icon="mdiPotSteamOutline" color="primary" />
                    </v-avatar>
                  </template>
                  <v-card-title class="text-body-1 font-weight-bold text-wrap">
                    <router-link
                      :to="`/recepty/${s.recipeId}`"
                      class="text-decoration-none text-high-emphasis"
                    >
                      {{ s.title }}
                    </router-link>
                  </v-card-title>
                  <v-card-subtitle v-if="s.totalMinutes !== null">
                    <v-icon :icon="mdiClockOutline" size="14" class="me-1" />{{
                      formatMinutes(s.totalMinutes)
                    }}
                  </v-card-subtitle>
                </v-card-item>
                <v-card-text class="pt-0 flex-grow-1 d-flex flex-wrap ga-1 align-start">
                  <v-chip
                    v-for="reason in visibleReasons(s)"
                    :key="reason"
                    size="x-small"
                    variant="tonal"
                    :color="reasonColor(reason)"
                  >
                    {{ reason }}
                  </v-chip>
                </v-card-text>
                <v-card-actions class="px-4 pb-3">
                  <v-btn
                    size="small"
                    color="primary"
                    variant="tonal"
                    :prepend-icon="mdiCalendarPlus"
                    @click="$emit('plan', s.recipeId)"
                  >
                    Naplánovať
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-slide-group-item>
          </v-slide-group>
        </v-card-text>
      </div>
    </v-expand-transition>
  </v-card>
</template>
