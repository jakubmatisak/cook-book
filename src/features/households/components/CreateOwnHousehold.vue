<script setup lang="ts">
import { mdiHomePlusOutline } from '@mdi/js'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreateHousehold, useHouseholdAccount } from '@/api/households'
import { errorText } from '@/i18n/errors'

/**
 * Prvé prihlásenie bez domácnosti (pustil ho Cloudflare Access, nikto ho nepozval): založí si vlastnú a je jej
 * vlastníkom, alebo počká na pozvanie – preto vidí aj e-mail, ktorým je prihlásený.
 */
const { t } = useI18n()
const emit = defineEmits<{ created: [id: string] }>()
const { data: account } = useHouseholdAccount()
const create = useCreateHousehold()

const name = ref('')
const error = ref('')
watch(
  account,
  (value) => {
    if (value && !name.value)
      name.value = t('households.own.defaultName', { name: value.email.split('@')[0] })
  },
  { immediate: true },
)

async function submit() {
  error.value = ''
  try {
    const created = await create.mutateAsync(name.value.trim())
    emit('created', created.id)
  } catch (e) {
    error.value = errorText(e, 'households.own.failed')
  }
}
</script>

<template>
  <v-card max-width="560" class="mx-auto mt-6" data-test="own-household">
    <v-card-item :prepend-icon="mdiHomePlusOutline">
      <v-card-title class="text-wrap">{{ t('households.own.title') }}</v-card-title>
    </v-card-item>
    <v-card-text class="d-flex flex-column ga-4">
      <p>{{ t('households.own.text') }}</p>
      <v-text-field
        v-model="name"
        :label="t('households.own.name')"
        hide-details="auto"
        data-test="own-household-name"
        @keyup.enter="name.trim() && submit()"
      />
      <v-alert v-if="error" type="error" :text="error" />
      <p v-if="account" class="text-body-medium text-medium-emphasis">
        {{ t('households.own.invite', { email: account.email }) }}
      </p>
    </v-card-text>
    <v-card-actions class="px-4 pb-4">
      <v-spacer />
      <v-btn
        color="primary"
        :disabled="!name.trim()"
        :loading="create.isPending.value"
        data-test="own-household-create"
        @click="submit"
      >
        {{ t('households.own.create') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
