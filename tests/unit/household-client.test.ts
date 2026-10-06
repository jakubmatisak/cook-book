import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/api/http'
import {
  activeHouseholdId,
  clearActiveHousehold,
  lastHouseholdId,
  resolveHousehold,
  setActiveHousehold,
} from '@/lib/household'
import { queueKey } from '@/features/shopping/offlineQueue'

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

const homes = (...ids: string[]) => ids.map((id) => ({ id, name: id, role: 'owner' as const }))

describe('resolveHousehold', () => {
  it('jedna domácnosť sa zvolí sama, bez výberu', () => {
    expect(resolveHousehold(homes('a'), null, null)).toEqual({ kind: 'ready', id: 'a' })
  })

  it('viac domácností bez zvolenej žiada výber a ponúkne naposledy použitú', () => {
    expect(resolveHousehold(homes('a', 'b'), null, 'b')).toEqual({ kind: 'pick', preferred: 'b' })
    expect(resolveHousehold(homes('a', 'b'), null, 'neexistuje')).toEqual({ kind: 'pick', preferred: null })
  })

  it('platná zvolená domácnosť (v tomto okne) sa použije', () => {
    expect(resolveHousehold(homes('a', 'b'), 'b', 'a')).toEqual({ kind: 'ready', id: 'b' })
  })

  it('zvolená domácnosť, ktorej už nie je členom, sa ignoruje', () => {
    expect(resolveHousehold(homes('a', 'b'), 'x', null)).toEqual({ kind: 'pick', preferred: null })
    expect(resolveHousehold(homes('a'), 'x', null)).toEqual({ kind: 'ready', id: 'a' })
  })

  it('bez domácností nie je čo zvoliť', () => {
    expect(resolveHousehold([], null, null)).toEqual({ kind: 'none' })
  })
})

describe('aktívna domácnosť v prehliadači', () => {
  it('drží sa v sessionStorage (okno) a ako naposledy použitá aj v localStorage', () => {
    expect(activeHouseholdId()).toBeNull()
    setActiveHousehold('a')
    expect(activeHouseholdId()).toBe('a')
    expect(lastHouseholdId()).toBe('a')
    clearActiveHousehold()
    expect(activeHouseholdId()).toBeNull()
    expect(lastHouseholdId()).toBe('a')
  })
})

describe('apiFetch s aktívnou domácnosťou', () => {
  it('pridá h do adresy a zachová ostatné parametre', async () => {
    setActiveHousehold('dom 1')
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(json({})))
    await apiFetch('/me', undefined, { fetchFn })
    await apiFetch('/recipes?q=gulas', undefined, { fetchFn })
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/me?h=dom%201')
    expect(fetchFn.mock.calls[1]![0]).toBe('/api/v1/recipes?q=gulas&h=dom%201')
  })

  it('bez zvolenej domácnosti h nepridá', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(json({})))
    await apiFetch('/me', undefined, { fetchFn })
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/me')
  })

  it('zoznam domácností sa volá bez h (zvolená už nemusí platiť)', async () => {
    setActiveHousehold('stara')
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(json([])))
    await apiFetch('/households', undefined, { fetchFn })
    expect(fetchFn.mock.calls[0]![0]).toBe('/api/v1/households')
  })
})

describe('fronta odškrtávania nákupu', () => {
  it('každá domácnosť má vlastný kľúč, aby sa zmeny nedostali do inej domácnosti', () => {
    expect(queueKey('a')).not.toBe(queueKey('b'))
    expect(queueKey('a')).toContain('a')
    expect(queueKey(null)).toBe('kniha:shopping-queue')
  })
})
