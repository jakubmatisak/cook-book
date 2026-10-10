<script setup lang="ts">
import { mdiAccountMultipleOutline, mdiDotsVertical, mdiShareVariantOutline } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IncomingShareDto } from '@shared/api'
import {
  useAcceptShare,
  useDeclineShare,
  useIncomingShares,
  useLeaveShare,
  useOutgoingShares,
  useRemoveShareItems,
  useRevokeShare,
} from '@/api/sharing'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { errorText } from '@/i18n/errors'
import { formatDate, tc } from '@/i18n/format'
import AcceptShareDialog from '../components/AcceptShareDialog.vue'
import { shareWhat, STATUS_COLORS } from '../labels'

const { t } = useI18n()
const tab = ref<'outgoing' | 'incoming'>('outgoing')
const { data: outgoing, isPending: outgoingPending, error: outgoingError } = useOutgoingShares()
const { data: incoming, isPending: incomingPending, error: incomingError } = useIncomingShares()
const revoke = useRevokeShare()
const removeItems = useRemoveShareItems()
const accept = useAcceptShare()
const decline = useDeclineShare()
const leave = useLeaveShare()

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })
async function run(action: () => Promise<unknown>, done: string) {
  try {
    await action()
    notify(done)
  } catch (e) {
    notify(errorText(e), 'error')
  }
}

/** Prijaté a čakajúce zdieľania zoskupené podľa odosielateľa (domácnosti). */
const incomingGroups = computed(() => {
  const groups = new Map<string, { title: string; shares: IncomingShareDto[] }>()
  for (const share of incoming.value ?? []) {
    const key = share.fromHouseholdName
    const group = groups.get(key) ?? {
      title: t('sharing.fromHousehold', { name: share.fromName, household: share.fromHouseholdName }),
      shares: [],
    }
    group.shares.push(share)
    groups.set(key, group)
  }
  return [...groups.values()]
})
const pendingCount = computed(() => (incoming.value ?? []).filter((s) => s.status === 'pending').length)

const picking = ref<IncomingShareDto | null>(null)
const pickOpen = ref(false)
function pick(share: IncomingShareDto) {
  picking.value = share
  pickOpen.value = true
}
</script>

