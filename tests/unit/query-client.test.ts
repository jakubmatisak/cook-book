import { describe, expect, it } from 'vitest'
import { createQueryClient } from '@/plugins/query'

describe('createQueryClient', () => {
  it('načítava aj bez signálu (service worker má cache), neopakuje chyby 4xx', () => {
    const defaults = createQueryClient().getDefaultOptions().queries!
    expect(defaults.networkMode).toBe('offlineFirst')
    const retry = defaults.retry as (count: number, error: unknown) => boolean
    expect(retry(0, Object.assign(new Error('x'), { status: 404 }))).toBe(false)
  })
})
