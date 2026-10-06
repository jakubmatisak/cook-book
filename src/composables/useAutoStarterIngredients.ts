import { useQueryClient } from '@tanstack/vue-query'
import { watch } from 'vue'
import { useAddStarterIngredients } from '@/api/catalog'
import { meQueryKey, useMe } from '@/api/me'

/**
 * Pri prvom načítaní aplikácie pridá základné suroviny, ak ich domácnosť ešte nemá (príznak v nastaveniach).
 * Beží raz; existujúce suroviny sa nezduplikujú a zmazané sa nevrátia. Tlačidlo na stránke Ingrediencie ostáva.
 */
export function useAutoStarterIngredients() {
  const { data: me } = useMe()
  const add = useAddStarterIngredients()
  const client = useQueryClient()
  let started = false

  watch(
    () => me.value?.settings.starterIngredientsAdded,
    async (added) => {
      // undefined = /me ešte nie je načítané; true = už pridané.
      if (added !== false || started) return
      started = true
      try {
        await add.mutateAsync()
        await client.invalidateQueries({ queryKey: meQueryKey })
      } catch {
        // Nepodarilo sa (napr. bez signálu): skúsi sa pri ďalšom načítaní, tlačidlo funguje ručne.
        started = false
      }
    },
    { immediate: true },
  )
}
