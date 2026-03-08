import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDashboardData } from '@/composables/useDashboardData'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import type { Entry, Raid, RaidSignup } from '@/types'
import { getWeeklyResetWindow, getGermanWeekday } from '@/lib/utils'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '1',
    charName: 'Testchar',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function makeSignup(overrides: Partial<RaidSignup> = {}): RaidSignup {
  return {
    entryId: 'e1',
    charName: 'Testchar',
    className: 'Krieger',
    spec: 'Prot',
    role: 'Tank',
    status: 'accepted',
    userId: 'user1',
    ...overrides,
  }
}

function makeRaid(overrides: Partial<Raid> = {}): Raid {
  return {
    id: 'r1',
    instance: 'Karazhan',
    date: '2026-03-06',
    time: '20:00',
    maxPlayers: 10,
    locked: false,
    notes: '',
    description: '',
    signups: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('myEntries', () => {
    it('returns entries belonging to the logged-in user', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()
      entries.entries = [
        makeEntry({ id: '1', userId: 'user1' }),
        makeEntry({ id: '2', userId: 'user2' }),
        makeEntry({ id: '3', userId: 'user1', charName: 'Alt' }),
      ]

      const { myEntries } = useDashboardData()
      expect(myEntries.value).toHaveLength(2)
      expect(myEntries.value.map(e => e.id)).toEqual(['1', '3'])
    })

    it('returns empty when not logged in', () => {
      const { myEntries } = useDashboardData()
      expect(myEntries.value).toHaveLength(0)
    })
  })

  describe('myRaidsThisWeek', () => {
    it('returns raids in the current reset window where user has a signup', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()

      const { start, end } = getWeeklyResetWindow()
      const inWindowDate = new Date(start)
      inWindowDate.setDate(inWindowDate.getDate() + 1)
      const inWindowStr = inWindowDate.toISOString().slice(0, 10)

      const outOfWindowDate = new Date(start)
      outOfWindowDate.setDate(outOfWindowDate.getDate() - 3)
      const outStr = outOfWindowDate.toISOString().slice(0, 10)

      raids.raids = [
        makeRaid({
          id: 'r1',
          date: inWindowStr,
          signups: [makeSignup({ userId: 'user1' })],
        }),
        makeRaid({
          id: 'r2',
          date: outStr,
          signups: [makeSignup({ userId: 'user1' })],
        }),
        makeRaid({
          id: 'r3',
          date: inWindowStr,
          signups: [makeSignup({ userId: 'user2' })],
        }),
      ]

      const { myRaidsThisWeek } = useDashboardData()
      expect(myRaidsThisWeek.value).toHaveLength(1)
      expect(myRaidsThisWeek.value[0].raid.id).toBe('r1')
    })
  })

  describe('notifications', () => {
    it('returns empty when no snapshot exists', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          signups: [makeSignup({ userId: 'user1', status: 'confirmed' })],
        }),
      ]

      const { notifications } = useDashboardData()
      expect(notifications.value).toHaveLength(0)
    })

    it('detects when user is confirmed since last snapshot', () => {
      localStorage.setItem(
        'dashboard-signup-snapshot',
        JSON.stringify([{ raidId: 'r1', status: 'accepted' }])
      )

      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          signups: [makeSignup({ userId: 'user1', status: 'confirmed' })],
        }),
      ]

      const { notifications } = useDashboardData()
      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('confirmed')
      expect(notifications.value[0].message).toContain('bestätigt')
    })

    it('detects when user is benched since last snapshot', () => {
      localStorage.setItem(
        'dashboard-signup-snapshot',
        JSON.stringify([{ raidId: 'r1', status: 'accepted' }])
      )

      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          signups: [makeSignup({ userId: 'user1', status: 'benched' })],
        }),
      ]

      const { notifications } = useDashboardData()
      expect(notifications.value).toHaveLength(1)
      expect(notifications.value[0].type).toBe('benched')
      expect(notifications.value[0].message).toContain('Bank')
    })

    it('does not notify when status unchanged', () => {
      localStorage.setItem(
        'dashboard-signup-snapshot',
        JSON.stringify([{ raidId: 'r1', status: 'confirmed' }])
      )

      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          signups: [makeSignup({ userId: 'user1', status: 'confirmed' })],
        }),
      ]

      const { notifications } = useDashboardData()
      expect(notifications.value).toHaveLength(0)
    })
  })

  describe('suggestedRaids', () => {
    it('suggests raids matching user availability', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()

      // Use a future date to ensure it passes the date filter
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)
      const futureDateStr = futureDate.toISOString().slice(0, 10)
      const weekday = getGermanWeekday(futureDateStr)

      entries.entries = [
        makeEntry({
          id: '1',
          userId: 'user1',
          availability: { [`${weekday}_20:00`]: 'yes' },
        }),
      ]

      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          date: futureDateStr,
          time: '20:00',
          signups: [],
        }),
      ]

      const { suggestedRaids } = useDashboardData()
      expect(suggestedRaids.value).toHaveLength(1)
      expect(suggestedRaids.value[0].raid.id).toBe('r1')
      expect(suggestedRaids.value[0].matchType).toBe('yes')
    })

    it('excludes raids where user is already signed up', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)
      const futureDateStr = futureDate.toISOString().slice(0, 10)
      const weekday = getGermanWeekday(futureDateStr)

      entries.entries = [
        makeEntry({
          id: '1',
          userId: 'user1',
          availability: { [`${weekday}_20:00`]: 'yes' },
        }),
      ]

      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          date: futureDateStr,
          time: '20:00',
          signups: [makeSignup({ userId: 'user1' })],
        }),
      ]

      const { suggestedRaids } = useDashboardData()
      expect(suggestedRaids.value).toHaveLength(0)
    })

    it('excludes locked raids', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)
      const futureDateStr = futureDate.toISOString().slice(0, 10)
      const weekday = getGermanWeekday(futureDateStr)

      entries.entries = [
        makeEntry({
          id: '1',
          userId: 'user1',
          availability: { [`${weekday}_20:00`]: 'yes' },
        }),
      ]

      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          date: futureDateStr,
          time: '20:00',
          locked: true,
          signups: [],
        }),
      ]

      const { suggestedRaids } = useDashboardData()
      expect(suggestedRaids.value).toHaveLength(0)
    })

    it('excludes raids with no availability match', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)
      const futureDateStr = futureDate.toISOString().slice(0, 10)

      entries.entries = [
        makeEntry({
          id: '1',
          userId: 'user1',
          availability: { 'Montag_14:00': 'yes' }, // different day/time
        }),
      ]

      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          date: futureDateStr,
          time: '20:00',
          signups: [],
        }),
      ]

      const { suggestedRaids } = useDashboardData()
      // Should only match if the weekday+time matches, which it won't unless futureDate is a Monday at 14:00
      // This test verifies filtering works
      const weekday = getGermanWeekday(futureDateStr)
      if (weekday !== 'Montag') {
        expect(suggestedRaids.value).toHaveLength(0)
      }
    })

    it('calculates open slots correctly', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const entries = useEntriesStore()

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)
      const futureDateStr = futureDate.toISOString().slice(0, 10)
      const weekday = getGermanWeekday(futureDateStr)

      entries.entries = [
        makeEntry({
          id: '1',
          userId: 'user1',
          availability: { [`${weekday}_20:00`]: 'yes' },
        }),
      ]

      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          date: futureDateStr,
          time: '20:00',
          maxPlayers: 10,
          signups: [
            makeSignup({ userId: 'user2', entryId: 'e2' }),
            makeSignup({ userId: 'user3', entryId: 'e3', status: 'declined' }),
          ],
        }),
      ]

      const { suggestedRaids } = useDashboardData()
      expect(suggestedRaids.value).toHaveLength(1)
      // 10 max - 1 active (declined doesn't count) = 9
      expect(suggestedRaids.value[0].openSlots).toBe(9)
    })
  })

  describe('updateSnapshot', () => {
    it('writes current signup statuses to localStorage', () => {
      const auth = useAuthStore()
      auth.user = { token: 't', username: 'u', userId: 'user1' }
      const raids = useRaidsStore()
      raids.raids = [
        makeRaid({
          id: 'r1',
          signups: [makeSignup({ userId: 'user1', status: 'confirmed' })],
        }),
        makeRaid({
          id: 'r2',
          signups: [makeSignup({ userId: 'user1', status: 'accepted' })],
        }),
      ]

      const { updateSnapshot } = useDashboardData()
      updateSnapshot()

      const stored = JSON.parse(localStorage.getItem('dashboard-signup-snapshot') || '[]')
      expect(stored).toHaveLength(2)
      expect(stored).toContainEqual({ raidId: 'r1', status: 'confirmed' })
      expect(stored).toContainEqual({ raidId: 'r2', status: 'accepted' })
    })
  })
})
