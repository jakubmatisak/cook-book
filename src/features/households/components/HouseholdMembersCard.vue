<script setup lang="ts">
import { mdiAccountPlusOutline, mdiDeleteOutline, mdiHomePlusOutline, mdiLockOutline } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import type { HouseholdMemberDto } from '@shared/api'
import type { HouseholdRole } from '@shared/family'
import {
  useChangeMemberRole,
  useHouseholdMembers,
  useRemoveMember,
  useRenameHousehold,
} from '@/api/households'
import { useMe } from '@/api/me'
import { plural } from '@/lib/format'
import { ROLE_LABELS } from '../roles'
import CreateHouseholdDialog from './CreateHouseholdDialog.vue'
import InviteMemberDialog from './InviteMemberDialog.vue'

const props = defineProps<{ isOwner: boolean }>()

const { data: me } = useMe()
const { data: members, isPending, error } = useHouseholdMembers()
const changeRole = useChangeMemberRole()
const remove = useRemoveMember()
const rename = useRenameHousehold()

const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as HouseholdRole[]).map((value) => ({
  value,
  title: ROLE_LABELS[value],
}))

const snackbar = ref({ show: false, text: '', color: 'error' })
async function run(action: () => Promise<unknown>, failure: string) {
  try {
    await action()
  } catch (e) {
    snackbar.value = { show: true, text: e instanceof Error ? e.message : failure, color: 'error' }
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
    snackbar.value = { show: true, text: 'Názov uložený.', color: 'success' }
  }, 'Názov sa neuložil.')

// Členovia
const setRole = (member: HouseholdMemberDto, role: HouseholdRole) =>
  run(() => changeRole.mutateAsync({ userId: member.userId, role }), 'Rolu sa nepodarilo zmeniť.')

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
  await run(() => remove.mutateAsync(member.userId), 'Člena sa nepodarilo odobrať.')
  removing.value = null
}

const lastLogin = (member: HouseholdMemberDto) =>
  member.lastLoginAt
    ? `naposledy ${new Date(member.lastLoginAt).toLocaleDateString('sk-SK')}`
    : 'ešte sa neprihlásil'

const inviteOpen = ref(false)
const createOpen = ref(false)
const canCreate = computed(() => me.value?.user.isAdmin === true)
</script>

<template>
  <v-card title="Domácnosť a členovia" data-test="household-card">
    <v-card-text class="d-flex flex-column ga-4">
      <v-text-field
        v-model="householdName"
        label="Názov domácnosti"
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
            Uložiť
          </v-btn>
        </template>
      </v-text-field>

      <v-alert v-if="error" type="error" :text="error.message" density="compact" />
      <v-skeleton-loader v-else-if="isPending" type="list-item-two-line@2" />
      <template v-else-if="members">
        <p class="text-body-2 text-medium-emphasis">
          Účty, ktoré sa môžu prihlásiť do tejto domácnosti ({{
            plural(members.length, 'člen', 'členovia', 'členov')
          }}).
        </p>
        <v-list lines="two" border density="comfortable" data-test="household-members">
          <v-list-item
            v-for="member in members"
            :key="member.userId"
            :title="member.email"
            :subtitle="`${ROLE_LABELS[member.role]} · ${lastLogin(member)}`"
            data-test="household-member"
          >
            <template #append>
              <div v-if="props.isOwner" class="d-flex align-center ga-2">
                <v-select
                  :model-value="member.role"
                  :items="ROLE_ITEMS"
                  density="compact"
                  hide-details
                  aria-label="Rola"
                  style="width: 9rem"
                  data-test="member-role"
                  @update:model-value="setRole(member, $event)"
                />
                <v-icon
                  v-if="member.locked"
                  :icon="mdiLockOutline"
                  title="E-mail je nastavený pri nasadení a v aplikácii sa neodoberie."
                  aria-label="E-mail je nastavený pri nasadení a v aplikácii sa neodoberie."
                />
                <v-btn
                  v-else
                  :icon="mdiDeleteOutline"
                  variant="text"
                  :aria-label="`Odobrať ${member.email}`"
                  data-test="member-remove"
                  @click="removing = member"
                />
              </div>
              <v-chip v-else size="small" variant="tonal">{{ ROLE_LABELS[member.role] }}</v-chip>
            </template>
          </v-list-item>
        </v-list>
      </template>

      <p v-if="!props.isOwner" class="text-caption text-medium-emphasis">
        Členov, názov a nastavenia domácnosti môže meniť len vlastník.
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
        Pozvať
      </v-btn>
      <v-btn
        v-if="canCreate"
        variant="tonal"
        :prepend-icon="mdiHomePlusOutline"
        data-test="household-new"
        @click="createOpen = true"
      >
        Nová domácnosť
      </v-btn>
    </v-card-actions>
  </v-card>

  <InviteMemberDialog v-model="inviteOpen" />
  <CreateHouseholdDialog v-model="createOpen" />

  <v-dialog v-model="removeOpen" max-width="440">
    <v-card title="Odobrať z domácnosti?">
      <v-card-text>
        {{ removing?.email }} stratí prístup k tejto domácnosti. Recepty ani plán sa nezmažú.
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="removing = null">Zrušiť</v-btn>
        <v-btn
          color="error"
          :loading="remove.isPending.value"
          data-test="member-remove-confirm"
          @click="confirmRemove"
        >
          Odobrať
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
    {{ snackbar.text }}
  </v-snackbar>
</template>
