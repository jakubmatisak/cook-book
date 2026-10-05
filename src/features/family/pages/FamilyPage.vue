<script setup lang="ts">
import { mdiAccountGroupOutline, mdiPlus } from '@mdi/js'
import { computed, ref } from 'vue'
import type { FamilyMemberDto } from '@shared/api'
import { MEMBER_COLORS, MEMBER_KIND_LABELS } from '@shared/family'
import { entryPortions } from '@shared/portions'
import { useMe } from '@/api/me'
import EmptyState from '@/components/EmptyState.vue'
import { plural } from '@/lib/format'
import MemberDialog from '../components/MemberDialog.vue'

const { data: me, isPending, error } = useMe()
const members = computed(() => me.value?.members ?? [])

const totalPortions = computed(() =>
  entryPortions({ servingsOverride: null, audience: 'all' }, members.value),
)

const dialogOpen = ref(false)
const editing = ref<FamilyMemberDto | null>(null)
const nextColor = computed(() => MEMBER_COLORS[members.value.length % MEMBER_COLORS.length]!)

function openNew() {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(member: FamilyMemberDto) {
  editing.value = member
  dialogOpen.value = true
}

const formatFactor = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
</script>

<template>
  <div class="tw:flex tw:flex-col tw:gap-4">
    <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <h1 class="text-h5">Rodina</h1>
      <v-btn v-if="members.length" color="primary" :prepend-icon="mdiPlus" @click="openNew">Pridať</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" :text="error.message" />
    <v-skeleton-loader v-else-if="isPending" type="list-item-avatar-two-line@3" />

    <EmptyState
      v-else-if="!members.length"
      :icon="mdiAccountGroupOutline"
      title="Kto u vás je?"
      text="Pridaj dospelých aj deti. Podľa veľkosti porcií sa potom prepočíta, koľko navariť a nakúpiť."
    >
      <v-btn color="primary" :prepend-icon="mdiPlus" @click="openNew">Pridať člena rodiny</v-btn>
    </EmptyState>

    <template v-else>
      <v-card>
        <v-list lines="two">
          <v-list-item
            v-for="member in members"
            :key="member.id"
            :title="member.name"
            :subtitle="`${MEMBER_KIND_LABELS[member.kind]} · porcia ${formatFactor(member.portionFactor)}${member.isActive ? '' : ' · nepočíta sa'}`"
            :class="{ 'tw:opacity-60': !member.isActive }"
            @click="openEdit(member)"
          >
            <template #prepend>
              <v-avatar :color="member.color ?? 'primary'" class="tw:font-bold tw:text-white">
                {{ member.name.slice(0, 1).toUpperCase() }}
              </v-avatar>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
      <p class="text-body-2 text-medium-emphasis">
        Na jedno jedlo pre celú rodinu:
        <strong>{{
          totalPortions === null ? 'nikto sa nepočíta' : plural(totalPortions, 'porcia', 'porcie', 'porcií')
        }}</strong>
      </p>
    </template>

    <MemberDialog
      v-model="dialogOpen"
      :member="editing"
      :child-factor="me?.settings.childPortionFactor ?? 0.5"
      :next-color="nextColor"
    />
  </div>
</template>
