<script setup lang="ts">
import { ref, watch } from 'vue'
import type { HouseholdRole } from '@shared/family'
import { useInviteMember } from '@/api/households'
import { ROLE_LABELS } from '../roles'

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
  if (!value) return void (error.value = 'Zadaj e-mail.')
  try {
    await invite.mutateAsync({ email: value, role: role.value })
    open.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Pozvánku sa nepodarilo uložiť.'
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card title="Pozvať do domácnosti">
      <v-card-text class="d-flex flex-column ga-3">
        <p class="text-body-2 text-medium-emphasis">
          Pozvaný sa prihlási týmto e-mailom (jednorazovým kódom, ktorý mu príde) a uvidí túto domácnosť.
        </p>
        <v-text-field
          v-model="email"
          type="email"
          autocomplete="off"
          label="E-mail"
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
          aria-label="Rola"
        >
          <v-btn value="member">{{ ROLE_LABELS.member }}</v-btn>
          <v-btn value="owner">{{ ROLE_LABELS.owner }}</v-btn>
        </v-btn-toggle>
        <p class="text-caption text-medium-emphasis">
          Vlastník môže meniť nastavenia, rodinu a členov. Člen robí všetko okolo varenia.
        </p>
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Zrušiť</v-btn>
        <v-btn color="primary" :loading="invite.isPending.value" data-test="invite-submit" @click="onInvite">
          Pozvať
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
