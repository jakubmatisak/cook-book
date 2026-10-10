<script setup lang="ts">
import { mdiDeleteOutline, mdiPencilOutline } from '@mdi/js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContactDto } from '@shared/api'
import { SHARE_LIMITS } from '@shared/sharing'
import { useContacts, useDeleteContact, useRenameContact } from '@/api/sharing'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { errorText } from '@/i18n/errors'

/** Kontakty domácnosti (e-maily, s ktorými zdieľa recepty): premenovanie a zmazanie. */
const { t } = useI18n()
const { data: contacts } = useContacts()
const rename = useRenameContact()
const remove = useDeleteContact()

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })

const editing = ref<ContactDto | null>(null)
const editOpen = ref(false)
const name = ref('')
function openRename(contact: ContactDto) {
  editing.value = contact
  name.value = contact.name ?? ''
  editOpen.value = true
}
async function saveName() {
  if (!editing.value) return
  try {
    await rename.mutateAsync({ id: editing.value.id, name: name.value.trim() || null })
    editOpen.value = false
  } catch (e) {
    notify(errorText(e), 'error')
  }
}

const deleting = ref<ContactDto | null>(null)
const deleteOpen = ref(false)
function askDelete(contact: ContactDto) {
  deleting.value = contact
  deleteOpen.value = true
}
async function confirmDelete() {
  if (!deleting.value) return
  try {
    await remove.mutateAsync(deleting.value.id)
    deleteOpen.value = false
  } catch (e) {
    deleteOpen.value = false
    notify(errorText(e), 'error')
  }
}
</script>

<template>
  <v-card :title="t('sharing.contacts.title')" data-test="contacts-card">
    <v-card-text class="d-flex flex-column ga-3">
      <p class="text-body-medium">{{ t('sharing.contacts.subtitle') }}</p>
      <v-skeleton-loader v-if="!contacts" type="list-item@2" />
      <p v-else-if="!contacts.length" class="text-body-medium text-medium-emphasis">
        {{ t('sharing.contacts.empty') }}
      </p>
      <v-list v-else density="compact" class="pa-0" bg-color="transparent">
        <v-list-item
          v-for="contact in contacts"
          :key="contact.id"
          :title="contact.name ?? contact.email"
          :subtitle="contact.name ? contact.email : undefined"
          class="px-0"
        >
          <template #append>
            <div class="d-flex ga-1">
              <v-btn
                :icon="mdiPencilOutline"
                size="small"
                variant="text"
                :aria-label="t('sharing.contacts.rename')"
                :title="t('sharing.contacts.rename')"
                :data-test="`contact-rename-${contact.id}`"
                @click="openRename(contact)"
              />
              <v-btn
                :icon="mdiDeleteOutline"
                size="small"
                variant="text"
                color="error"
                :aria-label="t('sharing.contacts.delete')"
                :title="t('sharing.contacts.delete')"
                :data-test="`contact-delete-${contact.id}`"
                @click="askDelete(contact)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>

  <v-dialog v-model="editOpen" max-width="420">
    <v-card :title="t('sharing.contacts.rename')" :subtitle="editing?.email">
      <v-card-text>
        <v-text-field
          v-model="name"
          :label="t('sharing.contacts.name')"
          :maxlength="SHARE_LIMITS.contactName"
          autocomplete="off"
          autofocus
          hide-details
          data-test="contact-name"
          @keydown.enter="saveName"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="editOpen = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="rename.isPending.value"
          data-test="contact-save"
          @click="saveName"
        >
          {{ t('common.actions.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    v-model="deleteOpen"
    :title="t('sharing.contacts.delete')"
    :text="t('sharing.contacts.deleteText', { email: deleting?.email ?? '' })"
    :confirm-label="t('common.actions.delete')"
    :loading="remove.isPending.value"
    @confirm="confirmDelete"
  />
  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>
