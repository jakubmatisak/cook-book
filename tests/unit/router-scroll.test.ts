import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { scrollOnNavigate } from '@/router/scroll'

const route = (path: string) => ({ path }) as RouteLocationNormalized

describe('scrollOnNavigate', () => {
  it('pri zmene len query parametrov (filter, porcie) nechá stránku na mieste', () => {
    expect(scrollOnNavigate(route('/recipes/1'), route('/recipes/1'), null)).toBe(false)
  })

  it('pri novej stránke ide na začiatok', () => {
    expect(scrollOnNavigate(route('/recipes/2'), route('/recipes/1'), null)).toEqual({ top: 0 })
  })

  it('pri návrate späť obnoví uloženú polohu', () => {
    const saved = { left: 0, top: 480 }
    expect(scrollOnNavigate(route('/recipes'), route('/recipes/1'), saved)).toBe(saved)
  })
})
