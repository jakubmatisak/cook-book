<script setup lang="ts">
import { mdiAccountGroupOutline, mdiPlus } from '@mdi/js'
import { computed, ref } from 'vue'
import type { FamilyMemberDto } from '@shared/api'
import { MEMBER_COLORS, MEMBER_KIND_LABELS } from '@shared/family'
import { entryPortions } from '@shared/portions'
import { PREFERENCE_CHIP_LABELS } from '@shared/preferences'
import { useIsOwner, useMe } from '@/api/me'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { plural } from '@/lib/format'
import MemberDialog from '../components/MemberDialog.vue'

const { data: me, isPending, error } = useMe()
const isOwner = useIsOwner()
const members = computed(() => me.value?.members ?? [])

// Domáci a návštevy zvlášť: návšteva sa nepočíta do porcií, kým nie je vybraná pri konkrétnom jedle.
const groups = computed(() =>
  [
    { key: 'family', title: null, members: members.value.filter((m) => m.kind !== 'guest') },
    { key: 'guests', title: 'Návštevy', members: members.value.filter((m) => m.kind === 'guest') },
  ].filter((g) => g.members.length > 0),
)
const hasGuests = computed(() => members.value.some((m) => m.kind === 'guest'))

const totalPortions = computed(() =>
  entryPortions({ servingsOverride: null, audience: 'all' }, members.value),
)
const subtitle = computed(() => {
  if (!members.value.length) return undefined
  return totalPortions.value === null
    ? 'Nikto sa nepočíta do porcií'
    : `Na jedno jedlo pre celú rodinu: ${plural(totalPortions.value, 'porcia', 'porcie', 'porcií')}`
})

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
const memberSubtitle = (m: FamilyMemberDto) =>
  `${MEMBER_KIND_LABELS[m.kind]} · porcia ${formatFactor(m.portionFactor)}${m.isActive ? '' : ' · nepočíta sa'}`
</script>

<template>
  <PageHeader title="Rodina" :subtitle="subtitle">
    <v-btn v-if="members.length && isOwner" color="primary" :prepend-icon="mdiPlus" @click="openNew"
      >Pridať</v-btn
    >
  </PageHeader>

  <v-alert v-if="error" type="error" :text="error.message" />
  <v-skeleton-loader v-else-if="isPending" type="list-item-avatar-two-line@3" />

  <EmptyState
    v-else-if="!members.length"
    :icon="mdiAccountGroupOutline"
    title="Kto u vás je?"
    :text="
      isOwner
        ? 'Pridaj dospelých aj deti. Podľa veľkosti porcií sa potom prepočíta, koľko navariť a nakúpiť. Návštevy s alergiami a averziami pridáš tiež.'
        : 'Rodinu pridáva vlastník domácnosti.'
    "
  >
    <v-btn v-if="isOwner" color="primary" :prepend-icon="mdiPlus" @click="openNew">Pridať člena rodiny</v-btn>
  </EmptyState>

  <v-card v-else>
    <v-alert v-if="!isOwner" type="info" density="compact" data-test="family-readonly">
      Rodinu a jej preferencie môže meniť len vlastník domácnosti.
    </v-alert>
    <v-list lines="two">
      <template v-for="group in groups" :key="group.key">
        <v-list-subheader v-if="group.title" data-test="guests-heading">{{ group.title }}</v-list-subheader>
        <v-list-item
          v-for="member in group.members"
          :key="member.id"
          :title="member.name"
          :subtitle="memberSubtitle(member)"
          :class="{ 'opacity-60': !member.isActive }"
          :link="isOwner"
          :ripple="isOwner"
          @click="isOwner && openEdit(member)"
        >
          <template v-if="member.preferences.length" #subtitle>
            <span class="d-block">{{ memberSubtitle(member) }}</span>
            <span class="d-flex flex-wrap ga-1 mt-1">
              <v-chip
                v-for="p in member.preferences"
                :key="p.kind + (p.ingredientId ?? p.tagId)"
                size="x-small"
                variant="tonal"
                :color="p.kind === 'allergy' ? 'error' : p.kind === 'dislike' ? 'warning' : 'secondary'"
              >
                {{ PREFERENCE_CHIP_LABELS[p.kind] }}: {{ p.label }}
              </v-chip>
            </span>
          </template>
          <template #prepend>
            <v-avatar :color="member.color ?? 'primary'" class="font-weight-bold">
              {{ member.name.slice(0, 1).toUpperCase() }}
            </v-avatar>
          </template>
        </v-list-item>
      </template>
    </v-list>
    <p v-if="hasGuests" class="text-caption text-medium-emphasis px-4 pb-3">
      Návšteva sa do porcií a upozornení počíta, až keď ju pri jedle v jedálničku vyberieš.
    </p>
  </v-card>

  <MemberDialog
    v-model="dialogOpen"
    :member="editing"
    :child-factor="me?.settings.childPortionFactor ?? 0.5"
    :next-color="nextColor"
  />
</template>
