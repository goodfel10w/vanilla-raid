import { ref } from 'vue'
import type { Entry } from '@/types'
import { api } from '@/lib/api'

export interface KaraGroupPlayer {
  entryId: string
  pinned: boolean
  tankRole?: 'MT' | 'OT'
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

const KARA_DEFAULT_GROUPS = 2
const KARA_MAX_GROUPS = 5
const KARA_MIN_GROUPS = 1

/**
 * EU Raid week starts Wednesday 03:00, ends Tuesday 02:59.
 * Returns the Wednesday start date for a given offset from current week.
 */
export function getIdWeekStart(offset: number): Date {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3, 0, 0)
  const dow = d.getDay()
  const daysSinceWed = (dow + 4) % 7
  d.setDate(d.getDate() - daysSinceWed)
  if (now < d) d.setDate(d.getDate() - 7)
  d.setDate(d.getDate() + offset * 7)
  return d
}

export function getIdWeekEnd(start: Date): Date {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function weekKeyDate(offset: number): string {
  const s = getIdWeekStart(offset)
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
}

function localStorageKey(offset: number): string {
  const s = getIdWeekStart(offset)
  return `kara_eu_${s.getFullYear()}_${String(s.getMonth() + 1).padStart(2, '0')}_${String(s.getDate()).padStart(2, '0')}`
}

function emptyState(groupCount = KARA_DEFAULT_GROUPS): KaraState {
  return {
    groups: Array.from({ length: groupCount }, () => []),
    links: [],
    groupSlots: Array.from({ length: groupCount }, () => ''),
  }
}

export function useKaraPersistence() {
  const weekOffset = ref(0)
  const groups = ref<KaraGroupPlayer[][]>([[], []])
  const links = ref<KaraLink[]>([])
  const groupSlots = ref<string[]>(['', ''])
  const loading = ref(false)
  const saving = ref(false)
  const lastSavedBy = ref('')
  const lastSavedAt = ref('')

  async function save() {
    const week = weekKeyDate(weekOffset.value)
    const data: KaraState = {
      groups: groups.value,
      links: links.value,
      groupSlots: groupSlots.value,
    }
    // Always write to localStorage as fallback
    const lsKey = localStorageKey(weekOffset.value)
    try { localStorage.setItem(lsKey, JSON.stringify(data)) } catch { /* ignore */ }

    // Try API save
    saving.value = true
    try {
      const res = await api.post<{ ok: boolean; updatedBy?: string; updatedAt?: string }>('/api/kara', { week, ...data })
      if (res.updatedBy) lastSavedBy.value = res.updatedBy
      if (res.updatedAt) lastSavedAt.value = res.updatedAt
    } catch {
      // API save failed, localStorage fallback is already written
    } finally {
      saving.value = false
    }
  }

  async function load(entries: Entry[]) {
    const week = weekKeyDate(weekOffset.value)
    const lsKey = localStorageKey(weekOffset.value)
    loading.value = true

    let state: KaraState | null = null

    // Try API first
    try {
      const res = await api.get<{
        groups?: KaraGroupPlayer[][]
        links?: KaraLink[]
        groupSlots?: string[]
        updatedBy?: string
        updatedAt?: string
      }>(`/api/kara?week=${week}`)
      if (res && res.groups && res.groups.length > 0) {
        state = {
          groups: res.groups,
          links: res.links || [],
          groupSlots: res.groupSlots || [],
        }
        if (res.updatedBy) lastSavedBy.value = res.updatedBy
        if (res.updatedAt) lastSavedAt.value = res.updatedAt
      }
    } catch {
      // API unavailable, fall through to localStorage
    }

    // Fallback to localStorage
    if (!state) {
      const raw = localStorage.getItem(lsKey)
      if (raw) {
        try {
          state = JSON.parse(raw) as KaraState
        } catch {
          state = null
        }
      }
      lastSavedBy.value = ''
      lastSavedAt.value = ''
    }

    if (state) {
      groups.value = state.groups || [[], []]
      links.value = state.links || []
      groupSlots.value = state.groupSlots || ['', '']
      // Ensure groups and groupSlots arrays are in sync
      while (groupSlots.value.length < groups.value.length) groupSlots.value.push('')
      while (groupSlots.value.length > groups.value.length) groupSlots.value.pop()
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

    loading.value = false
  }

  async function reset() {
    const count = groups.value.length
    const s = emptyState(count)
    groups.value = s.groups
    links.value = s.links
    groupSlots.value = s.groupSlots
    await save()
  }

  function addGroup() {
    if (groups.value.length >= KARA_MAX_GROUPS) return false
    groups.value.push([])
    groupSlots.value.push('')
    return true
  }

  function removeGroup(gi: number) {
    if (groups.value.length <= KARA_MIN_GROUPS) return false
    if (gi < 0 || gi >= groups.value.length) return false
    // Remove players from links that reference removed group's players
    // (the players go back to pool, links stay)
    groups.value.splice(gi, 1)
    groupSlots.value.splice(gi, 1)
    return true
  }

  return {
    weekOffset,
    groups,
    links,
    groupSlots,
    loading,
    saving,
    lastSavedBy,
    lastSavedAt,
    save,
    load,
    reset,
    addGroup,
    removeGroup,
    getIdWeekStart,
    getIdWeekEnd,
    KARA_MAX_GROUPS,
  }
}
