<script setup lang="ts">
import { mdiAccountMultipleOutline, mdiSourceFork } from '@mdi/js'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { IncomingShareDto, ShareNoticeDto } from '@shared/api'
import {
  useAcceptShare,
  useDeclineShare,
  useDismissNotice,
  useIncomingShares,
  useMarkShareSeen,
  useReplaceFromSource,
  useShareNotices,
} from '@/api/sharing'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import AcceptShareDialog from './AcceptShareDialog.vue'

/** Upozornenia zdieľania na Prehľade: nové ponuky, pribudnuté recepty a zmenené originály kópií. */
const { t } = useI18n()
const router = useRouter()
const { data: notices } = useShareNotices()
const { data: incoming } = useIncomingShares()
const accept = useAcceptShare()
const decline = useDeclineShare()
const seen = useMarkShareSeen()
const dismiss = useDismissNotice()
const replace = useReplaceFromSource()

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })

const list = computed(() => notices.value ?? [])
const keyOf = (n: ShareNoticeDto) =>
  n.kind === 'changed' ? `changed-${n.recipeId}` : `${n.kind}-${n.shareId}`

function text(n: ShareNoticeDto): string {
  if (n.kind === 'offer') {
    return t('sharing.notice.offer', { name: n.fromName, recipes: tc('sharing.dialog.recipes', n.count) })
  }
  if (n.kind === 'new') {
    return t(n.tagName ? 'sharing.notice.newTag' : 'sharing.notice.newCategory', {
      name: n.fromName,
      label: n.tagName ?? (n.category ? t(`common.category.${n.category}`) : ''),
      recipes: tc('sharing.dialog.recipes', n.count),
    })
  }
  return t('sharing.notice.changed', { title: n.title, name: n.fromName })
}

async function run(action: () => Promise<unknown>, done?: string) {
  try {
    await action()
    if (done) notify(done)
  } catch (e) {
    notify(errorText(e), 'error')
  }
}

const picking = ref<IncomingShareDto | null>(null)
const pickOpen = ref(false)
function pick(shareId: string) {
  picking.value = incoming.value?.find((s) => s.id === shareId) ?? null
  pickOpen.value = Boolean(picking.value)
}

const replacing = ref<Extract<ShareNoticeDto, { kind: 'changed' }> | null>(null)
const replaceOpen = ref(false)
function askReplace(n: Extract<ShareNoticeDto, { kind: 'changed' }>) {
  replacing.value = n
  replaceOpen.value = true
}
async function confirmReplace() {
  const n = replacing.value
  if (!n) return
  await run(() => replace.mutateAsync(n.recipeId), t('sharing.done.replaced'))
  replaceOpen.value = false
}

async function showNew(shareId: string) {
  await run(() => seen.mutateAsync({ id: shareId }))
  void router.push({ path: '/recipes', query: { shared: 'only' } })
}
</script>

<template>
  <div v-if="list.length" class="d-flex flex-column ga-3 mb-4">
    <v-card v-for="n in list" :key="keyOf(n)" variant="tonal" color="primary" data-test="share-notice">
      <v-card-item :prepend-icon="n.kind === 'changed' ? mdiSourceFork : mdiAccountMultipleOutline">
        <v-card-title class="text-wrap text-title-medium">{{ text(n) }}</v-card-title>
        <v-card-subtitle v-if="n.kind === 'offer' && n.message" class="text-wrap"
          >„{{ n.message }}“</v-card-subtitle
        >
      </v-card-item>
      <v-card-actions class="flex-wrap ga-1 px-4 pb-3">
        <template v-if="n.kind === 'offer'">
          <v-btn
            variant="flat"
            color="primary"
            :loading="accept.isPending.value"
            data-test="notice-accept"
            @click="run(() => accept.mutateAsync({ id: n.shareId }), t('sharing.done.accepted'))"
          >
            {{ t('sharing.actions.accept') }}
          </v-btn>
          <v-btn variant="text" data-test="notice-pick" @click="pick(n.shareId)">
            {{ t('sharing.actions.pick') }}
          </v-btn>
          <v-btn
            variant="text"
            data-test="notice-decline"
            @click="run(() => decline.mutateAsync({ id: n.shareId }), t('sharing.done.declined'))"
          >
            {{ t('sharing.actions.decline') }}
          </v-btn>
        </template>
        <template v-else-if="n.kind === 'new'">
          <v-btn variant="flat" color="primary" data-test="notice-show" @click="showNew(n.shareId)">
            {{ t('sharing.actions.show') }}
          </v-btn>
          <v-btn
            variant="text"
            data-test="notice-hide"
            @click="run(() => seen.mutateAsync({ id: n.shareId }))"
          >
            {{ t('sharing.actions.hide') }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn variant="flat" color="primary" :to="`/public/${n.sourceId}`" data-test="notice-original">
            {{ t('sharing.actions.openOriginal') }}
          </v-btn>
          <v-btn variant="text" data-test="notice-replace" @click="askReplace(n)">
            {{ t('sharing.actions.replaceCopy') }}
          </v-btn>
          <v-btn
            variant="text"
            data-test="notice-dismiss"
            @click="run(() => dismiss.mutateAsync(n.recipeId))"
          >
            {{ t('sharing.actions.hide') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>

    <AcceptShareDialog v-if="picking" v-model="pickOpen" :share="picking" @done="notify" />
    <ConfirmDialog
      v-model="replaceOpen"
      :title="t('sharing.replace.title')"
      :text="t('sharing.replace.text', { title: replacing?.title ?? '', name: replacing?.fromName ?? '' })"
      :confirm-label="t('sharing.actions.replaceCopy')"
      :loading="replace.isPending.value"
      @confirm="confirmReplace"
    />
  </div>
  <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{ snackbar.text }}</v-snackbar>
</template>
