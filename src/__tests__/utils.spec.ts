import { describe, it, expect } from 'vitest'
import { h, cc, specsToRoles, collapseRanges, migrateLegacyAvail, linkItems, formatDate, timeAgo, addMins, hourQuarters } from '@/lib/utils'

describe('h() - HTML escape', () => {
  it('escapes HTML special characters', () => {
    expect(h('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })
  it('escapes ampersands', () => {
    expect(h('a & b')).toBe('a &amp; b')
  })
  it('escapes single quotes', () => {
    expect(h("it's")).toBe("it&#39;s")
  })
  it('handles null/undefined', () => {
    expect(h(null)).toBe('')
    expect(h(undefined)).toBe('')
  })
  it('converts numbers to string', () => {
    expect(h(42)).toBe('42')
  })
})

describe('cc() - class color', () => {
  it('returns Krieger color', () => {
    expect(cc('Krieger')).toBe('#C69B6D')
  })
  it('returns Magier color', () => {
    expect(cc('Magier')).toBe('#3FC7EB')
  })
  it('returns fallback for unknown', () => {
    expect(cc('Unknown')).toBe('#ccc')
  })
})

describe('specsToRoles()', () => {
  it('returns Tank for Krieger Prot', () => {
    expect(specsToRoles('Krieger', ['Prot'])).toEqual(['Tank'])
  })
  it('returns Tank and DPS for Krieger Prot + Fury', () => {
    const roles = specsToRoles('Krieger', ['Prot', 'Fury'])
    expect(roles).toContain('Tank')
    expect(roles).toContain('DPS')
  })
  it('returns Heiler for Priester Holy', () => {
    expect(specsToRoles('Priester', ['Holy'])).toEqual(['Heiler'])
  })
  it('returns empty for unknown class', () => {
    expect(specsToRoles('Unknown', ['Test'])).toEqual([])
  })
  it('maintains role order: Tank, Heiler, DPS', () => {
    const roles = specsToRoles('Paladin', ['Retri', 'Holy', 'Prot'])
    expect(roles).toEqual(['Tank', 'Heiler', 'DPS'])
  })
})

describe('addMins()', () => {
  it('adds minutes to time', () => {
    expect(addMins('14:00', 15)).toBe('14:15')
    expect(addMins('14:45', 15)).toBe('15:00')
    expect(addMins('23:45', 15)).toBe('00:00')
  })
})

describe('hourQuarters()', () => {
  it('returns 4 quarter-hour slots', () => {
    expect(hourQuarters('14')).toEqual(['14:00', '14:15', '14:30', '14:45'])
  })
})

describe('collapseRanges()', () => {
  it('collapses consecutive yes slots', () => {
    const avail = {
      'Montag_14:00': 'yes' as const,
      'Montag_14:15': 'yes' as const,
      'Montag_14:30': 'yes' as const,
      'Montag_14:45': 'yes' as const,
    }
    const ranges = collapseRanges(avail, 'Montag')
    expect(ranges).toHaveLength(1)
    expect(ranges[0]).toEqual({ start: '14:00', end: '15:00', type: 'yes' })
  })

  it('splits on type change', () => {
    const avail = {
      'Montag_14:00': 'yes' as const,
      'Montag_14:15': 'yes' as const,
      'Montag_14:30': 'tentative' as const,
      'Montag_14:45': 'tentative' as const,
    }
    const ranges = collapseRanges(avail, 'Montag')
    expect(ranges).toHaveLength(2)
    expect(ranges[0].type).toBe('yes')
    expect(ranges[1].type).toBe('tentative')
  })

  it('returns empty for no availability', () => {
    expect(collapseRanges({}, 'Montag')).toEqual([])
  })
})

describe('migrateLegacyAvail()', () => {
  it('converts true to yes', () => {
    const result = migrateLegacyAvail({ 'Montag_14:00': true })
    expect(result['Montag_14:00']).toBe('yes')
  })

  it('keeps yes/tentative as-is', () => {
    const result = migrateLegacyAvail({ 'Montag_14:00': 'yes', 'Montag_14:15': 'tentative' })
    expect(result['Montag_14:00']).toBe('yes')
    expect(result['Montag_14:15']).toBe('tentative')
  })

  it('expands range keys to 15-min slots', () => {
    const result = migrateLegacyAvail({ 'Montag_14:00\u201316:00': 'yes' })
    expect(result['Montag_14:00']).toBe('yes')
    expect(result['Montag_14:15']).toBe('yes')
    expect(result['Montag_15:45']).toBe('yes')
    expect(result['Montag_16:00']).toBeUndefined()
  })

  it('handles null/undefined', () => {
    expect(migrateLegacyAvail(null as any)).toEqual({})
    expect(migrateLegacyAvail(undefined as any)).toEqual({})
  })
})

describe('linkItems()', () => {
  it('converts [Item] to Wowhead link', () => {
    const result = linkItems('[Thunderfury]')
    expect(result).toContain('wowhead.com/tbc/search')
    expect(result).toContain('Thunderfury')
    expect(result).toContain('target="_blank"')
  })
  it('handles empty string', () => {
    expect(linkItems('')).toBe('')
  })
  it('escapes HTML in non-item text', () => {
    const result = linkItems('<b>test</b>')
    expect(result).toContain('&lt;b&gt;')
  })
})

describe('timeAgo()', () => {
  it('returns "gerade eben" for recent', () => {
    expect(timeAgo(new Date().toISOString())).toBe('gerade eben')
  })
  it('handles empty string', () => {
    expect(timeAgo('')).toBe('')
  })
})
