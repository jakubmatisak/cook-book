import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import type { ApiErrorBody } from '../shared/api'

/** Očakávaná chyba API s HTTP stavom a strojovo čitateľným kódom. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: string
  readonly details?: unknown

  constructor(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const body = (code: string, message: string, details?: unknown): ApiErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
})

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof HttpError) return c.json(body(err.code, err.message, err.details), err.status)
  if (err instanceof ZodError) return c.json(body('validation_error', 'Neplatné údaje.', err.issues), 400)
  if (err instanceof HTTPException) {
    return c.json(body('http_error', err.message || 'Chyba požiadavky.'), err.status as ContentfulStatusCode)
  }
  console.error('Neočakávaná chyba API', err)
  return c.json(body('internal_error', 'Nastala neočakávaná chyba.'), 500)
}

export const notFound: NotFoundHandler = (c) => c.json(body('not_found', 'Nenájdené.'), 404)
