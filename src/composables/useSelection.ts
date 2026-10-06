import { computed, ref } from 'vue'

/** Výber položiek zoznamu zaškrtávacími poľami (hromadné úpravy a mazanie). Mimo režimu výberu je výber prázdny. */
export function useSelection() {
  const active = ref(false)
  const selected = ref<string[]>([])
  const count = computed(() => selected.value.length)

  const has = (id: string) => selected.value.includes(id)
  const toggle = (id: string) => {
    selected.value = has(id) ? selected.value.filter((s) => s !== id) : [...selected.value, id]
  }
  const set = (ids: readonly string[]) => {
    selected.value = [...new Set(ids)]
  }
  const clear = () => {
    selected.value = []
  }
  const start = () => {
    active.value = true
  }
  const stop = () => {
    active.value = false
    selected.value = []
  }
  /** Po zmene zoznamu (filter, zmazanie) ostanú vybrané len položky, ktoré v ňom ešte sú. */
  const keepOnly = (ids: readonly string[]) => {
    const present = new Set(ids)
    const next = selected.value.filter((id) => present.has(id))
    if (next.length !== selected.value.length) selected.value = next
  }

  return { active, selected, count, has, toggle, set, clear, start, stop, keepOnly }
}
