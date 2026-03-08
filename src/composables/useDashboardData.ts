import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRaidsStore } from '@/stores/raids'
import { useEntriesStore } from '@/stores/entries'
import type { Raid, RaidSignup, Entry, AvailabilityMap } from '@/types'
import { getGermanWeekday, getWeeklyResetWindow } from '@/lib/utils'

export interface MyRaidInfo {
  raid: Raid
  signup: RaidSignup
}

export interface DashboardNotification {
  type: 'confirmed' | 'benched'
  raidInstance: string
  raidDate: string
  raidId: string
  message: string
}

export interface SuggestedRaid {
  raid: Raid
  matchType: 'yes' | 'tentative'
  openSlots: number
}

interface SignupSnapshot {
  raidId: string
  status: string
}

const SNAPSHOT_KEY = 'dashboard-signup-snapshot'

function readSnapshot(): SignupSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SignupSnapshot[]
  } catch {
    return []
  }
}

function writeSnapshot(snaps: SignupSnapshot[]): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps))
}

export function useDashboardData() {
  const authStore = useAuthStore()
  const raidsStore = useRaidsStore()
  const entriesStore = useEntriesStore()

  const myEntries: ComputedRef<Entry[]> = computed(() => {
    if (!authStore.user?.userId) return []
    return entriesStore.entries.filter(e => e.userId === authStore.user!.userId)
  })

  const mySignups = computed(() => {
    if (!authStore.user?.userId) return []
    const uid = authStore.user.userId
    const result: { raid: Raid; signup: RaidSignup }[] = []
    for (const raid of raidsStore.raids) {
      const signup = (raid.signups || []).find(s => s.userId === uid)
      if (signup) result.push({ raid, signup })
    }
    return result
  })

  const myRaidsThisWeek: ComputedRef<MyRaidInfo[]> = computed(() => {
    const { start, end } = getWeeklyResetWindow()
    return mySignups.value
      .filter(({ raid }) => {
        const raidDate = new Date(raid.date + 'T12:00:00')
        return raidDate >= start && raidDate <= end
      })
      .sort((a, b) => a.raid.date.localeCompare(b.raid.date) || a.raid.time.localeCompare(b.raid.time))
  })

  const notifications: ComputedRef<DashboardNotification[]> = computed(() => {
    const oldSnapshot = readSnapshot()
    const oldMap = new Map(oldSnapshot.map(s => [s.raidId, s.status]))
    const notifs: DashboardNotification[] = []

    for (const { raid, signup } of mySignups.value) {
      const oldStatus = oldMap.get(raid.id)
      const curStatus = signup.status

      if (oldStatus === curStatus) continue
      if (oldSnapshot.length === 0) continue

      if (curStatus === 'confirmed') {
        notifs.push({
          type: 'confirmed',
          raidInstance: raid.instance,
          raidDate: raid.date,
          raidId: raid.id,
          message: `Du wurdest für ${raid.instance} (${fmtDate(raid.date)}) bestätigt`,
        })
      } else if (curStatus === 'benched' || curStatus === 'bench') {
        notifs.push({
          type: 'benched',
          raidInstance: raid.instance,
          raidDate: raid.date,
          raidId: raid.id,
          message: `Du wurdest für ${raid.instance} (${fmtDate(raid.date)}) auf die Bank gesetzt`,
        })
      }
    }
    return notifs
  })

  const mergedAvailability = computed<AvailabilityMap>(() => {
    const merged: AvailabilityMap = {}
    for (const entry of myEntries.value) {
      if (!entry.availability) continue
      for (const [key, val] of Object.entries(entry.availability)) {
        if (!merged[key] || (merged[key] === 'tentative' && val === 'yes')) {
          merged[key] = val
        }
      }
    }
    return merged
  })

  const suggestedRaids: ComputedRef<SuggestedRaid[]> = computed(() => {
    if (!authStore.user?.userId || myEntries.value.length === 0) return []

    const uid = authStore.user.userId
    const avail = mergedAvailability.value
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const suggestions: SuggestedRaid[] = []

    for (const raid of raidsStore.raids) {
      if (raid.date < today) continue
      if (raid.locked) continue
      if (raid.deadline && new Date() > new Date(raid.deadline)) continue

      const alreadySignedUp = (raid.signups || []).some(s => s.userId === uid)
      if (alreadySignedUp) continue

      const weekday = getGermanWeekday(raid.date)
      const slotKey = `${weekday}_${raid.time}`
      const matchType = avail[slotKey]
      if (!matchType) continue

      const activeSignups = (raid.signups || []).filter(
        s => s.status !== 'declined' && s.status !== 'benched'
      )
      const openSlots = raid.maxPlayers - activeSignups.length

      suggestions.push({ raid, matchType, openSlots })
    }

    return suggestions.sort(
      (a, b) => a.raid.date.localeCompare(b.raid.date) || a.raid.time.localeCompare(b.raid.time)
    )
  })

  function updateSnapshot(): void {
    const snaps: SignupSnapshot[] = mySignups.value.map(({ raid, signup }) => ({
      raidId: raid.id,
      status: signup.status,
    }))
    writeSnapshot(snaps)
  }

  return {
    myEntries,
    myRaidsThisWeek,
    notifications,
    suggestedRaids,
    updateSnapshot,
  }
}

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}.${m}.${y}`
}
