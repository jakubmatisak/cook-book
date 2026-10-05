<script setup lang="ts">
import {
  mdiCartOutline,
  mdiCheckAll,
  mdiChevronDown,
  mdiChevronUp,
  mdiCloudOffOutline,
  mdiDeleteSweepOutline,
  mdiDotsVertical,
  mdiPrinterOutline,
  mdiPlaylistPlus,
  mdiPlus,
} from '@mdi/js'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'
import type { GenerateResult, ShoppingItemDto } from '@shared/api'
import { parseItemText } from '@shared/shopping'
import { useShopCategories } from '@/api/catalog'
import { useMe } from '@/api/me'
import {
  offlineQueue,
  shoppingKeys,
  useAddItem,
  useClearChecked,
  useShoppingItems,
  useShoppingLists,
  useToggleItem,
} from '@/api/shopping'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useOnline } from '@/composables/useOnline'
import { useToday } from '@/composables/useToday'
import { plural } from '@/lib/format'
import GenerateDialog from '../components/GenerateDialog.vue'
import ItemEditDialog from '../components/ItemEditDialog.vue'
import { summarizeGenerate } from '@/features/pantry/format'
import ShoppingItemRow from '../components/ShoppingItemRow.vue'

const client = useQueryClient()
const today = useToday()
const { data: me } = useMe()
const { data: lists } = useShoppingLists()
const listId = computed(() => lists.value?.find((l) => l.isDefault)?.id ?? lists.value?.[0]?.id)
const { data: items, isPending, error } = useShoppingItems(listId)
const { data: categories } = useShopCategories()

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color = 'success') => (snackbar.value = { show: true, text, color })

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

const categoryName = (id: string | null) => categories.value?.find((c) => c.id === id)?.name ?? 'Ostatné'
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
const showCart = ref(false)

const subtitle = computed(() => {
  if (!items.value?.length) return undefined
  return `${plural(toBuy.value.length, 'položka', 'položky', 'položiek')} na kúpenie · ${inCart.value.length} v košíku`
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
    notify(e instanceof Error ? e.message : 'Položku sa nepodarilo pridať.', 'error')
  }
}

const toggle = useToggleItem()
async function onToggle(item: ShoppingItemDto) {
  try {
    const result = await toggle.mutateAsync({ item, isChecked: !item.isChecked })
    if (result === 'queued') queued.value = await offlineQueue.size()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Zmena sa neuložila.', 'error')
  }
}

const clear = useClearChecked()
async function onClearChecked() {
  if (!listId.value) return
  const { removed } = await clear.mutateAsync(listId.value)
  notify(`Odstránené z košíka: ${plural(removed, 'položka', 'položky', 'položiek')}.`)
}

const editOpen = ref(false)
const editing = ref<ShoppingItemDto | null>(null)
function onEdit(item: ShoppingItemDto) {
  editing.value = item
  editOpen.value = true
}

const printList = () => window.print()

const generateOpen = ref(false)
function onGenerated(result: GenerateResult) {
  notify(summarizeGenerate(result))
}
</script>

<template>
  <div class="mx-auto" style="max-width: 44rem">
    <PageHeader title="Nákupný zoznam" :subtitle="subtitle">
      <v-btn
        color="primary"
        variant="tonal"
        :prepend-icon="mdiPlaylistPlus"
        :disabled="!listId"
        @click="generateOpen = true"
      >
        Z jedálnička
      </v-btn>
      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" :icon="mdiDotsVertical" variant="text" aria-label="Ďalšie akcie" />
        </template>
        <v-list>
          <v-list-item :prepend-icon="mdiPrinterOutline" title="Tlačiť nákup" @click="printList" />
          <v-list-item
            :prepend-icon="mdiDeleteSweepOutline"
            title="Vymazať kúpené"
            :disabled="!inCart.length"
            @click="onClearChecked"
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
          ? `Čaká na odoslanie: ${plural(queued, 'zmena', 'zmeny', 'zmien')} z času bez signálu.`
          : 'Bez signálu. Odškrtávať môžeš ďalej, zmeny sa odošlú po pripojení.'
      "
    />

    <v-form class="d-flex ga-2 mb-4 d-print-none" @submit.prevent="onAdd">
      <v-text-field
        v-model="newItem"
        label="Pridať položku, napr. 2 kg zemiaky"
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
        aria-label="Pridať položku"
      />
    </v-form>

    <v-alert v-if="error" type="error" :text="error.message" />
    <v-skeleton-loader v-else-if="isPending" type="list-item@6" />

    <EmptyState
      v-else-if="!items?.length"
      :icon="mdiCartOutline"
      title="Zoznam je prázdny"
      text="Vygeneruj ho z jedálnička alebo pridaj položky ručne."
    >
      <v-btn color="primary" :prepend-icon="mdiPlaylistPlus" @click="generateOpen = true"
        >Vygenerovať z jedálnička</v-btn
      >
    </EmptyState>

    <template v-else>
      <v-alert
        v-if="!toBuy.length"
        type="success"
        :icon="mdiCheckAll"
        text="Všetko je v košíku."
        class="mb-4"
      />

      <v-card v-if="groups.length" class="mb-4">
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
            />
          </template>
        </v-list>
      </v-card>

      <div v-if="inCart.length" class="d-print-none">
        <v-btn
          variant="text"
          :append-icon="showCart ? mdiChevronUp : mdiChevronDown"
          class="mb-2"
          @click="showCart = !showCart"
        >
          V košíku ({{ inCart.length }})
        </v-btn>
        <v-expand-transition>
          <v-card v-if="showCart">
            <v-list lines="two" class="py-0">
              <ShoppingItemRow
                v-for="item in inCart"
                :key="item.id"
                :item="item"
                @toggle="onToggle"
                @edit="onEdit"
              />
            </v-list>
            <v-card-actions>
              <v-spacer />
              <v-btn
                :prepend-icon="mdiDeleteSweepOutline"
                variant="text"
                :loading="clear.isPending.value"
                @click="onClearChecked"
              >
                Vymazať kúpené
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
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">{{
      snackbar.text
    }}</v-snackbar>
  </div>
</template>
