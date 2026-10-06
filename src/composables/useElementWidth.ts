import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Aktuálna šírka prvku v pixeloch (sleduje ju ResizeObserver). `initial` sa použije, kým prvok neexistuje
 * alebo kým prehliadač neoznámi prvú veľkosť, aby sa rozloženie pri načítaní zbytočne neprekresľovalo.
 */
export function useElementWidth(el: Ref<HTMLElement | undefined>, initial = 0): Ref<number> {
  const width = ref(initial)
  let observer: ResizeObserver | undefined

  const stop = () => {
    observer?.disconnect()
    observer = undefined
  }

  watch(
    el,
    (node) => {
      stop()
      if (!node || typeof ResizeObserver === 'undefined') return
      width.value = node.clientWidth || width.value
      observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) width.value = entry.contentRect.width
      })
      observer.observe(node)
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(stop)
  return width
}
