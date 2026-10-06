import { ref } from 'vue'

/**
 * Vlastné okno aplikácie namiesto `window.confirm`, ktoré prehliadač ukazuje s názvom domény
 * (a nedá sa ostýlovať). `ask()` otvorí okno a vráti odpoveď: true = odísť, false = zostať.
 * Hodí sa ako návratová hodnota `onBeforeRouteLeave`.
 */
export function useLeavePrompt() {
  const open = ref(false)
  let resolve: ((leave: boolean) => void) | undefined

  function answer(leave: boolean) {
    open.value = false
    resolve?.(leave)
    resolve = undefined
  }

  function ask(): Promise<boolean> {
    // Predošlá nezodpovedaná otázka sa berie ako „zostať“.
    resolve?.(false)
    open.value = true
    return new Promise<boolean>((done) => {
      resolve = done
    })
  }

  return { open, ask, answer }
}
