<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALES } from '@shared/userSettings'
import { parseLocale, setLocale } from '@/i18n'

const { t, locale } = useI18n()
const onChange = (value: unknown) => setLocale(parseLocale(typeof value === 'string' ? value : null))
</script>

<template>
  <v-card :title="t('common.language.title')">
    <v-card-text>
      <v-btn-toggle
        :model-value="locale"
        mandatory
        selected-class="bg-primary"
        variant="outlined"
        divided
        :aria-label="t('common.language.title')"
        data-test="language-toggle"
        @update:model-value="onChange"
      >
        <v-btn v-for="code in LOCALES" :key="code" :value="code" :data-test="`language-${code}`">
          {{ t(`common.language.${code}`) }}
        </v-btn>
      </v-btn-toggle>
      <p class="text-body-small text-medium-emphasis mt-2">{{ t('common.language.hint') }}</p>
    </v-card-text>
  </v-card>
</template>
