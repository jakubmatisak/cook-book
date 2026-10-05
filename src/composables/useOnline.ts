import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** Či má zariadenie podľa prehliadača pripojenie; `onReconnect` sa zavolá po obnovení. */
export function useOnline(onReconnect?: () => void): Ref<boolean> {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const up = () => {
    online.value = true
    onReconnect?.()
  }
  const down = () => {
    online.value = false
  }
  onMounted(() => {
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', up)
    window.removeEventListener('offline', down)
  })
  return online
}
