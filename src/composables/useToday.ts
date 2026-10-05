import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { todayIso } from '@shared/dates'

/**
 * Dnešný dátum, ktorý sa obnoví po návrate do aplikácie (PWA nechaná otvorená cez noc)
 * aj priebežne každú minútu.
 */
export function useToday(): Ref<string> {
  const today = ref(todayIso())
  const refresh = () => {
    const now = todayIso()
    if (now !== today.value) today.value = now
  }
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    timer = setInterval(refresh, 60_000)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
    clearInterval(timer)
  })
  return today
}
