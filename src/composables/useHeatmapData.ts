import { computed, ref } from 'vue'
import { DAYS, WEEKDAYS, WEEKEND, HOUR_LABELS, SLOTS, ROLES, RR_TANK, RR_HEAL, RR_DPS, DAY_SHORT, CLASS_SPECS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import type { Entry } from '@/types'
import { hourQuarters, cc } from '@/lib/utils'

export type HeatMode = '1h' | '3h' | '4h'

export interface HeatDatum {
  yes: number
  tent: number
  total: number
}

export interface RaidReadyResult {
  t: number
  hl: number
  dp: number
  ready: boolean
}

export interface PlayerWithAvailType extends Entry {
  _availType: 'yes' | 'tentative'
}

export function useHeatmapData(entriesRef: () => Entry[]) {
  const heatMode = ref<HeatMode>('1h')

  function setHeatMode(mode: HeatMode) {
    heatMode.value = mode
  }

  function heatData(): Record<string, HeatDatum> {
    const entries = entriesRef()
    const hd: Record<string, HeatDatum> = {}
    DAYS.forEach(d => HOUR_LABELS.forEach(hl => {
      const k = d + '_' + hl
      const qs = hourQuarters(hl).map(q => d + '_' + q)
      let yes = 0, tent = 0
      entries.forEach(e => {
        const vals = qs.map(q => e.availability?.[q])
        const allAvail = vals.every(v => v === 'yes' || v === true as any || v === 'tentative')
        if (!allAvail) return
        if (vals.every(v => v === 'yes' || v === true as any)) yes++; else tent++
      })
      hd[k] = { yes, tent, total: yes + tent }
    }))
    return hd
  }

  function avForSlot(d: string, hl: string): PlayerWithAvailType[] {
    const entries = entriesRef()
    const qs = hourQuarters(hl).map(q => d + '_' + q)
    return entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
      const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true as any })
      return { ...e, _availType: allYes ? 'yes' : 'tentative' } as PlayerWithAvailType
    })
  }

  function windowLabels3h(): string[] {
    const labels: string[] = []
    for (let h = 12; h <= 21; h++) {
      const endH = h + 3
      labels.push(String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00')
    }
    return labels
  }

  function windowLabels4h(): string[] {
    const labels: string[] = []
    for (let h = 12; h <= 20; h++) {
      const endH = h + 4
      labels.push(String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00')
    }
    return labels
  }

  function _buildWindowSlots(d: string, startH: number, endH: number): string[] {
    const qs: string[] = []
    for (let wh = startH; wh < endH; wh++) {
      for (const m of [0, 15, 30, 45]) {
        qs.push(d + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
      }
    }
    return qs
  }

  function _parseWindowLabel(label: string): { startH: number; endH: number } {
    const parts = label.split('\u2013')
    const startH = parseInt(parts[0])
    let endH = parseInt(parts[1])
    if (endH === 0) endH = 24
    return { startH, endH }
  }

  function heatData3h(): Record<string, HeatDatum> {
    const entries = entriesRef()
    const hd: Record<string, HeatDatum> = {}
    DAYS.forEach(d => {
      for (let h = 12; h <= 21; h++) {
        const endH = h + 3
        const label = String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00'
        const k = d + '_' + label
        const qs = _buildWindowSlots(d, h, endH)
        let yes = 0, tent = 0
        entries.forEach(e => {
          const vals = qs.map(q => e.availability?.[q])
          if (!vals.every(v => v === 'yes' || v === true as any || v === 'tentative')) return
          if (vals.every(v => v === 'yes' || v === true as any)) yes++; else tent++
        })
        hd[k] = { yes, tent, total: yes + tent }
      }
    })
    return hd
  }

  function avForWindow3h(d: string, label: string): PlayerWithAvailType[] {
    const entries = entriesRef()
    const { startH, endH } = _parseWindowLabel(label)
    const qs = _buildWindowSlots(d, startH, endH)
    return entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
      const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true as any })
      return { ...e, _availType: allYes ? 'yes' : 'tentative' } as PlayerWithAvailType
    })
  }

  function heatData4h(): Record<string, HeatDatum> {
    const entries = entriesRef()
    const hd: Record<string, HeatDatum> = {}
    DAYS.forEach(d => {
      for (let h = 12; h <= 20; h++) {
        const endH = h + 4
        const label = String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00'
        const k = d + '_' + label
        const qs = _buildWindowSlots(d, h, endH)
        let yes = 0, tent = 0
        entries.forEach(e => {
          const vals = qs.map(q => e.availability?.[q])
          if (!vals.every(v => v === 'yes' || v === true as any || v === 'tentative')) return
          if (vals.every(v => v === 'yes' || v === true as any)) yes++; else tent++
        })
        hd[k] = { yes, tent, total: yes + tent }
      }
    })
    return hd
  }

  function avForWindow4h(d: string, label: string): PlayerWithAvailType[] {
    const entries = entriesRef()
    const { startH, endH } = _parseWindowLabel(label)
    const qs = _buildWindowSlots(d, startH, endH)
    return entries.filter(e => qs.every(q => e.availability?.[q])).map(e => {
      const allYes = qs.every(q => { const v = e.availability[q]; return v === 'yes' || v === true as any })
      return { ...e, _availType: allYes ? 'yes' : 'tentative' } as PlayerWithAvailType
    })
  }

  function isRaidReady(players: Pick<Entry, 'roles'>[]): RaidReadyResult {
    let t = 0, hl = 0, dp = 0
    players.forEach(p => {
      const roles = p.roles || []
      if (roles.includes('Tank')) t++
      if (roles.includes('Heiler')) hl++
      if (roles.includes('DPS')) dp++
    })
    return { t, hl, dp, ready: t >= RR_TANK && hl >= RR_HEAL && dp >= RR_DPS }
  }

  const currentHeatData = computed(() => {
    if (heatMode.value === '4h') return heatData4h()
    if (heatMode.value === '3h') return heatData3h()
    return heatData()
  })

  const currentLabels = computed(() => {
    if (heatMode.value === '4h') return windowLabels4h()
    if (heatMode.value === '3h') return windowLabels3h()
    return HOUR_LABELS
  })

  function playersForCell(d: string, label: string): PlayerWithAvailType[] {
    if (heatMode.value === '4h') return avForWindow4h(d, label)
    if (heatMode.value === '3h') return avForWindow3h(d, label)
    return avForSlot(d, label)
  }

  const topSlots = computed(() => {
    const hd = currentHeatData.value
    return Object.entries(hd)
      .sort((a, b) => b[1].total - a[1].total)
      .filter(([, v]) => v.total > 0)
      .slice(0, 5)
  })

  return {
    heatMode,
    setHeatMode,
    heatData,
    heatData3h,
    heatData4h,
    avForSlot,
    avForWindow3h,
    avForWindow4h,
    windowLabels3h,
    windowLabels4h,
    isRaidReady,
    currentHeatData,
    currentLabels,
    playersForCell,
    topSlots,
  }
}