<template>
  <PageHeader :title="t('sharing.title')" :subtitle="t('sharing.subtitle')" />

  <v-tabs v-model="tab" color="primary" class="mb-4">
    <v-tab value="outgoing" data-test="tab-outgoing">{{ t('sharing.tabs.outgoing') }}</v-tab>
    <v-tab value="incoming" data-test="tab-incoming">
      {{ t('sharing.tabs.incoming') }}
      <v-badge v-if="pendingCount" :content="pendingCount" color="primary" inline />
    </v-tab>
  </v-tabs>

  <template v-if="tab === 'outgoing'">
    <v-alert v-if="outgoingError" type="error" :text="errorText(outgoingError)" />
    <v-skeleton-loader v-else-if="outgoingPending" type="list-item-two-line@3" />
    <EmptyState
      v-else-if="!outgoing?.length"
      :icon="mdiShareVariantOutline"
      :title="t('sharing.empty.outgoingTitle')"
      :text="t('sharing.empty.outgoingText')"
    />
    <v-card v-else>
      <v-list lines="two">
        <template v-for="(share, index) in outgoing" :key="share.id">
          <v-divider v-if="index > 0" />
          <v-list-item data-test="outgoing-share">
            <v-list-item-title class="font-weight-medium">
              {{ share.toName ?? share.toEmail }}
            </v-list-item-title>
            <v-list-item-subtitle>
              <span v-if="share.toName">{{ share.toEmail }} · </span>{{ shareWhat(share) }} ·
              {{ formatDate(share.createdAt) }}
            </v-list-item-subtitle>
            <div
              v-if="share.kind === 'recipes' && share.recipes.length && share.status !== 'revoked'"
              class="d-flex flex-wrap ga-1 mt-2"
            >
              <v-chip
                v-for="recipe in share.recipes"
                :key="recipe.id"
                size="small"
                variant="tonal"
                :closable="share.status === 'pending' || share.status === 'accepted'"
                :close-label="t('sharing.actions.removeRecipe')"
                :data-test="`share-recipe-${recipe.id}`"
                @click:close="
                  run(
                    () => removeItems.mutateAsync({ id: share.id, recipeIds: [recipe.id] }),
                    t('sharing.done.removed'),
                  )
                "
              >
                {{ recipe.title }}
              </v-chip>
            </div>
            <template #append>
              <div class="d-flex align-center ga-1">
                <v-chip
                  :color="STATUS_COLORS[share.status]"
                  variant="tonal"
                  size="small"
                  data-test="share-status"
                >
                  {{ t(`sharing.status.${share.status}`) }}
                </v-chip>
                <v-menu v-if="share.status === 'pending' || share.status === 'accepted'">
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      :icon="mdiDotsVertical"
                      variant="text"
                      size="small"
                      :aria-label="t('sharing.actions.more')"
                      data-test="share-actions"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      :title="t('sharing.actions.revoke')"
                      data-test="share-revoke"
                      @click="run(() => revoke.mutateAsync({ id: share.id }), t('sharing.done.revoked'))"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>
          </v-list-item>
        </template>
      </v-list>
    </v-card>
  </template>

  <template v-else>
    <v-alert v-if="incomingError" type="error" :text="errorText(incomingError)" />
    <v-skeleton-loader v-else-if="incomingPending" type="list-item-two-line@3" />
    <EmptyState
      v-else-if="!incoming?.length"
      :icon="mdiAccountMultipleOutline"
      :title="t('sharing.empty.incomingTitle')"
      :text="t('sharing.empty.incomingText')"
    />
    <div v-else class="d-flex flex-column ga-4">
      <v-card v-for="group in incomingGroups" :key="group.title" :title="group.title">
        <v-list lines="two">
          <template v-for="(share, index) in group.shares" :key="share.id">
            <v-divider v-if="index > 0" />
            <v-list-item data-test="incoming-share">
              <v-list-item-title class="font-weight-medium">{{ shareWhat(share) }}</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(share.createdAt) }}</v-list-item-subtitle>
              <div v-if="share.message" class="text-body-medium mt-1">„{{ share.message }}“</div>
              <!-- Čakajúca ponuka ukáže, čo obsahuje; po prijatí čipy otvárajú recept na čítanie. -->
              <div v-if="share.recipes.length" class="d-flex flex-wrap ga-1 mt-2">
                <v-chip
                  v-for="recipe in share.recipes"
                  :key="recipe.id"
                  size="small"
                  variant="tonal"
                  :to="share.status === 'accepted' ? `/public/${recipe.id}` : undefined"
                >
                  {{ recipe.title }}
                </v-chip>
              </div>
              <div v-if="share.status === 'pending'" class="d-flex flex-wrap ga-2 mt-3">
                <v-btn
                  color="primary"
                  data-test="share-accept"
                  @click="run(() => accept.mutateAsync({ id: share.id }), t('sharing.done.accepted'))"
                >
                  {{ t('sharing.actions.accept') }}
                </v-btn>
                <v-btn v-if="share.kind === 'recipes'" variant="outlined" @click="pick(share)">
                  {{ t('sharing.actions.pick') }}
                </v-btn>
                <v-btn
                  variant="text"
                  data-test="share-decline"
                  @click="run(() => decline.mutateAsync({ id: share.id }), t('sharing.done.declined'))"
                >
                  {{ t('sharing.actions.decline') }}
                </v-btn>
              </div>
              <template #append>
                <div class="d-flex align-center ga-1">
                  <v-chip v-if="share.newCount" color="primary" variant="flat" size="small">
                    {{ tc('sharing.newCount', share.newCount) }}
                  </v-chip>
                  <v-chip :color="STATUS_COLORS[share.status]" variant="tonal" size="small">
                    {{ t(`sharing.status.${share.status}`) }}
                  </v-chip>
                  <v-menu v-if="share.status === 'accepted'">
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        :icon="mdiDotsVertical"
                        variant="text"
                        size="small"
                        :aria-label="t('sharing.actions.more')"
                      />
                    </template>
                    <v-list density="compact">
                      <v-list-item
                        :title="t('sharing.actions.leave')"
                        data-test="share-leave"
                        @click="run(() => leave.mutateAsync({ id: share.id }), t('sharing.done.left'))"
                      />
                    </v-list>
                  </v-menu>
                </div>
              </template>
            </v-list-item>
          </template>
        </v-list>
      </v-card>
    </div>
  </template>

  <AcceptShareDialog v-if="picking" v-model="pickOpen" :share="picking" @done="notify" />
  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>
