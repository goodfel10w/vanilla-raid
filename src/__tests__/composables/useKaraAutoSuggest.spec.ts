import { describe, it, expect } from 'vitest'
import {
  karaSuggestSlots,
  karaAutoPickSlots,
  karaAutoGenerate,
  karaGroupRoles,
  parseSlotKey,
  karaPlayersForSlotKey,
  KARA_TANKS,
  KARA_HEALERS,
  KARA_DPS,
} from '@/composables/useKaraAutoSuggest'
import type { Entry } from '@/types'

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

function makeAvailability(day: string, startH: number, hours: number): Record<string, 'yes' | 'tentative'> {
  const avail: Record<string, 'yes' | 'tentative'> = {}
  for (let h = startH; h < startH + hours; h++) {
    for (const m of [0, 15, 30, 45]) {
      avail[`${day}_${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`] = 'yes'
    }
  }
  return avail
}

describe('useKaraAutoSuggest', () => {
  describe('parseSlotKey', () => {
    it('parses a valid slot key', () => {
      const result = parseSlotKey('Mittwoch_20:00\u201323:00')
      expect(result).toEqual({ day: 'Mittwoch', windowLabel: '20:00\u201323:00' })
    })

    it('returns null for empty string', () => {
      expect(parseSlotKey('')).toBeNull()
    })

    it('returns null for invalid key', () => {
      expect(parseSlotKey('invalid')).toBeNull()
    })
  })

  describe('karaGroupRoles', () => {
    it('counts roles correctly', () => {
      const entries: Entry[] = [
        makeEntry({ id: '1', roles: ['Tank'] }),
        makeEntry({ id: '2', roles: ['Heiler'], className: 'Priester' }),
        makeEntry({ id: '3', roles: ['DPS'], className: 'Magier' }),
        makeEntry({ id: '4', roles: ['DPS'], className: 'Hexenmeister' }),
      ]
      const group = [
        { entryId: '1', pinned: false },
        { entryId: '2', pinned: false },
        { entryId: '3', pinned: false },
        { entryId: '4', pinned: false },
      ]
      const roles = karaGroupRoles(group, entries)
      // Tank without tankRole assignment doesn't count as mt or ot
      expect(roles.mt).toBe(0)
      expect(roles.ot).toBe(0)
      expect(roles.hl).toBe(1)
      expect(roles.dp).toBe(2)
    })

    it('returns zeros for empty group', () => {
      const roles = karaGroupRoles([], [])
      expect(roles.mt).toBe(0)
      expect(roles.ot).toBe(0)
      expect(roles.hl).toBe(0)
      expect(roles.dp).toBe(0)
    })
  })

  describe('karaSuggestSlots', () => {
    it('returns suggestions sorted by score', () => {
      const entries: Entry[] = []
      // Create 10 players available on Wednesday 20:00-23:00
      for (let i = 0; i < 10; i++) {
        const roles: string[] = i < 2 ? ['Tank'] : i < 4 ? ['Heiler'] : ['DPS']
        const cls = i < 2 ? 'Krieger' : i < 4 ? 'Priester' : 'Magier'
        entries.push(makeEntry({
          id: String(i),
          charName: `Player${i}`,
          className: cls as any,
          roles: roles as any[],
          availability: makeAvailability('Mittwoch', 20, 3),
        }))
      }

      const suggestions = karaSuggestSlots(entries)
      expect(suggestions.length).toBeGreaterThan(0)

      // The Mittwoch 20:00 slot should be among the top
      const wednesdaySlot = suggestions.find(s => s.day === 'Mittwoch' && s.startH === 20)
      expect(wednesdaySlot).toBeDefined()
      expect(wednesdaySlot!.total).toBe(10)
      expect(wednesdaySlot!.tanks).toBe(2)
      expect(wednesdaySlot!.healers).toBe(2)
      expect(wednesdaySlot!.dps).toBe(6)
    })

    it('excludes specified player IDs', () => {
      const entries: Entry[] = [
        makeEntry({ id: '1', charName: 'Player1', availability: makeAvailability('Montag', 20, 3) }),
        makeEntry({ id: '2', charName: 'Player2', availability: makeAvailability('Montag', 20, 3) }),
      ]

      const withExclude = karaSuggestSlots(entries, new Set(['1']))
      const mondaySlot = withExclude.find(s => s.day === 'Montag' && s.startH === 20)
      expect(mondaySlot!.total).toBe(1)
    })
  })

  describe('karaAutoGenerate', () => {
    it('distributes players across groups', () => {
      const entries: Entry[] = []
      for (let i = 0; i < 15; i++) {
        const roles: string[] = i < 3 ? ['Tank'] : i < 6 ? ['Heiler'] : ['DPS']
        const cls = i < 3 ? 'Krieger' : i < 6 ? 'Priester' : 'Magier'
        entries.push(makeEntry({
          id: String(i),
          charName: `Player${i}`,
          className: cls as any,
          roles: roles as any[],
        }))
      }

      const result = karaAutoGenerate(
        entries,
        [[], [], []],
        [],
        ['', '', ''],
        '',
        '',
      )

      const totalPlaced = result.groups.reduce((s, g) => s + g.length, 0)
      expect(totalPlaced).toBe(15)
      // Each group should have some players
      result.groups.forEach(g => {
        expect(g.length).toBeGreaterThan(0)
      })
    })

    it('respects pinned players', () => {
      const entries: Entry[] = [
        makeEntry({ id: '1', charName: 'PinnedTank', roles: ['Tank'] }),
        makeEntry({ id: '2', charName: 'Player2', roles: ['DPS'], className: 'Magier' }),
        makeEntry({ id: '3', charName: 'Player3', roles: ['DPS'], className: 'Hexenmeister' }),
      ]

      const result = karaAutoGenerate(
        entries,
        [[{ entryId: '1', pinned: true }], [], []],
        [],
        ['', '', ''],
        '',
        '',
      )

      // Pinned player should still be in group 0
      expect(result.groups[0].some(p => p.entryId === '1' && p.pinned)).toBe(true)
    })

    it('returns a message', () => {
      const result = karaAutoGenerate([], [[], [], []], [], ['', '', ''], '', '')
      expect(result.message).toBe('Gruppen automatisch verteilt')
    })
  })

  describe('karaPlayersForSlotKey', () => {
    it('returns players available in the slot window', () => {
      const entries: Entry[] = [
        makeEntry({ id: '1', availability: makeAvailability('Mittwoch', 20, 3) }),
        makeEntry({ id: '2', availability: makeAvailability('Mittwoch', 18, 3) }),
      ]
      const players = karaPlayersForSlotKey(entries, 'Mittwoch_20:00\u201323:00')
      expect(players.length).toBe(1)
      expect(players[0].id).toBe('1')
    })
  })
})
