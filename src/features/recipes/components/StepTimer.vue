<script setup lang="ts">
import { mdiBellRing, mdiPause, mdiPlay, mdiRestart } from '@mdi/js'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTimer, useTimer } from '@/composables/useTimer'

const { t } = useI18n()
const props = defineProps<{ seconds: number }>()
const emit = defineEmits<{ done: [] }>()

const timer = useTimer(props.seconds * 1000, () => {
  navigator.vibrate?.([300, 150, 300, 150, 300])
  emit('done')
})
timer.autoDispose()

const state = computed(() => timer.state.value)
const running = computed(() => state.value.status === 'running')
const finished = computed(() => state.value.status === 'done')
</script>

<template>
  <v-chip
    :color="finished ? 'success' : running ? 'primary' : undefined"
    :variant="finished || running ? 'flat' : 'outlined'"
    size="large"
    class="font-weight-bold"
  >
    <v-icon start :icon="finished ? mdiBellRing : mdiPlay" />
    {{ finished ? t('recipes.timer.done') : formatTimer(state.remainingMs) }}
    <template #append>
      <v-btn
        v-if="!running"
        :icon="finished ? mdiRestart : mdiPlay"
        size="x-small"
        variant="text"
        :aria-label="finished ? t('recipes.timer.again') : t('recipes.timer.start')"
        class="ms-2"
        @click.stop="timer.start()"
      />
      <v-btn
        v-else
        :icon="mdiPause"
        size="x-small"
        variant="text"
        :aria-label="t('recipes.timer.pause')"
        class="ms-2"
        @click.stop="timer.pause()"
      />
      <v-btn
        v-if="state.status === 'paused' || state.status === 'running'"
        :icon="mdiRestart"
        size="x-small"
        variant="text"
        :aria-label="t('recipes.timer.reset')"
        @click.stop="timer.reset()"
      />
    </template>
  </v-chip>
</template>
