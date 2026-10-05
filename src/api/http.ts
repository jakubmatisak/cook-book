import type { ApiErrorBody } from '@shared/api'

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
  /** Volá sa pri 401; predvolene obnoví stránku a Cloudflare Access potom presmeruje na prihlásenie. */
  onUnauthorized?: () => void
}

const reloadToLogin = () => window.location.reload()

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

async function send(path: string, init: RequestInit | undefined, opts: ApiFetchOptions): Promise<Response> {
  const fetchFn = opts.fetchFn ?? fetch
  let res: Response
  try {
    res = await fetchFn(`${API_BASE}${path}`, { credentials: 'same-origin', ...init })
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) {
    if (res.status === 401) (opts.onUnauthorized ?? reloadToLogin)()
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
