<script setup lang="ts">
import { mdiAccountGroupOutline, mdiPlus } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FamilyMemberDto } from '@shared/api'
import { MEMBER_COLORS } from '@shared/family'
import { entryPortions } from '@shared/portions'
import { useIsOwner, useMe } from '@/api/me'
import EmptyState from '@/components/EmptyState.vue'
import ActionButton from '@/components/ActionButton.vue'
import ListLayout from '@/components/ListLayout.vue'
import PageHeader from '@/components/PageHeader.vue'
import { errorText } from '@/i18n/errors'
import { formatNumber, tc } from '@/i18n/format'
import MemberDialog from '../components/MemberDialog.vue'

const { t } = useI18n()
const { data: me, isPending, error } = useMe()
const isOwner = useIsOwner()
const members = computed(() => me.value?.members ?? [])

// Domáci a návštevy zvlášť: návšteva sa nepočíta do porcií, kým nie je vybraná pri konkrétnom jedle.
const groups = computed(() =>
  [
    { key: 'family', title: null, members: members.value.filter((m) => m.kind !== 'guest') },
    {
      key: 'guests',
      title: t('family.page.guests'),
      members: members.value.filter((m) => m.kind === 'guest'),
    },
  ].filter((g) => g.members.length > 0),
)
const hasGuests = computed(() => members.value.some((m) => m.kind === 'guest'))

const totalPortions = computed(() =>
  entryPortions({ servingsOverride: null, audience: 'all' }, members.value),
)
const subtitle = computed(() => {
  if (!members.value.length) return undefined
  return totalPortions.value === null
    ? t('family.page.nobodyCounted')
    : t('family.page.totalPortions', { portions: tc('common.plural.portions', totalPortions.value) })
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

const memberSubtitle = (m: FamilyMemberDto) =>
  t(m.isActive ? 'family.page.memberSubtitle' : 'family.page.memberSubtitleInactive', {
    kind: t(`common.memberKind.${m.kind}`),
    factor: formatNumber(m.portionFactor),
  })
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader :title="t('common.nav.family')" :subtitle="subtitle">
        <ActionButton
          v-if="members.length && isOwner"
          :icon="mdiPlus"
          :label="t('common.actions.add')"
          color="primary"
          @click="openNew"
        />
      </PageHeader>
    </template>

    <v-alert v-if="error" type="error" :text="errorText(error)" />
    <v-skeleton-loader v-else-if="isPending" type="list-item-avatar-two-line@3" />

    <EmptyState
      v-else-if="!members.length"
      :icon="mdiAccountGroupOutline"
      :title="t('family.page.empty.title')"
      :text="isOwner ? t('family.page.empty.ownerText') : t('family.page.empty.memberText')"
    >
      <v-btn v-if="isOwner" color="primary" :prepend-icon="mdiPlus" @click="openNew">{{
        t('family.page.addMember')
      }}</v-btn>
    </EmptyState>

    <v-card v-else>
      <v-alert v-if="!isOwner" type="info" density="compact" data-test="family-readonly">
        {{ t('family.page.readonly') }}
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
                  {{ t(`common.preference.${p.kind}`) }}: {{ p.label }}
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
      <p v-if="hasGuests" class="text-body-small text-medium-emphasis px-4 pb-3">
        {{ t('family.page.guestsNote') }}
      </p>
    </v-card>

    <MemberDialog
      v-model="dialogOpen"
      :member="editing"
      :child-factor="me?.settings.childPortionFactor ?? 0.5"
      :next-color="nextColor"
    />
  </ListLayout>
</template>
