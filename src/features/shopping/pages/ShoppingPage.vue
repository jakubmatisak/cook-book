<script setup lang="ts">
import {
  mdiCartOutline,
  mdiCartRemove,
  mdiCheckAll,
  mdiDeleteForeverOutline,
  mdiChevronDown,
  mdiChevronUp,
  mdiCloudOffOutline,
  mdiDeleteSweepOutline,
  mdiFridgeOutline,
  mdiDotsVertical,
  mdiPrinterOutline,
  mdiPlaylistPlus,
  mdiPlus,
} from '@mdi/js'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GenerateResult, ShoppingItemDto } from '@shared/api'
import { parseItemText } from '@shared/shopping'
import { useShopCategories } from '@/api/catalog'
import { useMe } from '@/api/me'
import {
  offlineQueue,
  shoppingKeys,
  useAddItem,
  useCheckMany,
  useClearAll,
  useClearChecked,
  useMoveCheckedToPantry,
  useDeleteItem,
  useShoppingItems,
  useShoppingLists,
  useToggleItem,
} from '@/api/shopping'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import ListLayout from '@/components/ListLayout.vue'
import { useOnline } from '@/composables/useOnline'
import { useUserToggle } from '@/composables/useUserToggle'
import { useToday } from '@/composables/useToday'
import { printPage } from '@/composables/usePrintMode'
import { errorText } from '@/i18n/errors'
import { tc } from '@/i18n/format'
import GenerateDialog from '../components/GenerateDialog.vue'
import ItemEditDialog from '../components/ItemEditDialog.vue'
import { summarizeGenerate } from '@/features/pantry/format'
import ShoppingItemRow from '../components/ShoppingItemRow.vue'
import ShoppingPrintList from '../components/ShoppingPrintList.vue'

const { t } = useI18n()
const client = useQueryClient()
const today = useToday()
const { data: me } = useMe()
const { data: lists } = useShoppingLists()
const listId = computed(() => lists.value?.find((l) => l.isDefault)?.id ?? lists.value?.[0]?.id)
const { data: items, isPending, error } = useShoppingItems(listId)
const { data: categories } = useShopCategories()

const snackbar = ref({ show: false, text: '', color: 'success' })
const undo = ref<(() => Promise<void>) | null>(null)
const notify = (text: string, color = 'success', onUndo: (() => Promise<void>) | null = null) => {
  undo.value = onUndo
  snackbar.value = { show: true, text, color }
}

// Odoslanie odškrtnutí urobených bez signálu
const queued = ref(0)
async function flushQueue() {
  try {
    const sent = await offlineQueue.flush()
    if (sent && listId.value) await client.invalidateQueries({ queryKey: shoppingKeys.items(listId.value) })
  } catch {
    // stále bez spojenia – skúsime pri ďalšom pripojení
  } finally {
    queued.value = await offlineQueue.size()
  }
}
const online = useOnline(flushQueue)
onMounted(flushQueue)

const categoryName = (id: string | null) =>
  categories.value?.find((c) => c.id === id)?.name ?? t('shopping.categoryOther')
const toBuy = computed(() => items.value?.filter((i) => !i.isChecked) ?? [])
const inCart = computed(() => items.value?.filter((i) => i.isChecked) ?? [])
const groups = computed(() => {
  const result: { id: string; name: string; items: ShoppingItemDto[] }[] = []
  for (const item of toBuy.value) {
    const id = item.shopCategoryId ?? 'none'
    let group = result.find((g) => g.id === id)
    if (!group) result.push((group = { id, name: categoryName(item.shopCategoryId), items: [] }))
    group.items.push(item)
  }
  return result
})
// Sekcia „V košíku“ je predvolene rozbalená; zbalenie si pamätajú nastavenia človeka.
const showCart = useUserToggle('shoppingCartOpen')

const subtitle = computed(() => {
  if (!items.value?.length) return undefined
  return t('shopping.subtitle', {
    toBuy: tc('common.plural.items', toBuy.value.length),
    inCart: inCart.value.length,
  })
})

// Pridanie jedným riadkom: „2 kg zemiaky“
const newItem = ref('')
const add = useAddItem()
async function onAdd() {
  const parsed = parseItemText(newItem.value ?? '')
  if (!parsed.name || !listId.value) return
  try {
    await add.mutateAsync({ listId: listId.value, input: { ...parsed, shopCategoryId: null } })
    newItem.value = ''
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.addFailed'), 'error')
  }
}

const toggle = useToggleItem()
async function onToggle(item: ShoppingItemDto) {
  try {
    const result = await toggle.mutateAsync({ item, isChecked: !item.isChecked })
    if (result === 'queued') queued.value = await offlineQueue.size()
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.toggleFailed'), 'error')
  }
}

