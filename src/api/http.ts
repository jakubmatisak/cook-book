import type { ApiErrorBody } from '@shared/api'
import { activeHouseholdId } from '@/lib/household'

export const API_BASE = '/api/v1'

/** Chyba volania API; `status` 0 znamená výpadok siete. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface ApiFetchOptions {
  fetchFn?: typeof fetch
  /** Volá sa pri 401 alebo presmerovaní na Access; predvolene `handleSessionExpired`. */
  onUnauthorized?: () => void
}

/**
 * Stránka mimo service workera: Cloudflare Access na nej vyžiada prihlásenie
 * a Worker potom presmeruje späť na úvod (worker/index.ts).
 */
export const RELOGIN_PATH = '/auth/relogin'
const RELOGIN_GUARD_KEY = 'kniha:relogin-at'
const RELOGIN_GUARD_MS = 30_000

export interface SessionExpiredDeps {
  navigate: (path: string) => void
  now: () => number
  storage: Pick<Storage, 'getItem' | 'setItem'>
}

/** Presmeruje na prihlásenie najviac raz za 30 s, aby trvalé 401 nespôsobilo nekonečnú slučku. */
export function createSessionExpiredHandler(deps: SessionExpiredDeps): () => void {
  return () => {
    const now = deps.now()
    try {
      const last = Number(deps.storage.getItem(RELOGIN_GUARD_KEY) ?? 0)
      if (now - last < RELOGIN_GUARD_MS) return
      deps.storage.setItem(RELOGIN_GUARD_KEY, String(now))
    } catch {
      // úložisko nie je dostupné – presmerujeme bez poistky
    }
    deps.navigate(RELOGIN_PATH)
  }
}

let defaultHandler: (() => void) | undefined
const handleSessionExpired = () => {
  defaultHandler ??= createSessionExpiredHandler({
    navigate: (path) => window.location.assign(path),
    now: () => Date.now(),
    storage: window.sessionStorage,
  })
  defaultHandler()
}

const NETWORK_ERROR_MESSAGE = 'Nepodarilo sa spojiť so serverom. Skontroluj pripojenie.'

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiErrorBody).error?.code === 'string'

async function readJson(res: Response): Promise<unknown> {
  if (!res.headers.get('content-type')?.includes('application/json')) return undefined
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/**
 * Adresa s aktívnou domácnosťou (`?h=`). Je v adrese, nie v hlavičke, lebo service worker kešuje odpovede
 * podľa adresy a dáta dvoch domácností sa nesmú zmiešať. Zoznam domácností sa volá bez nej.
 */
export function withHousehold(path: string, householdId: string | null = activeHouseholdId()): string {
  if (!householdId || path.startsWith('/households')) return path
  return `${path}${path.includes('?') ? '&' : '?'}h=${encodeURIComponent(householdId)}`
}

async function send(path: string, init: RequestInit | undefined, opts: ApiFetchOptions): Promise<Response> {
  const fetchFn = opts.fetchFn ?? fetch
  let res: Response
  try {
    // redirect: 'manual' – presmerovanie Access na prihlásenie (iná doména) by inak fetch zhodil ako výpadok siete.
    res = await fetchFn(`${API_BASE}${withHousehold(path)}`, {
      credentials: 'same-origin',
      redirect: 'manual',
      ...init,
    })
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE)
  }
  if (res.type === 'opaqueredirect') {
    ;(opts.onUnauthorized ?? handleSessionExpired)()
    throw new ApiError(401, 'session_expired', 'Prihlásenie vypršalo, presmerúvam na prihlásenie.')
  }
  if (!res.ok) {
    if (res.status === 401) (opts.onUnauthorized ?? handleSessionExpired)()
    const body = await readJson(res)
    if (isErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.details)
    }
    throw new ApiError(res.status, `http_${res.status}`, `Server vrátil chybu ${res.status}.`)
  }
  return res
}

/** Zavolá API a vráti JSON; každá chyba je `ApiError`. */
export async function apiFetch<T>(path: string, init?: RequestInit, opts: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('accept', 'application/json')
  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const res = await send(path, { ...init, headers }, opts)
  if (res.status === 204) return undefined as T
  const body = await readJson(res)
  if (body === undefined) {
    throw new ApiError(res.status, 'invalid_response', 'Server vrátil neočakávanú odpoveď.')
  }
  return body as T
}

export function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

/** Stiahne súbor z API (napr. export) cez dočasný odkaz. */
export async function downloadFile(
  path: string,
  fallbackName: string,
  opts: ApiFetchOptions = {},
): Promise<void> {
  const res = await send(path, undefined, opts)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
