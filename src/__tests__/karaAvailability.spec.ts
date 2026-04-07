import { describe, it, expect } from 'vitest'
import { resolveKaraAvailability, buildKaraAvailabilityMap } from '@/lib/karaAvailability'
import type { Entry, KaraSignup, AvailabilityMap } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '1',
    charName: 'Test',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function makeSignup(overrides: Partial<KaraSignup> = {}): KaraSignup {
  return {
    entryId: '1',
    userId: 'u1',
    charName: 'Test',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    days: ['Montag'],
    useCustomTimes: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function makeAvail(day: string, startH: number, hours: number, value: 'yes' | 'tentative' = 'yes'): AvailabilityMap {
  const avail: AvailabilityMap = {}
  for (let h = startH; h < startH + hours; h++) {
    for (const m of [0, 15, 30, 45]) {
      avail[`${day}_${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`] = value
    }
  }
  return avail
}

describe('resolveKaraAvailability', () => {
  it('returns entry availability when no signup', () => {
    const avail = { 'Montag_20:00': 'yes' as const, 'Dienstag_20:00': 'yes' as const }
    const entry = makeEntry({ availability: avail })
    const result = resolveKaraAvailability(entry, undefined)
    expect(result).toEqual(avail)
  })

  it('filters entry availability to signup days when useCustomTimes is false', () => {
    const avail = {
      ...makeAvail('Montag', 20, 1),
      ...makeAvail('Dienstag', 20, 1),
      ...makeAvail('Mittwoch', 20, 1),
    }
    const entry = makeEntry({ availability: avail })
    const signup = makeSignup({ days: ['Montag', 'Mittwoch'] })

    const result = resolveKaraAvailability(entry, signup)

    // Should only contain Montag and Mittwoch keys
    const days = new Set(Object.keys(result).map(k => k.split('_')[0]))
    expect(days).toEqual(new Set(['Montag', 'Mittwoch']))
    expect(Object.keys(result).some(k => k.startsWith('Dienstag'))).toBe(false)
  })

  it('uses customSlots when useCustomTimes is true', () => {
    const entryAvail = makeAvail('Montag', 20, 3) // general: 20-23
    const customSlots = makeAvail('Montag', 19, 2) // custom: 19-21
    const entry = makeEntry({ availability: entryAvail })
    const signup = makeSignup({
      days: ['Montag'],
      useCustomTimes: true,
      customSlots,
    })

    const result = resolveKaraAvailability(entry, signup)

    expect(result).toEqual(customSlots)
    // Should NOT contain 22:00 from entry availability
    expect(result['Montag_22:00']).toBeUndefined()
    // Should contain 19:00 from custom slots
    expect(result['Montag_19:00']).toBe('yes')
  })

  it('filters customSlots to signup days only', () => {
    const customSlots = {
      ...makeAvail('Montag', 20, 1),
      ...makeAvail('Dienstag', 20, 1), // shouldn't happen in practice but test it
    }
    const entry = makeEntry()
    const signup = makeSignup({
      days: ['Montag'],
      useCustomTimes: true,
      customSlots,
    })

    const result = resolveKaraAvailability(entry, signup)
    expect(Object.keys(result).every(k => k.startsWith('Montag'))).toBe(true)
  })

  it('synthesizes full availability when signup day has no matching slots', () => {
    const avail = makeAvail('Dienstag', 20, 1) // only Dienstag
    const entry = makeEntry({ availability: avail })
    const signup = makeSignup({ days: ['Montag'] }) // signed up for Montag

    const result = resolveKaraAvailability(entry, signup)
    // Montag should get synthetic "yes" for all 48 slots (12:00-23:45)
    const montagKeys = Object.keys(result).filter(k => k.startsWith('Montag_'))
    expect(montagKeys).toHaveLength(48)
    expect(montagKeys.every(k => result[k] === 'yes')).toBe(true)
  })

  it('synthesizes availability for empty entry availability', () => {
    const entry = makeEntry({ availability: {} })
    const signup = makeSignup({ days: ['Montag'] })
    const result = resolveKaraAvailability(entry, signup)
    // Should synthesize full availability for Montag
    const montagKeys = Object.keys(result).filter(k => k.startsWith('Montag_'))
    expect(montagKeys).toHaveLength(48)
    expect(montagKeys.every(k => result[k] === 'yes')).toBe(true)
  })

  it('synthesizes only for days with no slots, keeps existing slots', () => {
    const avail = makeAvail('Montag', 20, 1) // Montag 20:00-20:45
    const entry = makeEntry({ availability: avail })
    const signup = makeSignup({ days: ['Montag', 'Mittwoch'] })

    const result = resolveKaraAvailability(entry, signup)
    // Montag should keep original 4 slots (not synthesized)
    const montagKeys = Object.keys(result).filter(k => k.startsWith('Montag_'))
    expect(montagKeys).toHaveLength(4)
    expect(result['Montag_20:00']).toBe('yes')
    // Mittwoch should get 48 synthetic slots
    const mittwochKeys = Object.keys(result).filter(k => k.startsWith('Mittwoch_'))
    expect(mittwochKeys).toHaveLength(48)
  })

  it('does not synthesize when useCustomTimes is true', () => {
    const entry = makeEntry({ availability: {} })
    const signup = makeSignup({ days: ['Montag'], useCustomTimes: true, customSlots: {} })
    const result = resolveKaraAvailability(entry, signup)
    expect(Object.keys(result)).toHaveLength(0)
  })
})

describe('buildKaraAvailabilityMap', () => {
  it('builds map for entries with and without signups', () => {
    const entry1 = makeEntry({
      id: 'e1',
      availability: { ...makeAvail('Montag', 20, 1), ...makeAvail('Dienstag', 20, 1) },
    })
    const entry2 = makeEntry({
      id: 'e2',
      availability: makeAvail('Mittwoch', 20, 1),
    })
    const signupMap = new Map<string, KaraSignup>()
    signupMap.set('e1', makeSignup({ entryId: 'e1', days: ['Montag'] }))
    // e2 has no signup

    const result = buildKaraAvailabilityMap([entry1, entry2], signupMap)

    // e1: filtered to Montag only
    const e1Avail = result.get('e1')!
    expect(Object.keys(e1Avail).every(k => k.startsWith('Montag'))).toBe(true)

    // e2: full availability (no signup)
    const e2Avail = result.get('e2')!
    expect(e2Avail).toEqual(entry2.availability)
  })
})