const removeItem = useDeleteItem()
async function onRemove(item: ShoppingItemDto) {
  try {
    await removeItem.mutateAsync(item)
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.removeFailed'), 'error')
  }
}

const clear = useClearChecked()
async function onClearChecked() {
  if (!listId.value) return
  const { removed } = await clear.mutateAsync(listId.value)
  notify(t('shopping.snackbar.cleared', { items: tc('common.plural.items', removed) }))
}

// Označiť všetko / zrušiť označenie (so Späť) a vymazať celý zoznam (po potvrdení).
const checkMany = useCheckMany()
async function setAll(isChecked: boolean) {
  const listIdValue = listId.value
  const ids = (isChecked ? toBuy.value : inCart.value).map((i) => i.id)
  if (!listIdValue || !ids.length) return
  const run = async (checked: boolean) => {
    const result = await checkMany.mutateAsync({ listId: listIdValue, ids, isChecked: checked })
    if (result === 'queued') queued.value = await offlineQueue.size()
  }
  try {
    await run(isChecked)
    const items = tc('common.plural.items', ids.length)
    notify(
      t(isChecked ? 'shopping.snackbar.checkedAll' : 'shopping.snackbar.uncheckedAll', { items }),
      'success',
      () => run(!isChecked),
    )
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.toggleFailed'), 'error')
  }
}
async function onUndo() {
  const run = undo.value
  undo.value = null
  snackbar.value.show = false
  try {
    await run?.()
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.toggleFailed'), 'error')
  }
}

const clearAll = useClearAll()
const clearAllOpen = ref(false)
async function onClearAll() {
  if (!listId.value) return
  try {
    const { removed } = await clearAll.mutateAsync(listId.value)
    clearAllOpen.value = false
    notify(t('shopping.snackbar.clearedAll', { items: tc('common.plural.items', removed) }))
  } catch (e) {
    notify(errorText(e, 'shopping.snackbar.removeFailed'), 'error')
  }
}

const moveToPantry = useMoveCheckedToPantry()
async function onMoveToPantry() {
  if (!listId.value) return
  const { moved } = await moveToPantry.mutateAsync(listId.value)
  notify(t('shopping.snackbar.moved', { items: tc('common.plural.items', moved) }))
}

const editOpen = ref(false)
const editing = ref<ShoppingItemDto | null>(null)
function onEdit(item: ShoppingItemDto) {
  editing.value = item
  editOpen.value = true
}

const printList = () => printPage()

const generateOpen = ref(false)
function onGenerated(result: GenerateResult) {
  notify(summarizeGenerate(result))
}
</script>

