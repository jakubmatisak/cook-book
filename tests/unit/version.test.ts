import { describe, expect, it } from 'vitest'
import { APP_VERSION_LABEL, formatAppVersion } from '@/lib/version'

describe('formatAppVersion', () => {
  it('pripojí k verzii štádium', () => {
    expect(formatAppVersion('0.1.0', 'beta')).toBe('0.1.0 beta')
    expect(formatAppVersion('1.2.3', '')).toBe('1.2.3')
  })

  it('verzia aplikácie je z package.json a stabilná verzia nemá štádium', () => {
    expect(APP_VERSION_LABEL).toBe('1.4.6')
  })
})
