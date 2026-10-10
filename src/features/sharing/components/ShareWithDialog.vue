<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RECIPE_CATEGORIES, type RecipeCategory } from '@shared/recipes'
import { SHARE_LIMITS, type ShareKind } from '@shared/sharing'
import { useTags } from '@/api/catalog'
import { useContacts, useCreateShares } from '@/api/sharing'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{
  /** Vybrané recepty; bez nich sa zdieľa celá kategória alebo tag. */
  recipeIds?: string[]
  /** Predvolený druh pri zdieľaní bez receptov. */
  kind?: Exclude<ShareKind, 'recipes'>
  tagId?: string
  category?: RecipeCategory
}>()
const emit = defineEmits<{ done: [message: string] }>()

const { t } = useI18n()
const { data: contacts } = useContacts()
const { data: tags } = useTags()
const create = useCreateShares()

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emails = ref<string[]>([])
const kind = ref<Exclude<ShareKind, 'recipes'>>(props.kind ?? 'category')
const category = ref<RecipeCategory | null>(props.category ?? null)
const tagId = ref<string | null>(props.tagId ?? null)
const message = ref('')
const error = ref('')

watch(open, (value) => {
  if (!value) return
  emails.value = []
  message.value = ''
  error.value = ''
  kind.value = props.kind ?? 'category'
  category.value = props.category ?? null
  tagId.value = props.tagId ?? null
})

const byRecipes = computed(() => Boolean(props.recipeIds?.length))
const normalized = computed(() => [...new Set(emails.value.map((e) => String(e).trim().toLowerCase()))])
const invalid = computed(() => normalized.value.filter((e) => !EMAIL.test(e)))
const known = computed(() => new Set((contacts.value ?? []).map((c) => c.email)))
const newEmails = computed(() => normalized.value.filter((e) => EMAIL.test(e) && !known.value.has(e)))

const contactItems = computed(() =>
  (contacts.value ?? []).map((c) => ({ title: c.name ? `${c.name} (${c.email})` : c.email, value: c.email })),
)
const categoryItems = computed(() =>
  RECIPE_CATEGORIES.map((c) => ({ title: t(`common.category.${c}`), value: c })),
)
const tagItems = computed(() => (tags.value ?? []).map((tag) => ({ title: tag.name, value: tag.id })))
const kindItems = computed(() => [
  { value: 'category' as const, title: t('sharing.dialog.kindCategory') },
  { value: 'tag' as const, title: t('sharing.dialog.kindTag') },
])

const targetName = computed(() =>
  kind.value === 'tag'
    ? (tags.value?.find((tag) => tag.id === tagId.value)?.name ?? '')
    : category.value
      ? t(`common.category.${category.value}`)
      : '',
)
const hasTarget = computed(
  () => byRecipes.value || (kind.value === 'tag' ? Boolean(tagId.value) : Boolean(category.value)),
)

const summary = computed(() => {
  if (!normalized.value.length || !hasTarget.value) return ''
  const people = tc('sharing.dialog.people', normalized.value.length)
  if (byRecipes.value) {
    return t('sharing.dialog.summaryRecipes', {
      recipes: tc('sharing.dialog.recipes', props.recipeIds!.length),
      people,
    })
  }
  return t(kind.value === 'tag' ? 'sharing.dialog.summaryTag' : 'sharing.dialog.summaryCategory', {
    name: targetName.value,
    people,
  })
})

const canSend = computed(
  () =>
    normalized.value.length > 0 &&
    normalized.value.length <= SHARE_LIMITS.recipients &&
    invalid.value.length === 0 &&
    hasTarget.value &&
    message.value.length <= SHARE_LIMITS.message,
)

async function send() {
  error.value = ''
  const text = message.value.trim() || null
  try {
    await create.mutateAsync(
      byRecipes.value
        ? { emails: normalized.value, kind: 'recipes', recipeIds: props.recipeIds!, message: text }
        : kind.value === 'tag'
          ? { emails: normalized.value, kind: 'tag', tagId: tagId.value!, message: text }
          : { emails: normalized.value, kind: 'category', category: category.value!, message: text },
    )
    open.value = false
    emit('done', t('sharing.dialog.sent'))
  } catch (e) {
    error.value = errorText(e)
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card :title="t('sharing.dialog.title')" data-test="share-dialog">
      <v-card-text class="d-flex flex-column ga-4">
        <v-combobox
          v-model="emails"
          :items="contactItems"
          :return-object="false"
          :label="t('sharing.dialog.emails')"
          :hint="t('sharing.dialog.emailsHint')"
          :error-messages="invalid.map((email) => t('sharing.dialog.invalidEmail', { email }))"
          persistent-hint
          multiple
          chips
          closable-chips
          hide-no-data
          autofocus
          data-test="share-emails"
        />

        <template v-if="!byRecipes">
          <div>
            <div class="text-body-medium text-medium-emphasis mb-2">{{ t('sharing.dialog.what') }}</div>
            <v-btn-toggle
              v-model="kind"
              mandatory
              divided
              variant="outlined"
              color="primary"
              density="compact"
              data-test="share-kind"
            >
              <v-btn v-for="item in kindItems" :key="item.value" :value="item.value" class="text-none">
                {{ item.title }}
              </v-btn>
            </v-btn-toggle>
          </div>
          <v-select
            v-if="kind === 'category'"
            v-model="category"
            :items="categoryItems"
            :label="t('sharing.dialog.category')"
            hide-details
            data-test="share-category"
          />
          <v-select
            v-else
            v-model="tagId"
            :items="tagItems"
            :label="t('sharing.dialog.tag')"
            hide-details
            data-test="share-tag"
          />
        </template>

        <v-textarea
          v-model="message"
          :label="t('sharing.dialog.message')"
          :counter="SHARE_LIMITS.message"
          :maxlength="SHARE_LIMITS.message"
          rows="2"
          auto-grow
          data-test="share-message"
        />

        <div v-if="summary" class="text-body-medium" data-test="share-summary">{{ summary }}</div>
        <v-alert
          v-if="newEmails.length"
          type="info"
          variant="tonal"
          density="compact"
          :text="t('sharing.dialog.accessHint', { emails: newEmails.join(', ') })"
          data-test="share-access-hint"
        />
        <v-alert v-if="error" type="error" density="compact" :text="error" />
      </v-card-text>
      <v-card-actions class="px-4 pb-4 flex-wrap ga-1">
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.actions.cancel') }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canSend"
          :loading="create.isPending.value"
          data-test="share-send"
          @click="send"
        >
          {{ t('sharing.dialog.send') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