<template>
  <ListLayout>
    <template #header>
      <PageHeader :title="t('shopping.title')" :subtitle="subtitle">
        <v-btn
          color="primary"
          variant="tonal"
          :prepend-icon="mdiPlaylistPlus"
          :disabled="!listId"
          @click="generateOpen = true"
        >
          {{ t('shopping.fromPlan') }}
        </v-btn>
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="mdiDotsVertical"
              variant="text"
              :aria-label="t('shopping.moreActions')"
            />
          </template>
          <v-list>
            <v-list-item
              :prepend-icon="mdiCheckAll"
              :title="t('shopping.checkAll')"
              :disabled="!toBuy.length"
              data-test="check-all"
              @click="setAll(true)"
            />
            <v-list-item
              :prepend-icon="mdiCartRemove"
              :title="t('shopping.uncheckAll')"
              :disabled="!inCart.length"
              data-test="uncheck-all"
              @click="setAll(false)"
            />
            <v-list-item :prepend-icon="mdiPrinterOutline" :title="t('shopping.print')" @click="printList" />
            <v-list-item
              :prepend-icon="mdiDeleteSweepOutline"
              :title="t('shopping.clearChecked')"
              :disabled="!inCart.length"
              @click="onClearChecked"
            />
            <v-list-item
              :prepend-icon="mdiDeleteForeverOutline"
              :title="t('shopping.clearAll.action')"
              :disabled="!items?.length"
              base-color="error"
              data-test="clear-all"
              @click="clearAllOpen = true"
            />
          </v-list>
        </v-menu>
      </PageHeader>

      <v-alert
        v-if="!online || queued"
        type="warning"
        density="compact"
        :icon="mdiCloudOffOutline"
        class="mb-4 d-print-none"
        :text="
          online
            ? t('shopping.offline.queued', { changes: tc('shopping.plural.changes', queued) })
            : t('shopping.offline.noSignal')
        "
      />

      <v-form class="d-flex ga-2 mb-4 d-print-none" @submit.prevent="onAdd">
        <v-text-field
          v-model="newItem"
          :label="t('shopping.add.label')"
          hide-details
          autocomplete="off"
          enterkeyhint="done"
          :disabled="!listId"
        />
        <v-btn
          type="submit"
          color="primary"
          :icon="mdiPlus"
          size="large"
          :loading="add.isPending.value"
          :disabled="!newItem?.trim()"
          :aria-label="t('shopping.add.aria')"
        />
      </v-form>
    </template>

    <v-alert v-if="error" type="error" :text="errorText(error)" />
    <v-skeleton-loader v-else-if="isPending" type="list-item@6" />

    <EmptyState
      v-else-if="!items?.length"
      :icon="mdiCartOutline"
      :title="t('shopping.empty.title')"
      :text="t('shopping.empty.text')"
    >
      <v-btn color="primary" :prepend-icon="mdiPlaylistPlus" @click="generateOpen = true">{{
        t('shopping.empty.generate')
      }}</v-btn>
    </EmptyState>

    <template v-else>
      <v-alert
        v-if="!toBuy.length"
        type="success"
        :icon="mdiCheckAll"
        :text="t('shopping.allInCart')"
        class="mb-4"
      />

      <!-- Pri tlači sa namiesto interaktívneho zoznamu vytlačí zhustený pohľad do obchodu. -->
      <ShoppingPrintList v-if="groups.length" :groups="groups" :date="today" />

      <v-card v-if="groups.length" class="mb-4 d-print-none" data-test="interactive-list">
        <v-list lines="two" class="py-0">
          <template v-for="(group, gi) in groups" :key="group.id">
            <v-divider v-if="gi > 0" />
            <v-list-subheader class="text-primary font-weight-bold text-uppercase">{{
              group.name
            }}</v-list-subheader>
            <ShoppingItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              @toggle="onToggle"
              @edit="onEdit"
              @remove="onRemove"
            />
          </template>
        </v-list>
      </v-card>

      <div v-if="inCart.length" class="d-print-none">
        <v-btn
          variant="text"
          :append-icon="showCart ? mdiChevronUp : mdiChevronDown"
          class="mb-2"
          data-test="cart-toggle"
          :aria-expanded="showCart"
          @click="showCart = !showCart"
        >
          {{ t('shopping.inCart', { n: inCart.length }) }}
        </v-btn>
        <v-expand-transition>
          <v-card v-if="showCart" data-test="cart-list">
            <v-list lines="two" class="py-0">
              <ShoppingItemRow
                v-for="item in inCart"
                :key="item.id"
                :item="item"
                @toggle="onToggle"
                @edit="onEdit"
                @remove="onRemove"
              />
            </v-list>
            <!-- Čo s kúpeným: len vymazať, alebo presunúť do špajze (označí ako doma aj s množstvom). -->
            <v-card-actions class="flex-wrap ga-2 px-4 pb-4">
              <v-spacer />
              <v-btn
                :prepend-icon="mdiDeleteSweepOutline"
                variant="text"
                :loading="clear.isPending.value"
                :disabled="moveToPantry.isPending.value"
                data-test="cart-clear"
                @click="onClearChecked"
              >
                {{ t('shopping.clearChecked') }}
              </v-btn>
              <v-btn
                :prepend-icon="mdiFridgeOutline"
                color="primary"
                variant="tonal"
                :loading="moveToPantry.isPending.value"
                :disabled="clear.isPending.value"
                data-test="cart-to-pantry"
                @click="onMoveToPantry"
              >
                {{ t('shopping.moveToPantry') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-expand-transition>
      </div>
    </template>

    <GenerateDialog
      v-if="listId"
      v-model="generateOpen"
      :list-id="listId"
      :today="today"
      :week-starts-on="me?.settings.weekStartsOn ?? 1"
      @done="onGenerated"
    />
    <ItemEditDialog v-model="editOpen" :item="editing" />
    <v-dialog v-model="clearAllOpen" max-width="420">
      <v-card :title="t('shopping.clearAll.title')" data-test="clear-all-dialog">
        <v-card-text>
          {{ t('shopping.clearAll.text', { items: tc('common.plural.items', items?.length ?? 0) }) }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="clearAllOpen = false">{{ t('common.actions.cancel') }}</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="clearAll.isPending.value"
            data-test="clear-all-confirm"
            @click="onClearAll"
          >
            {{ t('shopping.clearAll.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">
      {{ snackbar.text }}
      <template v-if="undo" #actions>
        <v-btn variant="text" @click="onUndo">{{ t('shopping.undo') }}</v-btn>
      </template>
    </v-snackbar>
  </ListLayout>
</template>
