import { onBeforeUnmount, ref, type Ref } from 'vue'

export interface TimerState {
  durationMs: number
  /** Čas (ms, Date.now), kedy časovač dobehne; len pri behu. */
  endsAt: number | null
  remainingMs: number
  status: 'idle' | 'running' | 'paused' | 'done'
}

export const createTimer = (durationMs: number): TimerState => ({
  durationMs,
  endsAt: null,
  remainingMs: durationMs,
  status: 'idle',
})

/** Spustí alebo obnoví odpočítavanie; hotový časovač začne odznova. */
export function startTimer(state: TimerState, now: number): TimerState {
  const remainingMs = state.status === 'done' ? state.durationMs : state.remainingMs
  return { ...state, status: 'running', remainingMs, endsAt: now + remainingMs }
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state
  return { ...state, status: 'paused', endsAt: null, remainingMs: Math.max(0, state.endsAt - now) }
}

export const resetTimer = (state: TimerState): TimerState => createTimer(state.durationMs)

/** Aktualizuje zostávajúci čas; po dobehnutí je časovač `done`. */
export function tickTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running' || state.endsAt === null) return state
  const remainingMs = Math.max(0, state.endsAt - now)
  return remainingMs === 0
    ? { ...state, status: 'done', endsAt: null, remainingMs: 0 }
    : { ...state, remainingMs }
}

/** 90 000 → „1:30“, 3 725 000 → „1:02:05“; sekundy sa zaokrúhľujú nahor. */
export function formatTimer(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Reaktívny časovač pre krok receptu; `onDone` sa zavolá raz po dobehnutí. */
export function useTimer(durationMs: number, onDone?: () => void) {
  const state: Ref<TimerState> = ref(createTimer(durationMs))
  let interval: ReturnType<typeof setInterval> | undefined

  const stopInterval = () => {
    clearInterval(interval)
    interval = undefined
  }
  const loop = () => {
    const next = tickTimer(state.value, Date.now())
    const finished = state.value.status === 'running' && next.status === 'done'
    state.value = next
    if (next.status !== 'running') stopInterval()
    if (finished) onDone?.()
  }

  return {
    state,
    start() {
      state.value = startTimer(state.value, Date.now())
      stopInterval()
      interval = setInterval(loop, 250)
    },
    pause() {
      state.value = pauseTimer(state.value, Date.now())
      stopInterval()
    },
    reset() {
      state.value = resetTimer(state.value)
      stopInterval()
    },
    dispose: stopInterval,
    /** Pre použitie v komponente: zastaví interval pri odchode. */
    autoDispose() {
      onBeforeUnmount(stopInterval)
    },
  }
}
