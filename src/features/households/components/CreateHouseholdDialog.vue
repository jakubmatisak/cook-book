<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreateHousehold } from '@/api/households'
import { errorText } from '@/i18n/errors'
import { setActiveHousehold } from '@/lib/household'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })

const name = ref('')
const error = ref('')
const create = useCreateHousehold()

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  error.value = ''
})

async function onCreate() {
  const value = name.value.trim()
  if (!value) return void (error.value = t('households.create.nameRequired'))
  try {
    const created = await create.mutateAsync(value)
    open.value = false
    // Novú domácnosť rovno otvoríme; načítanie odznova vyčistí dáta predošlej.
    setActiveHousehold(created.id)
    window.location.assign('/')
  } catch (e) {
    error.value = errorText(e, 'households.create.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="t('households.create.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-medium text-medium-emphasis">
          {{ t('households.create.intro') }}
        </p>
        <v-text-field
          v-model="name"
          autocomplete="off"
          :label="t('households.name')"
          :placeholder="t('households.create.namePlaceholder')"
          maxlength="60"
          autofocus
          hide-details="auto"
          :error-messages="error"
          data-test="household-name"
          @keydown.enter="onCreate"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :loading="create.isPending.value"
          data-test="household-create"
          @click="onCreate"
        >
          {{ t('households.create.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
