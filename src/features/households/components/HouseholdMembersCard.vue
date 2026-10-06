<script setup lang="ts">
import { mdiAccountPlusOutline, mdiDeleteOutline, mdiHomePlusOutline, mdiLockOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HouseholdMemberDto } from '@shared/api'
import type { HouseholdRole } from '@shared/family'
import {
  useChangeMemberRole,
  useHouseholdMembers,
  useRemoveMember,
  useRenameHousehold,
} from '@/api/households'
import { useMe } from '@/api/me'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import { currentLocale } from '@/i18n'
import { HOUSEHOLD_ROLES, roleLabel } from '../roles'
import CreateHouseholdDialog from './CreateHouseholdDialog.vue'
import InviteMemberDialog from './InviteMemberDialog.vue'

const props = defineProps<{ isOwner: boolean }>()

const { t } = useI18n()

const { data: me } = useMe()
const { data: members, isPending, error } = useHouseholdMembers()
const changeRole = useChangeMemberRole()
const remove = useRemoveMember()
const rename = useRenameHousehold()

const roleItems = computed(() => HOUSEHOLD_ROLES.map((value) => ({ value, title: roleLabel(value) })))

const snackbar = ref({ show: false, text: '', color: 'error' })
async function run(action: () => Promise<unknown>, failure: string) {
  try {
    await action()
  } catch (e) {
    snackbar.value = { show: true, text: errorText(e, failure), color: 'error' }
  }
}

// Názov domácnosti
const householdName = ref('')
watch(
  () => me.value?.household.name,
  (name) => {
    if (name !== undefined) householdName.value = name
  },
  { immediate: true },
)
const nameChanged = computed(
  () => householdName.value.trim() !== '' && householdName.value.trim() !== me.value?.household.name,
)
const saveName = () =>
  run(async () => {
    await rename.mutateAsync(householdName.value.trim())
    snackbar.value = { show: true, text: t('households.card.nameSaved'), color: 'success' }
  }, 'households.card.nameFailed')

// Členovia
const setRole = (member: HouseholdMemberDto, role: HouseholdRole) =>
  run(() => changeRole.mutateAsync({ userId: member.userId, role }), 'households.card.roleFailed')

const removing = ref<HouseholdMemberDto | null>(null)
const removeOpen = computed({
  get: () => removing.value !== null,
  set: (value: boolean) => {
    if (!value) removing.value = null
  },
})
async function confirmRemove() {
  const member = removing.value
  if (!member) return
  await run(() => remove.mutateAsync(member.userId), 'households.card.removeFailed')
  removing.value = null
}

const lastLogin = (member: HouseholdMemberDto) =>
  member.lastLoginAt
    ? t('households.card.lastLogin', {
        date: new Date(member.lastLoginAt).toLocaleDateString(currentLocale()),
      })
    : t('households.card.neverLoggedIn')

const inviteOpen = ref(false)
const createOpen = ref(false)
const canCreate = computed(() => me.value?.user.isAdmin === true)
</script>

<template>
  <v-card :title="t('households.card.title')" data-test="household-card">
    <v-card-text class="d-flex flex-column ga-4">
      <v-text-field
        v-model="householdName"
        :label="t('households.name')"
        maxlength="60"
        autocomplete="off"
        hide-details="auto"
        :disabled="!props.isOwner"
        data-test="household-rename"
        @keydown.enter="nameChanged && saveName()"
      >
        <template v-if="props.isOwner && nameChanged" #append-inner>
          <v-btn
            size="small"
            color="primary"
            :loading="rename.isPending.value"
            data-test="household-rename-save"
            @click="saveName"
          >
            {{ t('common.actions.save') }}
          </v-btn>
        </template>
      </v-text-field>

      <v-alert v-if="error" type="error" :text="errorText(error)" density="compact" />
      <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@2" />
      <template v-else-if="members">
        <p class="text-body-2 text-medium-emphasis">
          {{ t('households.card.accountsIntro', { members: tc('common.plural.members', members.length) }) }}
        </p>
        <v-list lines="two" border density="comfortable" data-test="household-members">
          <v-list-item
            v-for="member in members"
            :key="member.userId"
            :title="member.email"
            :subtitle="`${roleLabel(member.role)} · ${lastLogin(member)}`"
            data-test="household-member"
          >
            <template #append>
              <div v-if="props.isOwner" class="d-flex align-center ga-2">
                <v-select
                  :model-value="member.role"
                  :items="roleItems"
                  density="compact"
                  hide-details
                  :aria-label="t('households.role')"
                  style="width: 9rem"
                  data-test="member-role"
                  @update:model-value="setRole(member, $event)"
                />
                <v-icon
                  v-if="member.locked"
                  :icon="mdiLockOutline"
                  :title="t('households.card.locked')"
                  :aria-label="t('households.card.locked')"
                />
                <v-btn
                  v-else
                  :icon="mdiDeleteOutline"
                  variant="text"
                  :aria-label="t('households.card.removeMember', { email: member.email })"
                  data-test="member-remove"
                  @click="removing = member"
                />
              </div>
              <v-chip v-else size="small" variant="tonal">{{ roleLabel(member.role) }}</v-chip>
            </template>
          </v-list-item>
        </v-list>
      </template>

      <p v-if="!props.isOwner" class="text-caption text-medium-emphasis">
        {{ t('households.card.ownerOnly') }}
      </p>
    </v-card-text>
    <v-card-actions v-if="props.isOwner || canCreate" class="flex-wrap ga-2 px-4 pb-4">
      <v-btn
        v-if="props.isOwner"
        color="primary"
        :prepend-icon="mdiAccountPlusOutline"
        data-test="member-invite"
        @click="inviteOpen = true"
      >
        {{ t('households.card.invite') }}
      </v-btn>
      <v-btn
        v-if="canCreate"
        variant="tonal"
        :prepend-icon="mdiHomePlusOutline"
        data-test="household-new"
        @click="createOpen = true"
      >
        {{ t('households.create.title') }}
      </v-btn>
    </v-card-actions>
  </v-card>

  <InviteMemberDialog v-model="inviteOpen" />
  <CreateHouseholdDialog v-model="createOpen" />

  <v-dialog v-model="removeOpen" max-width="440">
    <v-card :title="t('households.card.removeTitle')">
      <v-card-text>
        {{ t('households.card.removeText', { email: removing?.email ?? '' }) }}
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="removing = null">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="error"
          :loading="remove.isPending.value"
          data-test="member-remove-confirm"
          @click="confirmRemove"
        >
          {{ t('common.actions.remove') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
