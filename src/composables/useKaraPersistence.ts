import { ref } from 'vue'
import type { Entry } from '@/types'

export interface KaraGroupPlayer {
  entryId: string
  pinned: boolean
}

export interface KaraLink {
  ids: string[]
  color: string
}

export interface KaraState {
  groups: KaraGroupPlayer[][]
  links: KaraLink[]
  groupSlots: string[]
}

const KARA_GROUPS_COUNT = 3

/**
 * ID-Week starts Tuesday 03:00, ends Monday 02:59.
 * Returns the Tuesday start date for a given offset from current week.
 */
export function getIdWeekStart(offset: number): Date {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0)
  const dow = d.getDay()
  const daysSinceTue = (dow + 5) % 7
  d.setDate(d.getDate() - daysSinceTue)
  if (now < d) d.setDate(d.getDate() - 7)
  d.setDate(d.getDate() + offset * 7)
  return d
}

export function getIdWeekEnd(start: Date): Date {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function karaWeekKey(offset: number): string {
  const s = getIdWeekStart(offset)
  return `kara_${s.getFullYear()}_${String(s.getMonth() + 1).padStart(2, '0')}_${String(s.getDate()).padStart(2, '0')}`
}

function emptyState(): KaraState {
  return {
    groups: [[], [], []],
    links: [],
    groupSlots: ['', '', ''],
  }
}

export function useKaraPersistence() {
  const weekOffset = ref(0)
  const groups = ref<KaraGroupPlayer[][]>([[], [], []])
  const links = ref<KaraLink[]>([])
  const groupSlots = ref<string[]>(['', '', ''])

  function save() {
    const key = karaWeekKey(weekOffset.value)
    const data: KaraState = {
      groups: groups.value,
      links: links.value,
      groupSlots: groupSlots.value,
    }
    localStorage.setItem(key, JSON.stringify(data))
  }

  function load(entries: Entry[]) {
    const key = karaWeekKey(weekOffset.value)
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const data = JSON.parse(raw) as KaraState
        groups.value = data.groups || [[], [], []]
        links.value = data.links || []
        groupSlots.value = data.groupSlots || ['', '', '']
        while (groups.value.length < KARA_GROUPS_COUNT) groups.value.push([])
        while (groupSlots.value.length < KARA_GROUPS_COUNT) groupSlots.value.push('')
      } catch {
        const s = emptyState()
        groups.value = s.groups
        links.value = s.links
        groupSlots.value = s.groupSlots
      }
    } else {
      const s = emptyState()
      groups.value = s.groups
      links.value = s.links
      groupSlots.value = s.groupSlots
    }
    // Prune entries that no longer exist
    const validIds = new Set(entries.map(e => e.id))
    groups.value.forEach((g, gi) => {
      groups.value[gi] = g.filter(p => validIds.has(p.entryId))
    })
    links.value = links.value.filter(lk => lk.ids.every(id => validIds.has(id)))
  }

  function reset() {
    const s = emptyState()
    groups.value = s.groups
    links.value = s.links
    groupSlots.value = s.groupSlots
    save()
  }

  return {
    weekOffset,
    groups,
    links,
    groupSlots,
    save,
    load,
    reset,
    getIdWeekStart,
    getIdWeekEnd,
  }
}
