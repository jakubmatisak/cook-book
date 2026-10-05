import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from '@/composables/useThemePreference'

describe('resolveTheme', () => {
  it('systém sleduje nastavenie zariadenia, ostatné je pevné', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('parseThemePreference', () => {
  it('neplatná alebo chýbajúca hodnota znamená systém', () => {
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference('modra')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
  })
})
