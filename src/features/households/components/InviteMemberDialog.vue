<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HouseholdRole } from '@shared/family'
import { useInviteMember } from '@/api/households'
import { errorText } from '@/i18n/errors'

const { t } = useI18n()
const open = defineModel<boolean>({ required: true })

const email = ref('')
const role = ref<HouseholdRole>('member')
const error = ref('')
const invite = useInviteMember()

watch(open, (isOpen) => {
  if (!isOpen) return
  email.value = ''
  role.value = 'member'
  error.value = ''
})

async function onInvite() {
  const value = email.value.trim()
  if (!value) return void (error.value = t('households.invite.emailRequired'))
  try {
    await invite.mutateAsync({ email: value, role: role.value })
    open.value = false
  } catch (e) {
    error.value = errorText(e, 'households.invite.failed')
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="t('households.invite.title')">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-medium text-medium-emphasis">
          {{ t('households.invite.intro') }}
        </p>
        <v-text-field
          v-model="email"
          type="email"
          autocomplete="off"
          :label="t('households.invite.email')"
          autofocus
          hide-details="auto"
          :error-messages="error"
          data-test="invite-email"
          @keydown.enter="onInvite"
        />
        <v-btn-toggle
          v-model="role"
          mandatory
          selected-class="bg-primary"
          variant="outlined"
          divided
          :aria-label="t('households.role')"
        >
          <v-btn value="member">{{ t('common.role.member') }}</v-btn>
          <v-btn value="owner">{{ t('common.role.owner') }}</v-btn>
        </v-btn-toggle>
        <p class="text-body-small text-medium-emphasis">
          {{ t('households.invite.roleHint') }}
        </p>
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn color="primary" :loading="invite.isPending.value" data-test="invite-submit" @click="onInvite">
          {{ t('households.invite.submit') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
