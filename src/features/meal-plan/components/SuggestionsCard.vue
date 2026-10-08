<script setup lang="ts">
import {
  mdiCalendarPlus,
  mdiChevronDown,
  mdiChevronUp,
  mdiClockOutline,
  mdiLightbulbOnOutline,
  mdiPotSteamOutline,
} from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { SuggestionDto } from '@shared/api'
import { useSuggestions } from '@/api/recipes'
import { useUserToggle } from '@/composables/useUserToggle'
import { formatMinutes } from '@/i18n/format'
import { describeReason } from '../reasons'

const { t } = useI18n()
const props = defineProps<{ date: string }>()
defineEmits<{ plan: [recipeId: string] }>()

const { data: suggestions } = useSuggestions(() => props.date)

// Zbalenie karty si pamätajú nastavenia človeka, aby neprekážala tomu, kto ju nepoužíva.
const open = useUserToggle('planSuggestionsOpen')
const { smAndDown } = useDisplay()

const visibleReasons = (s: SuggestionDto) => s.reasons.slice(0, 3).map(describeReason)

// Na mobile stručný zoznam: prvé tri návrhy, ostatné až na požiadanie; pri každom len čas a čo chýba.
const MOBILE_COUNT = 3
const showAll = ref(false)
const rows = computed(
  () => (showAll.value ? suggestions.value : suggestions.value?.slice(0, MOBILE_COUNT)) ?? [],
)
const hiddenCount = computed(() => Math.max(0, (suggestions.value?.length ?? 0) - MOBILE_COUNT))
const rowSubtitle = (s: SuggestionDto) =>
  [
    s.totalMinutes === null ? null : formatMinutes(s.totalMinutes),
    s.missing.length
      ? t('plan.suggestions.reasons.missing', { items: s.missing.join(', ') })
      : t('plan.suggestions.reasons.allAtHome'),
  ]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <v-card v-if="suggestions?.length" class="mb-4" data-test="suggestions">
    <v-card-item>
      <template #prepend>
        <v-icon :icon="mdiLightbulbOnOutline" color="primary" />
      </template>
      <v-card-title class="font-weight-bold">{{ t('plan.suggestions.title') }}</v-card-title>
      <v-card-subtitle>{{ t('plan.suggestions.subtitle') }}</v-card-subtitle>
      <template #append>
        <v-btn
          :icon="open ? mdiChevronUp : mdiChevronDown"
          variant="text"
          :aria-label="open ? t('plan.suggestions.collapse') : t('plan.suggestions.expand')"
          :aria-expanded="open"
          data-test="suggestions-toggle"
          @click="open = !open"
        />
      </template>
    </v-card-item>
    <v-expand-transition>
      <div v-show="open">
        <v-list v-if="smAndDown" density="compact" class="pt-0" data-test="suggestions-list">
          <v-list-item
            v-for="s in rows"
            :key="s.recipeId"
            :to="`/recipes/${s.recipeId}`"
            :title="s.title"
            :subtitle="rowSubtitle(s)"
            data-test="suggestion-row"
          >
            <template #prepend>
              <v-avatar rounded="sm" size="36" color="surface-variant">
                <v-img v-if="s.coverImageUrl" :src="s.coverImageUrl" cover />
                <v-icon v-else :icon="mdiPotSteamOutline" color="primary" size="20" />
              </v-avatar>
            </template>
            <template #append>
              <v-btn
                :icon="mdiCalendarPlus"
                variant="text"
                color="primary"
                size="small"
                :aria-label="t('plan.suggestions.planAria', { title: s.title })"
                data-test="suggestion-plan"
                @click.prevent.stop="$emit('plan', s.recipeId)"
              />
            </template>
          </v-list-item>
          <v-list-item v-if="hiddenCount">
            <v-btn variant="text" size="small" data-test="suggestions-more" @click="showAll = !showAll">
              {{ showAll ? t('plan.suggestions.less') : t('plan.suggestions.more', { n: hiddenCount }) }}
            </v-btn>
          </v-list-item>
        </v-list>
        <v-card-text v-else class="pt-0">
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
                  <v-card-title class="text-body-large font-weight-bold text-wrap">
                    <router-link
                      :to="`/recipes/${s.recipeId}`"
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
                    :key="reason.text"
                    size="x-small"
                    variant="tonal"
                    :color="reason.color"
                  >
                    {{ reason.text }}
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
                    {{ t('plan.suggestions.plan') }}
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
