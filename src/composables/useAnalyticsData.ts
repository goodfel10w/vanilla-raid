import { computed } from 'vue'
import { ROLES, CLS, DAYS, SLOTS, ROLE_COLORS, ROLE_ICONS, DAY_SHORT } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { Entry } from '@/types'
import { cc } from '@/lib/utils'
import { useHeatmapData } from './useHeatmapData'

export interface RoleCount {
  role: RoleName
  count: number
  pct: number
  color: string
  icon: string
}

export interface ClassCount {
  name: string
  color: string
  count: number
}

export interface BestSlot {
  key: string
  day: string
  time: string
  total: number
  tent: number
  rank: number
}

export interface PlayerSlotCount {
  charName: string
  className: string
  color: string
  slotCount: number
}

export function useAnalyticsData(entriesRef: () => Entry[]) {
  const { heatData, avForSlot, isRaidReady } = useHeatmapData(entriesRef)

  const roleCounts = computed<RoleCount[]>(() => {
    const entries = entriesRef()
    return ROLES.map(r => {
      const count = entries.filter(e => (e.roles || []).includes(r)).length
      const pct = entries.length ? Math.round(count / entries.length * 100) : 0
      return { role: r, count, pct, color: ROLE_COLORS[r], icon: ROLE_ICONS[r] }
    })
  })

  const multiSpecCount = computed(() => {
    const entries = entriesRef()
    const multiSpec = entries.filter(e => (e.specs || []).length > 1).length
    const multiRole = entries.filter(e => (e.roles || []).length > 1).length
    return multiSpec || multiRole
  })

  const singleSpecCount = computed(() => {
    return entriesRef().length - multiSpecCount.value
  })

  const classCounts = computed<ClassCount[]>(() => {
    const entries = entriesRef()
    return CLS.map(c => ({
      name: c.name,
      color: c.color,
      count: entries.filter(e => e.className === c.name).length,
    }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
  })

  const maxClassCount = computed(() => {
    return Math.max(1, ...classCounts.value.map(c => c.count))
  })

  const bestSlots = computed<BestSlot[]>(() => {
    const hd = heatData()
    return Object.entries(hd)
      .sort((a, b) => b[1].total - a[1].total)
      .filter(([, v]) => v.total > 0)
      .slice(0, 3)
      .map(([k, dat], i) => {
        const sep = k.indexOf('_')
        const day = k.substring(0, sep)
        const time = k.substring(sep + 1)
        return { key: k, day, time, total: dat.total, tent: dat.tent, rank: i + 1 }
      })
  })

  const playerSlotCounts = computed<PlayerSlotCount[]>(() => {
    const entries = entriesRef()
    const arr = entries.map(e => {
      const cnt = DAYS.reduce(
        (s, d) => s + SLOTS.filter(sl => e.availability?.[d + '_' + sl]).length,
        0
      )
      return { charName: e.charName, className: e.className, color: cc(e.className), slotCount: cnt }
    })
    return arr.sort((a, b) => b.slotCount - a.slotCount)
  })

  const maxPlayerSlots = computed(() => {
    return Math.max(1, ...playerSlotCounts.value.map(p => p.slotCount))
  })

  function playersForSlot(day: string, hourLabel: string) {
    return avForSlot(day, hourLabel)
  }

  return {
    roleCounts,
    multiSpecCount,
    singleSpecCount,
    classCounts,
    maxClassCount,
    bestSlots,
    playerSlotCounts,
    maxPlayerSlots,
    playersForSlot,
    isRaidReady,
  }
}
